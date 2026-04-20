import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { getWalletSession } from "../services/wagmi-api";
import { contextProviderProps } from "./controlled-dom-props";

export interface UserProfile {
  displayName: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  settings?: {
    currency: string;
    language: string;
  };
}

// Kept as compatibility helper for older hot-reloaded bundles.
function formatAddressLabel(address: string | null): string {
  if (!address) return "Connected Wallet";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Base URL so avatars work when app is at /dashboard/ (Vite base)
export const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

// Avatars from public/avatar (paths relative to base so /dashboard/avatar/* work)
const AVATAR_POOL = [
  `${BASE}avatar/avatar1.jpg`,
  `${BASE}avatar/avatar2.jpg`,
  `${BASE}avatar/avatar3.jpg`,
  `${BASE}avatar/avatar4.jpg`,
  `${BASE}avatar/avatar5.jpg`,
  `${BASE}avatar/avatar6.jpg`,
  `${BASE}avatar/avatar7.jpg`,
  `${BASE}avatar/avatar8.jpg`,
  `${BASE}avatar/avatar9.jpg`,
  `${BASE}avatar/avatar10.jpg`,
];

/** Pick a stable-ish random avatar (seeded per browser session via sessionStorage). */
function getDefaultAvatar(): string {
  const key = "ww_default_avatar_idx";
  let idx = parseInt(sessionStorage.getItem(key) ?? "", 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= AVATAR_POOL.length) {
    idx = Math.floor(Math.random() * AVATAR_POOL.length);
    sessionStorage.setItem(key, String(idx));
  }
  return AVATAR_POOL[idx];
}

/** Default avatar path (for fallbacks in layout/dashboard). */
export const DEFAULT_AVATAR_PATH = `${BASE}avatar/avatar1.jpg`;

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "Default",
  email: "",
  bio: "Connect your wallet to personalise your profile.",
  avatarUrl: getDefaultAvatar(),
  settings: {
    currency: "USD",
    language: "English",
  },
};

interface UserProfileContextType {
  /** The resolved profile: either the server profile or the default. */
  profile: UserProfile;
  /** True when a wallet address session exists. */
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  profile: DEFAULT_PROFILE,
  isConnected: false,
  loading: false,
  error: null,
  updateProfile: async () => {},
  fetchProfile: async () => {},
});

// Get API base URL — use same-origin requests by default so the auth
// cookie set by /api is included in every fetch.
// Electron keeps explicit backend URL.
const getApiUrl = () => {
  const IS_ELECTRON = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  if (IS_ELECTRON) return import.meta.env.VITE_API_URL_ELECTRON || 'http://localhost:3002';

  return "";
};

const PROFILE_CACHE_PREFIX = 'ww_profile_cache:';
const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readProfileCache(address: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${address.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: UserProfile; cachedAt?: number; v?: number };
    if (!parsed?.profile || !parsed?.cachedAt) return null;
    if (Date.now() - parsed.cachedAt > PROFILE_CACHE_TTL_MS) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

function writeProfileCache(address: string, profile: UserProfile) {
  try {
    localStorage.setItem(
      `${PROFILE_CACHE_PREFIX}${address.toLowerCase()}`,
      JSON.stringify({ v: 1, cachedAt: Date.now(), profile }),
    );
  } catch {
    // ignore cache write errors
  }
}

function clearProfileCache(address: string) {
  try {
    localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${address.toLowerCase()}`);
  } catch {
    // ignore cache clear errors
  }
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [serverProfile, setServerProfile] = useState<UserProfile | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved profile:
  // - if connected and profile exists: server profile (Mongo-backed)
  // - otherwise: default profile
  const profile = useMemo<UserProfile>(() => {
    if (isConnected && serverProfile) return serverProfile;
    return DEFAULT_PROFILE;
  }, [isConnected, serverProfile]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    let sessionAddress: string | null = null;
    try {
      const apiUrl = getApiUrl();

      // 1) Primary check: wallet session endpoint
      try {
        const session = await getWalletSession();
        sessionAddress = session?.address ? String(session.address).toLowerCase() : null;
      } catch {
        sessionAddress = null;
      }

      // 2) Profile fetch (authoritative for actual profile content)
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const profileResponseJson = await response.json();
        const profileData = profileResponseJson?.profile as (UserProfile & { address?: string | null }) | null;

        // Connectivity can be derived from either wallet session or authenticated profile payload.
        const profileAddress = profileData?.address ? String(profileData.address).toLowerCase() : null;
        const resolvedAddress = sessionAddress ?? profileAddress;
        const connected = !!resolvedAddress;

        setIsConnected(connected);
        setConnectedAddress(resolvedAddress);

        if (connected && profileData) {
          setServerProfile(profileData);
          writeProfileCache(resolvedAddress, profileData);
        } else {
          setServerProfile(null);
          if (resolvedAddress) clearProfileCache(resolvedAddress);
        }

        return;
      }

      if (response.status === 401) {
        setIsConnected(false);
        if (sessionAddress) clearProfileCache(sessionAddress);
        setConnectedAddress(null);
        setServerProfile(null);
        return;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch {
      // On transient failures, use local cached profile for the same connected wallet.
      if (sessionAddress) {
        const cached = readProfileCache(sessionAddress);
        if (cached) {
          setIsConnected(true);
          setConnectedAddress(sessionAddress);
          setServerProfile(cached);
        }
      }
      // Keep prior UI state on transient failures but avoid noisy auth errors.
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to save profile");
      }
      const saveProfileJson = await response.json();
      if (saveProfileJson?.profile) {
        setServerProfile(saveProfileJson.profile);
        setIsConnected(true);
        if (saveProfileJson.profile.address) {
          const addr = String(saveProfileJson.profile.address).toLowerCase();
          setConnectedAddress(addr);
          writeProfileCache(addr, saveProfileJson.profile);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const profileContextPayload = useMemo(
    () => ({
      profile,
      isConnected,
      loading,
      error,
      updateProfile,
      fetchProfile,
    }),
    [profile, isConnected, loading, error, updateProfile, fetchProfile],
  );

  return (
    <UserProfileContext.Provider {...contextProviderProps(profileContextPayload)}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
