import { useState, useEffect, useCallback } from "react";
import { optionPropsWithDomValue, selectPropsWithDomValue } from "./controlled-dom-props";
import { mainnet, sepolia } from "viem/chains";
import { useTheme } from "./theme-context";
import { usePortfolio } from "./portfolio-context";
import { getApiBase } from "../services/wagmi-api";

function formatGwei(value: number) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function formatUsdEstimate(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPhpEstimate(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function useGasFeeEstimate(chainId: number) {
  const [gasFeeGwei, setGasFeeGwei] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const fetchGasFee = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`${getApiBase()}/api/gas-fee?chainId=${chainId}`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("gas-fee API failed");

      const payload = (await response.json()) as {
        ok?: boolean;
        gasFeeGwei?: number | null;
      };

      const gwei = payload?.gasFeeGwei;
      if (!payload?.ok || gwei == null || !Number.isFinite(Number(gwei)) || Number(gwei) <= 0) {
        throw new Error("invalid gas estimate");
      }

      setGasFeeGwei(Number(gwei));
      setStatus("ok");
      setUpdatedAt(Date.now());
    } catch {
      setStatus("error");
      setGasFeeGwei(null);
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchGasFee();
    const interval = setInterval(fetchGasFee, 30000);
    return () => clearInterval(interval);
  }, [fetchGasFee]);

  return { gasFeeGwei, loading, status, updatedAt, refetch: fetchGasFee };
}

export function GasFeeStrip({ chainId, compact = false }: { chainId: number; compact?: boolean }) {
  const { isDark } = useTheme();
  const { gasFeeGwei, loading, status } = useGasFeeEstimate(chainId);
  const chainLabel = chainId === sepolia.id ? "Sepolia" : chainId === mainnet.id ? "Mainnet" : `Chain ${chainId}`;
  const { ethPrice } = usePortfolio();
  const [currency, setCurrency] = useState<"USD" | "PHP">("USD");
  const [phpRate, setPhpRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPhpRate = async () => {
      try {
        const response = await fetch("https://open.er-api.com/v6/latest/USD", {
          credentials: "omit",
        });
        if (!response.ok) throw new Error("fx API failed");
        const payload = (await response.json()) as { rates?: { PHP?: number } };
        const rate = payload?.rates?.PHP;
        if (!cancelled && rate && Number.isFinite(rate) && rate > 0) {
          setPhpRate(rate);
        }
      } catch {
        if (!cancelled) {
          setPhpRate(56);
        }
      }
    };

    void fetchPhpRate();
    return () => {
      cancelled = true;
    };
  }, []);

  const gasUsdEstimate = gasFeeGwei != null && Number.isFinite(ethPrice) && ethPrice > 0
    ? (gasFeeGwei * 1e-9) * 21000 * ethPrice
    : null;

  const gasPhpEstimate = gasUsdEstimate != null && phpRate != null && Number.isFinite(phpRate)
    ? gasUsdEstimate * phpRate
    : null;

  const estimatePrefix = currency === "PHP" ? "₱" : "$";
  const estimateAmount = loading
    ? "--"
    : currency === "PHP"
      ? gasPhpEstimate != null
        ? formatPhpEstimate(gasPhpEstimate)
        : "--"
      : gasUsdEstimate != null
        ? formatUsdEstimate(gasUsdEstimate)
        : "--";

  const baseBlockSeconds = chainId === mainnet.id ? 12 : chainId === sepolia.id ? 14 : 12;
  const transactionTimeSeconds = loading
    ? null
    : gasFeeGwei != null
      ? (gasFeeGwei >= 40 ? 2 : gasFeeGwei >= 20 ? 3 : gasFeeGwei >= 10 ? 4 : 6) * baseBlockSeconds
      : null;
  const transactionTimeLabel = loading
    ? "--"
    : transactionTimeSeconds != null
      ? `~${formatDuration(transactionTimeSeconds)}`
      : "--";

  return (
    <div className={compact ? "w-full" : "mt-[12px] sm:mt-[14px] flex justify-center"}>
      <div
        className={compact ? "w-full flex flex-col gap-[4px] rounded-[14px] px-[12px] sm:px-[16px] py-[10px] min-h-[84px] h-full justify-center" : "inline-flex flex-col gap-[4px] rounded-[14px] px-[10px] sm:px-[12px] py-[8px]"}
        style={{
          backgroundColor: compact
            ? (isDark ? "rgba(176,176,176,0.10)" : "rgba(79,70,229,0.07)")
            : (isDark ? "rgba(176,176,176,0.10)" : "rgba(79,70,229,0.08)"),
          border: compact ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(79,70,229,0.22)"}`,
        }}
      >
        <div className="inline-flex items-center gap-[10px] flex-wrap">
          <span className="font-['Inter',sans-serif] text-[11px] sm:text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(17,24,39,0.7)" }}>
            GAS FEE
          </span>
          <span className="font-['Inter',sans-serif] font-semibold text-[11px] sm:text-[12px]" style={{ color: isDark ? "#ffffff" : "#111827" }}>
            {loading ? "Loading..." : gasFeeGwei != null ? `${formatGwei(gasFeeGwei)} Gwei` : "N/A"}
          </span>
          <span className="font-['Inter',sans-serif] text-[10px] sm:text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(55,65,81,0.6)" }}>
            {chainLabel}
          </span>
          {status === "error" && !loading && (
            <span className="font-['Inter',sans-serif] text-[10px] sm:text-[11px] text-[#fb035c]">RPC unavailable</span>
          )}
        </div>

        <div className="inline-flex items-center gap-[6px] flex-wrap">
          <span className="font-['Inter',sans-serif] text-[10px] sm:text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(17,24,39,0.75)" }}>
            Estimate:
          </span>
          <span
            className="font-['Inter',sans-serif] font-extrabold text-[11px] sm:text-[13px]"
            style={{ color: isDark ? "#a78bfa" : "#4f46e5" }}
          >
            {estimatePrefix} {estimateAmount}
          </span>
          <select
            {...selectPropsWithDomValue(currency, setCurrency, {
              className: "rounded-[8px] px-[6px] py-[2px] text-[10px] sm:text-[11px] font-['Inter',sans-serif]",
              style: {
                backgroundColor: isDark ? "rgba(17,24,39,0.85)" : "#ffffff",
                color: isDark ? "#ffffff" : "#111827",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(79,70,229,0.35)"}`,
              },
              "aria-label": "Estimate currency",
            })}
          >
            <option {...optionPropsWithDomValue("USD", "USD")} />
            <option {...optionPropsWithDomValue("PHP", "PHP")} />
          </select>
        </div>

        <div className="inline-flex items-center gap-[6px] flex-wrap">
          <span className="font-['Inter',sans-serif] text-[10px] sm:text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.72)" : "rgba(17,24,39,0.75)" }}>
            Estimated Transaction Time:
          </span>
          <span
            className="font-['Inter',sans-serif] font-bold text-[10px] sm:text-[12px]"
            style={{ color: isDark ? "#34d399" : "#059669" }}
          >
            {transactionTimeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
