/**
 * PortfolioContext — single source of truth for portfolio data.
 * Prevents redundant /api/all-assets and /api/balance calls across tabs.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { mainnet, sepolia } from "viem/chains";
import { getBalanceFromBackend, getAssetsFromBackend } from "../services/wagmi-api";
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
  fetchStatus: "idle" | "ok" | "error" | "disconnected";
  fetchMessage: string | null;
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
  fetchStatus: "idle",
  fetchMessage: null,
};

interface PortfolioContextValue extends PortfolioData {
  refetch: () => void;
  activeChainId: number;
  setActiveChainId: (chainId: number) => void;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  ...DEFAULT_PORTFOLIO,
  refetch: () => {},
  activeChainId: 1,
  setActiveChainId: () => {},
});

export function usePortfolio(): PortfolioContextValue {
  return useContext(PortfolioContext);
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { address, chainId } = useWagmiSession();
  const [data, setData] = useState<PortfolioData>(DEFAULT_PORTFOLIO);
  const [fetchCount, setFetchCount] = useState(0);
  const [activeChainId, setActiveChainId] = useState<number>(chainId ?? 1);
  const [hasUserSelectedChain, setHasUserSelectedChain] = useState(false);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  const handleSetActiveChainId = useCallback((nextChainId: number) => {
    setHasUserSelectedChain(true);
    setActiveChainId(nextChainId);
  }, []);

  useEffect(() => {
    // Keep session chain as default until user explicitly picks from dropdown.
    // Once user picks, don't override with session chain on subsequent renders.
    if (!chainId || hasUserSelectedChain) return;
    if (chainId !== activeChainId) {
      setActiveChainId(chainId);
    }
  }, [chainId, activeChainId, hasUserSelectedChain]);

  useEffect(() => {
    if (!address) {
      setData({ ...DEFAULT_PORTFOLIO, loading: false, fetchStatus: "disconnected", fetchMessage: "Connect wallet to load portfolio" });
      return;
    }

    let cancelled = false;

    async function fetchPortfolio() {
      try {
        const effectiveChainId = activeChainId;
        const [balanceRes, assetsRes] = await Promise.all([
          getBalanceFromBackend(effectiveChainId),
          getAssetsFromBackend(address!, effectiveChainId),
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

        const chainNum = Number(effectiveChainId);
        let ethPrice = 0;
        const applyEthSpot = (p: unknown) => {
          if (p == null || typeof p !== "number" || !Number.isFinite(p) || p <= 0) return false;
          ethPrice = p;
          return true;
        };
        try {
          // Sepolia: prefer mainnet ETH spot for USD (testnet rarely has a reliable native quote).
          if (chainNum === sepolia.id) {
            const mainSpot = await BlockchainAPI.getTokenPrice("ethereum", mainnet.id);
            if (!applyEthSpot(mainSpot?.price as number)) {
              const sepSpot = await BlockchainAPI.getTokenPrice("ethereum", chainNum);
              applyEthSpot(sepSpot?.price as number);
            }
          } else {
            const priceRes = await BlockchainAPI.getTokenPrice("ethereum", chainNum);
            applyEthSpot(priceRes?.price as number);
          }
        } catch {
          /* keep 0 */
        }

        let totalUSD = balanceEth * ethPrice;
        if (!Number.isFinite(totalUSD)) totalUSD = 0;

        if (contractAddresses.length > 0) {
          try {
            const prices = await BlockchainAPI.getMultipleTokenPrices(contractAddresses, effectiveChainId);
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
          fetchStatus: "ok",
          fetchMessage: null,
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load portfolio";
          setData({ ...DEFAULT_PORTFOLIO, loading: false, fetchStatus: "error", fetchMessage: message });
        }
      }
    }

    fetchPortfolio();
    return () => {
      cancelled = true;
    };
  }, [address, activeChainId, fetchCount]);

  return (
    <PortfolioContext.Provider value={{ ...data, refetch, activeChainId, setActiveChainId: handleSetActiveChainId }}>
      {children}
    </PortfolioContext.Provider>
  );
}
