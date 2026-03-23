import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { getWalletSession } from "../services/wagmi-api";

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
// cookie set by the /api proxy (same host) is included in every fetch.
// Only specify an absolute URL when VITE_API_URL_WEB / VITE_API_URL is explicitly provided.
const getApiUrl = () => {
  const IS_ELECTRON = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  if (IS_ELECTRON) return import.meta.env.VITE_API_URL_ELECTRON || 'http://localhost:3002';

  const apiUrl = import.meta.env.VITE_API_URL_WEB || import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl;

  // Same-origin — works when served behind the root Vite proxy or in production
  return "";
};

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [serverProfile, setServerProfile] = useState<UserProfile | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved profile: prefer server data, fall back to default
  const profile = useMemo<UserProfile>(
    () => (isConnected && serverProfile ? serverProfile : DEFAULT_PROFILE),
    [isConnected, serverProfile],
  );

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl();

      // Check wallet session via the correct /api/walletAddress endpoint
      let hasAddress = false;
      try {
        const session = await getWalletSession();
        hasAddress = !!session?.address;
      } catch {
        // 401 or network error — no session
        hasAddress = false;
      }

      setIsConnected(hasAddress);
      if (!hasAddress) {
        setServerProfile(null);
        setLoading(false);
        return;
      }

      // Wallet is connected – fetch server profile
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false);
          setError(null);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.profile) {
        setServerProfile(data.profile);
      }
    } catch {
      setError(null); // Don't show error for auth failures
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
      const data = await response.json();
      setServerProfile(data.profile);
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

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        isConnected,
        loading,
        error,
        updateProfile,
        fetchProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
