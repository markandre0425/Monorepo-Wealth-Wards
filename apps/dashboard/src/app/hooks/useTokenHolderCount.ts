import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "../services/wagmi-api";

/** CSCS (mainnet) — only addresses accepted by {@link useTokenHolderCount}. */
export const CSCS_CONTRACT_ADDRESS = "0xa6Ec49E06C25F63292bac1Abc1896451A0f4cFB7" as const;

/** CSCR (mainnet) — only addresses accepted by {@link useTokenHolderCount}. */
export const CSCR_CONTRACT_ADDRESS = "0x9C9580A8915d2797fb9E9651c93aE1559D8A498e" as const;

const ALLOWED_CONTRACTS: ReadonlySet<string> = new Set<string>([
  CSCS_CONTRACT_ADDRESS.toLowerCase(),
  CSCR_CONTRACT_ADDRESS.toLowerCase(),
]);

export type TokenHolderCountResult = {
  holderCount: number | null;
  isLoading: boolean;
  error: string | null;
};

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Fetches ERC-20 token holder count via the app server (`GET /api/token-holder-count`),
 * uses Ethplorer **getTokenInfo** (`holdersCount`) on the backend — no explorer keys in the browser.
 * Only {@link CSCS_CONTRACT_ADDRESS} and {@link CSCR_CONTRACT_ADDRESS} are allowed.
 */
export function useTokenHolderCount(contractAddress: string): TokenHolderCountResult {
  const [holderCount, setHolderCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => normalizeAddress(contractAddress), [contractAddress]);
  const isAllowed = ALLOWED_CONTRACTS.has(normalized);

  const fetchCount = useCallback(
    async (signal: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      setHolderCount(null);

      const base = getApiBase();
      const url = `${base}/api/token-holder-count?contractAddress=${encodeURIComponent(contractAddress.trim())}`;

      try {
        const response = await fetch(url, {
          method: "GET",
          signal,
          credentials: "include",
          headers: { accept: "application/json" },
        });

        const json: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          setHolderCount(null);
          setError("Sign in to load holder counts");
          return;
        }

        if (!response.ok || !json || typeof json !== "object") {
          const err =
            json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
              ? (json as { error: string }).error
              : `Request failed (${response.status})`;
          setHolderCount(null);
          setError(err);
          return;
        }

        const responseBody = json as Record<string, unknown>;

        if (
          responseBody.ok === true &&
          typeof responseBody.holderCount === "number" &&
          Number.isFinite(responseBody.holderCount) &&
          responseBody.holderCount >= 0
        ) {
          setHolderCount(responseBody.holderCount);
          setError(null);
          return;
        }

        if (responseBody.ok === false && typeof responseBody.error === "string") {
          setHolderCount(null);
          setError(responseBody.error);
          return;
        }

        setHolderCount(null);
        setError("Unexpected response from server");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        setHolderCount(null);
        setError(e instanceof Error ? e.message : "Failed to fetch holder count");
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [contractAddress],
  );

  useEffect(() => {
    if (!isAllowed) {
      setHolderCount(null);
      setIsLoading(false);
      setError("Only CSCS and CSCR contract addresses are supported");
      return;
    }

    const controller = new AbortController();
    void fetchCount(controller.signal);
    return () => controller.abort();
  }, [contractAddress, fetchCount, isAllowed]);

  return { holderCount, isLoading, error };
}
