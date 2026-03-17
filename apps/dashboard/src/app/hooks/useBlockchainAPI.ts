import { useState, useCallback, useEffect } from 'react';
import { BlockchainAPI } from '../services/blockchain-api';

interface UseTokenDataResult {
  tokenData: any;
  loading: boolean;
  error: string | null;
}

interface UseBalanceResult {
  balance: string;
  balanceUSD: number;
  loading: boolean;
  error: string | null;
}

interface UsePriceResult {
  price: number;
  change24h: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch token data from blockchain with automatic fallback
 */
export function useTokenData(contractAddress: string): UseTokenDataResult {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractAddress) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await BlockchainAPI.getTokenData(contractAddress);
        setTokenData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token data');
        setTokenData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractAddress]);

  return { tokenData, loading, error };
}

/**
 * Hook to fetch balance for an address with automatic fallback
 */
export function useBalance(address: string, refetch?: boolean): UseBalanceResult {
  const [balance, setBalance] = useState<string>('0');
  const [balanceUSD, setBalanceUSD] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await BlockchainAPI.getBalance(address);
        setBalance(data.balance);
        setBalanceUSD(data.balanceUSD || 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
        setBalance('0');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [address, refetch]);

  return { balance, balanceUSD, loading, error };
}

/**
 * Hook to fetch token price with automatic fallback
 */
export function useTokenPrice(tokenId: string = 'ethereum'): UsePriceResult {
  const [price, setPrice] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setLoading(true);
        const data = await BlockchainAPI.getTokenPrice(tokenId);
        setPrice(data.price || 0);
        setChange24h(data.change24h || 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch price');
        setPrice(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
  }, [tokenId]);

  return { price, change24h, loading, error };
}

/**
 * Hook to fetch multiple token prices at once
 */
export function useMultipleTokenPrices(tokenIds: string[]) {
  const [prices, setPrices] = useState<Record<string, { price?: number; change24h?: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenIds || tokenIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchPrices = async () => {
      try {
        setLoading(true);
        const data = await BlockchainAPI.getMultipleTokenPrices(tokenIds);
        setPrices(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
        setPrices({});
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [JSON.stringify(tokenIds)]);

  return { prices, loading, error };
}
