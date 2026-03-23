/**
 * PortfolioContext — single source of truth for portfolio data.
 * Prevents redundant /api/all-assets and /api/balance calls across tabs.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getBalanceFromBackend, getAssetsFromBackend, getApiBase } from "../services/wagmi-api";
import { BlockchainAPI } from "../services/blockchain-api";
import { useWagmiSession } from "../hooks/useWagmiSession";

const CSCS_CONTRACT = "0xa6Ec49E06C25F63292bac1Abc1896451A0f4cFB7";
const CSCR_CONTRACT = "0x9C9580A8915d2797fb9E9651c93aE1559D8A498e";

export interface PortfolioData {
  balance: number;
  savings: number;
  rewards: number;
  apy: number;
  ethPrice: number;
  ethHoldings: number;
  cscsHoldings: number;
  cscrHoldings: number;
  loading: boolean;
  assets: any[];
}

const DEFAULT_PORTFOLIO: PortfolioData = {
  balance: 0,
  savings: 0,
  rewards: 0,
  apy: 0,
  ethPrice: 0,
  ethHoldings: 0,
  cscsHoldings: 0,
  cscrHoldings: 0,
  loading: true,
  assets: [],
};

interface PortfolioContextValue extends PortfolioData {
  refetch: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  ...DEFAULT_PORTFOLIO,
  refetch: () => {},
});

export function usePortfolio(): PortfolioContextValue {
  return useContext(PortfolioContext);
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { address } = useWagmiSession();
  const [data, setData] = useState<PortfolioData>(DEFAULT_PORTFOLIO);
  const [fetchCount, setFetchCount] = useState(0);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!address) {
      setData({ ...DEFAULT_PORTFOLIO, loading: false });
      return;
    }

    let cancelled = false;

    async function fetchPortfolio() {
      try {
        const [balanceRes, assetsRes] = await Promise.all([
          getBalanceFromBackend(1),
          getAssetsFromBackend(address!, 1),
        ]);

        if (cancelled) return;

        let balanceEth = 0;
        if (balanceRes?.ok && balanceRes.balance != null) {
          const parsed = parseFloat(String(balanceRes.balance));
          balanceEth = Number.isFinite(parsed) ? parsed : 0;
        }
        const assets =
          assetsRes?.ok && Array.isArray(assetsRes.assets) ? assetsRes.assets : [];

        const cscsLower = CSCS_CONTRACT.toLowerCase();
        const cscrLower = CSCR_CONTRACT.toLowerCase();
        let cscsHoldings = 0;
        let cscrHoldings = 0;
        const contractAddresses = assets
          .map((a: any) => a.contractAddress)
          .filter(Boolean) as string[];

        for (const a of assets) {
          const bal = a.balance != null ? parseFloat(a.balance) : 0;
          if (a.contractAddress?.toLowerCase() === cscsLower) cscsHoldings = bal;
          if (a.contractAddress?.toLowerCase() === cscrLower) cscrHoldings = bal;
        }

        let ethPrice = 0;
        try {
          const priceRes = await BlockchainAPI.getTokenPrice("ethereum");
          if (priceRes?.price != null) ethPrice = priceRes.price;
        } catch {
          /* keep 0 */
        }

        let totalUSD = balanceEth * ethPrice;
        if (!Number.isFinite(totalUSD)) totalUSD = 0;

        if (contractAddresses.length > 0) {
          try {
            const prices = await BlockchainAPI.getMultipleTokenPrices(contractAddresses);
            for (const a of assets) {
              const balParsed = parseFloat(String(a.balance ?? "0"));
              const bal = Number.isFinite(balParsed) ? balParsed : 0;
              const addr = a.contractAddress?.toLowerCase();
              const price = addr
                ? (prices as Record<string, { price?: number }>)[addr]?.price
                : undefined;
              if (price != null) {
                const inc = bal * price;
                if (Number.isFinite(inc)) totalUSD += inc;
              }
            }
          } catch {
            /* ignore */
          }
        }

        if (cancelled) return;
        setData({
          balance: totalUSD,
          savings: 0,
          rewards: 0,
          apy: 0,
          ethPrice,
          ethHoldings: balanceEth,
          cscsHoldings,
          cscrHoldings,
          loading: false,
          assets,
        });
      } catch {
        if (!cancelled) {
          setData({ ...DEFAULT_PORTFOLIO, loading: false });
        }
      }
    }

    fetchPortfolio();
    return () => {
      cancelled = true;
    };
  }, [address, fetchCount]);

  return (
    <PortfolioContext.Provider value={{ ...data, refetch }}>
      {children}
    </PortfolioContext.Provider>
  );
}
