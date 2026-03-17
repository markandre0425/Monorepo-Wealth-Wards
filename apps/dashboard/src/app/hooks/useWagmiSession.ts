import { useState, useCallback, useEffect } from 'react';
import {
  getWalletSession,
  getBalanceFromBackend,
  getAssetsFromBackend,
  type WalletSession,
  type AssetItem,
  type BalanceResponse,
  type AssetsResponse,
} from '../services/wagmi-api';

export interface UseWagmiSessionResult {
  address: string | null;
  session: WalletSession | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Fetches the current wallet session from the Wagmi backend (same as /app/). Use for Connect Account flow. */
export function useWagmiSession(): UseWagmiSessionResult {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWalletSession();
      setSession(data);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : 'Not logged in');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    address: session?.address ?? null,
    session,
    loading,
    error,
    refetch: fetchSession,
  };
}

export interface UseWagmiBalanceResult {
  balanceEth: string;
  balanceUSD: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Fetches native balance from Wagmi backend for the current session. */
export function useWagmiBalance(address: string | null, chainId = 1): UseWagmiBalanceResult {
  const [balanceEth, setBalanceEth] = useState('0');
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalanceEth('0');
      setBalanceUSD(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getBalanceFromBackend(chainId);
      if (data?.ok && data.balance != null) {
        setBalanceEth(data.balance);
        // USD can be computed by parent using price
        setBalanceUSD(0);
      }
    } catch (err) {
      setBalanceEth('0');
      setBalanceUSD(0);
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balanceEth, balanceUSD, loading, error, refetch: fetchBalance };
}

export interface UseWagmiAssetsResult {
  assets: AssetItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Fetches ERC-20 assets from Wagmi backend for the current session. */
export function useWagmiAssets(address: string | null, chainId = 1): UseWagmiAssetsResult {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!address) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAssetsFromBackend(address, chainId);
      if (data?.ok && Array.isArray(data.assets)) {
        setAssets(data.assets);
      } else {
        setAssets([]);
      }
    } catch (err) {
      setAssets([]);
      setError(err instanceof Error ? err.message : 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return { assets, loading, error, refetch: fetchAssets };
}
