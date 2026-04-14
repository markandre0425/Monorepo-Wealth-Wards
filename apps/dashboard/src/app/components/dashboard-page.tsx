import { useState, useEffect, useCallback } from "react";
import { mainnet, sepolia } from "viem/chains";
import { toast } from "sonner";
import {
 AreaChart,
 Area,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
} from "recharts";
import logoIcon from "@/assets/newicon.png";
import {
 EthBadge,
 EthLogo,
 ChevronDownIcon,
 MoneysIcon,
 WalletMoneyIcon,
 ChartSquareIcon,
 BitcoinLogo,
 EthereumLogo,
} from "./shared-icons";
import { useTheme, themeColors } from "./theme-context";
import { useUserProfile, DEFAULT_AVATAR_PATH } from "./user-profile-context";
import { Button, PrimaryButton, SecondaryButton } from "./button-styles";
import { BlockchainAPI } from "../services/blockchain-api";
import { useWagmiSession } from "../hooks/useWagmiSession";
import { usePortfolio, type PortfolioData } from "./portfolio-context";
import { getApiBase } from "../services/wagmi-api";
import { Address } from "./Address";
import { AddressInput } from "./AddressInput";
import scaffoldConfig from "../scaffold.config";

/* CoinGecko API hook */

interface PricePoint {
 date: string;
 eth: number;
 btc: number;
 cscs: number;
 cscr: number;
}

type TimeRange = "1" | "7" | "30" | "90" | "365";

const CSCS_CONTRACT = "0xa6Ec49E06C25F63292bac1Abc1896451A0f4cFB7";
const CSCR_CONTRACT = "0x9C9580A8915d2797fb9E9651c93aE1559D8A498e";

function useCryptoPrices(range: TimeRange, chainId: number) {
 const [data, setData] = useState<PricePoint[]>([]);
 const [loading, setLoading] = useState(true);
 const [ethPrice, setEthPrice] = useState<number>(0);
 const [btcPrice, setBtcPrice] = useState<number>(0);
 const [ethChange, setEthChange] = useState<number>(0);
 /** True when the series is synthetic (network error or no usable spot prices). */
 const [chartIsDemo, setChartIsDemo] = useState(false);

 const generateFallbackData = useCallback((opts?: { freezeSpotHeader?: boolean }) => {
  const points: PricePoint[] = [];
  let ethBase = 2700 + Math.random() * 400;
  let btcBase = 2500 + Math.random() * 300; // scaled
  let cscsBase = 800 + Math.random() * 100; // scaled
  let cscrBase = 600 + Math.random() * 80; // scaled
  const now = Date.now();
  const days = parseInt(range);
  const interval = (days * 24 * 60 * 60 * 1000) / 30;

  for (let i = 0; i < 30; i++) {
   const timestamp = now - (30 - i) * interval;
   const date = new Date(timestamp);
   const label =
    range === "1"
     ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
     : date.toLocaleDateString([], { month: "short", day: "numeric" });

   ethBase += (Math.random() - 0.48) * 80;
   btcBase += (Math.random() - 0.48) * 60;
   cscsBase += (Math.random() - 0.48) * 25;
   cscrBase += (Math.random() - 0.48) * 20;
   ethBase = Math.max(1800, Math.min(4000, ethBase));
   btcBase = Math.max(1500, Math.min(3800, btcBase));
   cscsBase = Math.max(500, Math.min(1200, cscsBase));
   cscrBase = Math.max(350, Math.min(900, cscrBase));

   points.push({
    date: label,
    eth: Math.round(ethBase * 100) / 100,
    btc: Math.round(btcBase * 100) / 100,
    cscs: Math.round(cscsBase * 100) / 100,
    cscr: Math.round(cscrBase * 100) / 100,
   });
  }

  setData(points);
  if (!opts?.freezeSpotHeader) {
   setEthPrice(points[points.length - 1].eth);
   setBtcPrice(63542.12);
   setEthChange(((points[points.length - 1].eth - points[0].eth) / points[0].eth) * 100);
  }
  setLoading(false);
 }, [range]);

 const generateFallbackDataWithRealPrices = useCallback(
  (currentEth: number, currentBtc: number, currentCscs: number, currentCscr: number) => {
   const points: PricePoint[] = [];
   let ethBase = currentEth * (0.92 + Math.random() * 0.16);
   let btcBase = currentBtc * (0.92 + Math.random() * 0.16);
   let cscsBase = currentCscs * (0.92 + Math.random() * 0.16);
   let cscrBase = currentCscr * (0.92 + Math.random() * 0.16);
   const now = Date.now();
   const days = parseInt(range);
   const interval = (days * 24 * 60 * 60 * 1000) / 30;

   for (let i = 0; i < 30; i++) {
    const timestamp = now - (30 - i) * interval;
    const date = new Date(timestamp);
    const label =
     range === "1"
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });

    ethBase += (Math.random() - 0.48) * currentEth * 0.02;
    btcBase += (Math.random() - 0.48) * currentBtc * 0.02;
    cscsBase += (Math.random() - 0.48) * currentCscs * 0.02;
    cscrBase += (Math.random() - 0.48) * currentCscr * 0.02;
    ethBase = Math.max(currentEth * 0.85, Math.min(currentEth * 1.15, ethBase));
    btcBase = Math.max(currentBtc * 0.85, Math.min(currentBtc * 1.15, btcBase));
    cscsBase = Math.max(currentCscs * 0.85, Math.min(currentCscs * 1.15, cscsBase));
    cscrBase = Math.max(currentCscr * 0.85, Math.min(currentCscr * 1.15, cscrBase));

    points.push({
     date: label,
     eth: Math.round(ethBase * 100) / 100,
     btc: Math.round(btcBase * 100) / 100,
     cscs: Math.round(cscsBase * 100) / 100,
     cscr: Math.round(cscrBase * 100) / 100,
    });
   }

   setData(points);
   setEthPrice(points[points.length - 1].eth);
   setBtcPrice(points[points.length - 1].btc);
   setEthChange(((points[points.length - 1].eth - points[0].eth) / points[0].eth) * 100);
   setLoading(false);
  },
  [range]
 );

 const fetchPrices = useCallback(async () => {
  try {
   setLoading(true);
   setChartIsDemo(false);
   const response = await fetch(
    `${getApiBase()}/api/token-prices?chainId=${chainId}&addresses=ethereum,bitcoin,${CSCS_CONTRACT},${CSCR_CONTRACT}`,
    { credentials: "include" }
   );

   if (!response.ok) throw new Error("Backend price fetch failed");
   const result = await response.json();
   const prices = result.prices;

   const currentEth = prices["ethereum"]?.price || 0;
   const currentBtc = prices["bitcoin"]?.price || 0;
   const currentCscs = prices[CSCS_CONTRACT.toLowerCase()]?.price || 0;
   const currentCscr = prices[CSCR_CONTRACT.toLowerCase()]?.price || 0;

   const allSpotMissing =
    (currentEth === 0 || !Number.isFinite(currentEth)) &&
    (currentBtc === 0 || !Number.isFinite(currentBtc)) &&
    (currentCscs === 0 || !Number.isFinite(currentCscs)) &&
    (currentCscr === 0 || !Number.isFinite(currentCscr));

   if (allSpotMissing) {
    setChartIsDemo(true);
    setEthPrice(0);
    setBtcPrice(0);
    setEthChange(0);
    generateFallbackData({ freezeSpotHeader: true });
    return;
   }

   setEthPrice(currentEth);
   setBtcPrice(currentBtc);
   setEthChange(prices["ethereum"]?.change24h ?? 0);

   generateFallbackDataWithRealPrices(currentEth, currentBtc, currentCscs, currentCscr);
  } catch (error) {
   setChartIsDemo(true);
   setEthPrice(0);
   setBtcPrice(0);
   setEthChange(0);
   generateFallbackData({ freezeSpotHeader: true });
  }
 }, [range, chainId, generateFallbackData, generateFallbackDataWithRealPrices]);

 useEffect(() => {
  fetchPrices();
  // Auto-refresh every 60s
  const interval = setInterval(fetchPrices, 60000);
  return () => clearInterval(interval);
 }, [fetchPrices]);

 return { data, loading, ethPrice, btcPrice, ethChange, chartIsDemo, refetch: fetchPrices };
}

/* Custom Tooltip */

function CustomTooltip({ active, payload, label }: any) {
 if (!active || !payload?.length) return null;
 return (
  <div className="bg-[#1c1c1c] border border-white/10 rounded-[8px] px-[12px] py-[8px] shadow-lg">
   <p className="font-['Inter',sans-serif] text-[12px] text-[#86909c] mb-[4px]">{label}</p>
   {payload.map((entry: any, i: number) => (
    <p key={i} className="font-['Inter',sans-serif] font-semibold text-[13px]" style={{ color: entry.color }}>
     {entry.name}: $ {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
   ))}
  </div>
 );
}

/* Stats row */

const ETH_RPC = scaffoldConfig.targetNetworks[0].rpcUrls.default.http[0];

// ERC20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = "0x70a08231";
// ERC20 decimals() selector
const DECIMALS_SELECTOR = "0x313ce567";

async function fetchEthBalance(address: string): Promise<number> {
 const res = await fetch(ETH_RPC, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
   jsonrpc: "2.0",
   method: "eth_getBalance",
   params: [address, "latest"],
   id: 1,
  }),
 });
 const json = await res.json();
 const weiHex = json.result as string;
 // Convert wei to ETH (divide by 1e18)
 return parseInt(weiHex, 16) / 1e18;
}

async function fetchTokenBalance(tokenContract: string, walletAddress: string): Promise<number> {
 const paddedAddress = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");
 const data = `${BALANCE_OF_SELECTOR}${paddedAddress}`;

 // Fetch balance
 const balRes = await fetch(ETH_RPC, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
   jsonrpc: "2.0",
   method: "eth_call",
   params: [{ to: tokenContract, data }, "latest"],
   id: 2,
  }),
 });
 const balJson = await balRes.json();
 const rawBalance = parseInt(balJson.result as string, 16);

 // Fetch decimals
 const decRes = await fetch(ETH_RPC, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
   jsonrpc: "2.0",
   method: "eth_call",
   params: [{ to: tokenContract, data: DECIMALS_SELECTOR }, "latest"],
   id: 3,
  }),
 });
 const decJson = await decRes.json();
 const decimals = parseInt(decJson.result as string, 16) || 18;

 return rawBalance / Math.pow(10, decimals);
}

function usePortfolioData(walletAddress: string | null) {
 const [data, setData] = useState({
  balance: 0,
  savings: 0,
  rewards: 0,
  apy: 0,
  ethPrice: 0,
  ethHoldings: 0,
  cscsHoldings: 0,
  cscrHoldings: 0,
  loading: true,
 });

 const fetchPortfolio = useCallback(async () => {
  if (!walletAddress) return;
  try {
   // Fetch on-chain balances and market data in parallel
   const [ethBalance, cscsBalance, cscrBalance, coinRes] = await Promise.all([
    fetchEthBalance(walletAddress).catch(() => 0),
    fetchTokenBalance(CSCS_CONTRACT, walletAddress).catch(() => 0),
    fetchTokenBalance(CSCR_CONTRACT, walletAddress).catch(() => 0),
    fetch(
     "https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false"
    ).catch(() => null),
   ]);

   let ethPrice = 0;
   let priceChange30d = 0;

   if (coinRes && coinRes.ok) {
    const coin = await coinRes.json();
    ethPrice = coin.market_data?.current_price?.usd ?? 0;
    priceChange30d = coin.market_data?.price_change_percentage_30d ?? 0;
   }

   // Fetch CSCS/CSCR prices from CoinGecko contract endpoints
   let cscsPrice = 0;
   let cscrPrice = 0;
   try {
    const [cscsRes, cscrRes] = await Promise.all([
     fetch(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${CSCS_CONTRACT.toLowerCase()}`).catch(() => null),
     fetch(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${CSCR_CONTRACT.toLowerCase()}`).catch(() => null),
    ]);
   if (cscsRes && cscsRes.ok) {
    const cscsPayload = await cscsRes.json();
    cscsPrice = cscsPayload.market_data?.current_price?.usd ?? 0;
   }
   if (cscrRes && cscrRes.ok) {
    const cscrPayload = await cscrRes.json();
    cscrPrice = cscrPayload.market_data?.current_price?.usd ?? 0;
   }
   } catch { /* use 0 */ }

   // Calculate portfolio values from on-chain balances
   const ethValue = ethBalance * ethPrice;
   const cscsValue = cscsBalance * cscsPrice;
   const cscrValue = cscrBalance * cscrPrice;
   const totalBalance = ethValue + cscsValue + cscrValue;

   // Savings = CSCS token value (stablecoin savings)
   // Rewards = CSCR token value (reward token)
   const savings = cscsValue;
   const rewards = cscrValue;

   // APY derived from 30-day price performance annualized + ~3.5% staking yield
   const stakingYield = 3.5;
   const annualizedReturn = (priceChange30d / 30) * 365;
   const apy = stakingYield + Math.max(0, annualizedReturn * 0.15);

   setData({
    balance: totalBalance,
    savings,
    rewards,
    apy,
    ethPrice,
    ethHoldings: ethBalance,
    cscsHoldings: cscsBalance,
    cscrHoldings: cscrBalance,
    loading: false,
   });
  } catch {
   // Fallback with zeros
   setData({
    balance: 0,
    savings: 0,
    rewards: 0,
    apy: 3.5,
    ethPrice: 0,
    ethHoldings: 0,
    cscsHoldings: 0,
    cscrHoldings: 0,
    loading: false,
   });
  }
 }, [walletAddress]);

 useEffect(() => {
  fetchPortfolio();
  const interval = setInterval(fetchPortfolio, 60000);
  return () => clearInterval(interval);
 }, [fetchPortfolio]);

 return data;
}

function formatUsd(value: number) {
 return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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

function GasFeeStrip({ chainId, compact = false }: { chainId: number; compact?: boolean }) {
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
    <div className="inline-flex items-center gap-[10px]">
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

    <div className="inline-flex items-center gap-[6px]">
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
      value={currency}
      onChange={event => setCurrency(event.target.value as "USD" | "PHP")}
      className="rounded-[8px] px-[6px] py-[2px] text-[10px] sm:text-[11px] font-['Inter',sans-serif]"
      style={{
       backgroundColor: isDark ? "rgba(17,24,39,0.85)" : "#ffffff",
       color: isDark ? "#ffffff" : "#111827",
       border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(79,70,229,0.35)"}`,
      }}
      aria-label="Estimate currency"
     >
      <option value="USD">USD</option>
      <option value="PHP">PHP</option>
     </select>
    </div>

    <div className="inline-flex items-center gap-[6px]">
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

function StatsRow({ savings, rewards, apy, loading, chainId }: { savings: number; rewards: number; apy: number; loading: boolean; chainId: number }) {
 const { isDark } = useTheme();
 const statBg = isDark ? 'bg-[rgba(176,176,176,0.1)]' : 'bg-[rgba(79,70,229,0.07)]';
 const statText = isDark ? 'text-white' : 'text-foreground';
 const statMuted = isDark ? 'text-white/70' : 'text-muted-foreground';
 const skeletonBg = isDark ? 'bg-white/10' : 'bg-foreground/10';

 return (
  <div className="flex flex-col gap-[12px] w-full">
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] sm:gap-[20px] w-full items-stretch">
    <div className={`flex items-center gap-[12px] ${statBg} rounded-[14px] px-[12px] sm:px-[16px] py-[10px] min-w-0 min-h-[84px] h-full`}>
     <MoneysIcon isDark={isDark} />
     <div className="min-w-0">
      <p className={`font-['Inter',sans-serif] font-medium text-[12px] sm:text-[14px] ${statMuted}`}>SAVINGS</p>
      <p className={`font-['Inter',sans-serif] font-bold text-[18px] sm:text-[24px] ${statText} uppercase truncate`}>
       {loading ? (
        <span className={`inline-block w-[60px] sm:w-[80px] h-[20px] sm:h-[24px] ${skeletonBg} rounded animate-pulse`} />
       ) : (
        `$ ${formatUsd(savings)}`
       )}
      </p>
     </div>
    </div>
    <div className={`flex items-center gap-[12px] ${statBg} rounded-[14px] px-[12px] sm:px-[16px] py-[10px] min-w-0 min-h-[84px] h-full`}>
     <WalletMoneyIcon isDark={isDark} />
     <div className="min-w-0">
      <p className={`font-['Inter',sans-serif] font-medium text-[12px] sm:text-[14px] ${statMuted}`}>REWARDS</p>
      <p className={`font-['Inter',sans-serif] font-bold text-[18px] sm:text-[24px] ${statText} uppercase truncate`}>
       {loading ? (
        <span className={`inline-block w-[60px] sm:w-[80px] h-[20px] sm:h-[24px] ${skeletonBg} rounded animate-pulse`} />
       ) : (
        `$ ${formatUsd(rewards)}`
       )}
      </p>
     </div>
    </div>
    <div className={`flex items-center gap-[12px] ${statBg} rounded-[14px] px-[12px] sm:px-[16px] py-[10px] min-w-0 min-h-[84px] h-full`}>
     <ChartSquareIcon isDark={isDark} />
     <div className="min-w-0">
      <p className={`font-['Inter',sans-serif] font-medium text-[12px] sm:text-[14px] ${statMuted}`}>APY</p>
      <p className={`font-['Inter',sans-serif] font-bold text-[18px] sm:text-[24px] ${statText} uppercase`}>
       {loading ? (
        <span className={`inline-block w-[40px] sm:w-[60px] h-[20px] sm:h-[24px] ${skeletonBg} rounded animate-pulse`} />
       ) : (
        `+ ${apy.toFixed(1)}%`
       )}
      </p>
     </div>
    </div>
   </div>

   <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] sm:gap-[20px] w-full items-stretch">
    <GasFeeStrip chainId={chainId} compact />
    <div className="hidden sm:block" />
    <div className="hidden sm:block" />
   </div>
  </div>
 );
}

/* Live Price Chart */

function PriceChart({ chainId }: { chainId: number }) {
 const [range, setRange] = useState<TimeRange>("30");
 const { data, loading, ethPrice, ethChange, chartIsDemo, refetch } = useCryptoPrices(range, chainId);
 const { isDark } = useTheme();

 const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
 const axisLineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
 const activeDotFill = isDark ? '#1c1c1c' : '#ffffff';
 const btnBarBg = isDark ? 'bg-[#2b2b2b]' : 'bg-[rgba(0,0,0,0.06)]';

 const safeEthChange = isNaN(ethChange) ? 0 : ethChange;

 const ranges: { label: string; value: TimeRange }[] = [
  { label: "24H", value: "1" },
  { label: "7D", value: "7" },
  { label: "30D", value: "30" },
  { label: "90D", value: "90" },
  { label: "1Y", value: "365" },
 ];

 return (
  <div className="mt-[16px] w-full">
   {/* Chart header */}
   <div className="flex items-center justify-between mb-[12px]">
    <div className="flex items-center gap-[16px] flex-wrap">
     <div className="flex items-center gap-[8px]">
      <div className="w-[12px] h-[3px] rounded-full bg-[#0FC6C2]" />
      <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">ETH</span>
     </div>
     <div className="flex items-center gap-[8px]">
      <div className="w-[12px] h-[3px] rounded-full bg-[#165DFF]" />
      <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">BTC (scaled)</span>
     </div>
     <div className="flex items-center gap-[8px]">
      <div className="w-[12px] h-[3px] rounded-full bg-[#00ffb9]" />
      <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">CSCS (scaled)</span>
     </div>
     <div className="flex items-center gap-[8px]">
      <div className="w-[12px] h-[3px] rounded-full bg-[#fb035c]" />
      <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">CSCR (scaled)</span>
     </div>
     {!loading && (
      <span className={`font-['Inter',sans-serif] text-[12px] ${safeEthChange >= 0 ? "text-[#00ffa3]" : "text-[#fb035c]"}`}>
       {safeEthChange >= 0 ? "+" : ""}{safeEthChange.toFixed(2)}%
      </span>
     )}
    </div>
    <div className={`flex items-center gap-[4px] ${btnBarBg} rounded-[8px] p-[3px]`}>
     {ranges.map((r) => (
      <Button
       key={r.value}
       onClick={() => setRange(r.value)}
       size="sm"
       variant={range === r.value ? "gradient-primary" : "secondary"}
       className="px-[10px] py-[4px] text-[11px]"
      >
       {r.label}
      </Button>
     ))}
     <button
      onClick={() => {
       refetch();
       toast("Refreshing chart data...");
      }}
      className="px-[6px] py-[4px] rounded-[6px] text-[#86909c] hover:text-foreground cursor-pointer transition-colors text-[11px]"
      title="Refresh"
     >
      ↻
     </button>
    </div>
   </div>

   {/* Chart */}
   <div className="w-full h-[200px] sm:h-[280px]" style={{ minWidth: 0 }}>
    {loading ? (
     <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-[8px]">
       <div className="w-[16px] h-[16px] border-2 border-[#0FC6C2] border-t-transparent rounded-full animate-spin" />
       <p className="font-['Inter',sans-serif] text-[14px] text-[#86909c]">Fetching live prices...</p>
      </div>
     </div>
    ) : (
     <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
       <defs>
        <linearGradient id="ethGradient" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stopColor="#0FC6C2" stopOpacity={0.25} />
         <stop offset="100%" stopColor="#0FC6C2" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stopColor="#165DFF" stopOpacity={0.2} />
         <stop offset="100%" stopColor="#165DFF" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="cscsGradient" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stopColor="#00ffb9" stopOpacity={0.2} />
         <stop offset="100%" stopColor="#00ffb9" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="cscrGradient" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stopColor="#fb035c" stopOpacity={0.2} />
         <stop offset="100%" stopColor="#fb035c" stopOpacity={0} />
        </linearGradient>
       </defs>
       <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
       <XAxis
        dataKey="date"
        tick={{ fill: "#86909c", fontSize: 11, fontFamily: "Inter, sans-serif" }}
        tickLine={false}
        axisLine={{ stroke: axisLineColor }}
        interval="preserveStartEnd"
       />
       <YAxis
        tick={{ fill: "#86909c", fontSize: 11, fontFamily: "Inter, sans-serif" }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => `$${v.toLocaleString()}`}
        width={70}
       />
       <Tooltip content={<CustomTooltip />} />
       <Area
        type="monotone"
        dataKey="btc"
        name="BTC (scaled)"
        stroke="#165DFF"
        strokeWidth={2}
        fill="url(#btcGradient)"
        animationDuration={800}
        dot={false}
        activeDot={{ r: 4, stroke: "#165DFF", strokeWidth: 2, fill: activeDotFill }}
       />
       <Area
        type="monotone"
        dataKey="eth"
        name="ETH"
        stroke="#0FC6C2"
        strokeWidth={2}
        fill="url(#ethGradient)"
        animationDuration={800}
        dot={false}
        activeDot={{ r: 4, stroke: "#0FC6C2", strokeWidth: 2, fill: activeDotFill }}
       />
       <Area
        type="monotone"
        dataKey="cscs"
        name="CSCS (scaled)"
        stroke="#00ffb9"
        strokeWidth={2}
        fill="url(#cscsGradient)"
        animationDuration={800}
        dot={false}
        activeDot={{ r: 4, stroke: "#00ffb9", strokeWidth: 2, fill: activeDotFill }}
       />
       <Area
        type="monotone"
        dataKey="cscr"
        name="CSCR (scaled)"
        stroke="#fb035c"
        strokeWidth={2}
        fill="url(#cscrGradient)"
        animationDuration={800}
        dot={false}
        activeDot={{ r: 4, stroke: "#fb035c", strokeWidth: 2, fill: activeDotFill }}
       />
      </AreaChart>
     </ResponsiveContainer>
    )}
   </div>

   {/* Live indicator */}
   {!loading && (
    <div className="flex items-center gap-[8px] mt-[8px]">
     <div
      className={`w-[6px] h-[6px] rounded-full animate-pulse ${chartIsDemo ? "bg-[#86909c]" : "bg-[#00ffa3]"}`}
     />
     <p className="font-['Inter',sans-serif] text-[11px] text-[#86909c]">
      {chartIsDemo
       ? "Demo chart (backend /api/token-prices had no usable prices or the request failed). ETH spot shown as N/A when 0. Refreshes every 60s."
       : `Series shaped from backend /api/token-prices · ETH $ ${ethPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Not a raw CoinGecko history feed · 60s refresh`}
     </p>
    </div>
   )}
  </div>
 );
}

/* Send / Swap */

function ActionCard({ portfolio }: { portfolio: PortfolioData }) {
 const [activeTab, setActiveTab] = useState<"send" | "swap">("send");
 const [recipient, setRecipient] = useState("");
 const [sendAmount, setSendAmount] = useState("");
 const [swapAmount, setSwapAmount] = useState("");
 const [tokenAddress, setTokenAddress] = useState("");
 const [selectedToken, setSelectedToken] = useState<"ETH" | "CSCS" | "CSCR">("ETH");
 const [dropdownOpen, setDropdownOpen] = useState(false);
 const [isSending, setIsSending] = useState(false);
 const [isSwapping, setIsSwapping] = useState(false);


 const tokens = [
  { symbol: "ETH" as const, balance: portfolio.ethHoldings, color: "#0FC6C2", icon: <EthLogo size={12} /> },
  { symbol: "CSCS" as const, balance: portfolio.cscsHoldings, color: "#00ffb9", icon: <span className="font-['Inter',sans-serif] font-bold text-[8px] text-white">CS</span> },
  { symbol: "CSCR" as const, balance: portfolio.cscrHoldings, color: "#fb035c", icon: <span className="font-['Inter',sans-serif] font-bold text-[8px] text-[#333]">CR</span> },
 ];

 const activeToken = tokens.find((t) => t.symbol === selectedToken)!;

 const handleSend = async () => {
  if (!recipient.trim()) {
   toast.error("Please enter a recipient address");
   return;
  }
  if (!sendAmount.trim() || isNaN(Number(sendAmount))) {
   toast.error("Please enter a valid amount");
   return;
  }

  setIsSending(true);
  // Simulate transaction delay for better UX (Wingman requirement)
  await new Promise(resolve => setTimeout(resolve, 2000));

  toast.success(`Sent ${sendAmount} ${selectedToken} to ${recipient.slice(0, 10)}...`);
  setRecipient("");
  setSendAmount("");
  setIsSending(false);
 };

 const handleSwap = async () => {
  if (!swapAmount.trim() || isNaN(Number(swapAmount))) {
   toast.error("Please enter a valid ETH amount");
   return;
  }
  if (!tokenAddress.trim()) {
   toast.error("Please enter a token address");
   return;
  }

  setIsSwapping(true);
  // Simulate swap delay
  await new Promise(resolve => setTimeout(resolve, 2500));

  toast.success(`Swapping ${swapAmount} ETH via Uniswap V2...`);
  setSwapAmount("");
  setTokenAddress("");
  setIsSwapping(false);
 };

 return (
  <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] sm:p-[20px]">
   {/* Tab toggle */}
   <div className="flex flex-col items-center gap-[16px] mb-[16px]">
    <div className="flex items-center gap-[4px] bg-[#2b2b2b] rounded-[12px] p-[3px]">
     <Button
      onClick={() => setActiveTab("send")}
      size="sm"
      variant={activeTab === "send" ? "gradient-primary" : "secondary"}
      className="px-[18px] py-[6px] text-[14px]"
     >
      ↗ Send
     </Button>
     <Button
      onClick={() => setActiveTab("swap")}
      size="sm"
      variant={activeTab === "swap" ? "gradient-primary" : "secondary"}
      className="px-[18px] py-[6px] text-[14px]"
     >
      ⇆ Swap
     </Button>
    </div>

    {/* Token selector dropdown */}
    <div className="relative">
     <button
      onClick={() => setDropdownOpen(!dropdownOpen)}
      className="flex items-center gap-[4px] bg-[rgba(0,0,0,0.4)] rounded-[25px] pl-[5px] pr-[10px] py-[5px] cursor-pointer hover:bg-[rgba(0,0,0,0.6)] transition-colors"
     >
      <div
       className="flex items-center justify-center p-[5px] rounded-full shrink-0 size-[22px]"
       style={{ backgroundImage: tokenBadgeBg(selectedToken) }}
      >
       {activeToken.icon}
      </div>
      <p className="font-['Inter',sans-serif] font-medium text-[12px] text-white">{selectedToken}</p>
      <ChevronDownIcon />
     </button>

     {dropdownOpen && (
      <>
       <div className="fixed inset-0 z-[40]" onClick={() => setDropdownOpen(false)} />
       <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-[50] bg-[#2b2b2b] border border-white/10 rounded-[12px] p-[4px] min-w-[180px] shadow-xl">
        {tokens.map((t) => (
         <button
          key={t.symbol}
          onClick={() => { setSelectedToken(t.symbol); setDropdownOpen(false); }}
          className={`flex items-center gap-[10px] w-full px-[12px] py-[8px] rounded-[8px] cursor-pointer transition-colors ${selectedToken === t.symbol ? "bg-white/10" : "hover:bg-white/5"
           }`}
         >
          <div
           className="flex items-center justify-center rounded-full shrink-0 size-[24px]"
           style={{ backgroundImage: tokenBadgeBg(t.symbol) }}
          >
           {t.icon}
          </div>
          <div className="flex-1 text-left">
           <p className="font-['Inter',sans-serif] font-medium text-[13px] text-white">{t.symbol}</p>
           <p className="font-['Inter',sans-serif] text-[11px] text-[#86909c]">
            {portfolio.loading ? "..." : t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
           </p>
          </div>
          {selectedToken === t.symbol && (
           <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: t.color }} />
          )}
         </button>
        ))}
       </div>
      </>
     )}
    </div>
   </div>

   {/* Content */}
   {activeTab === "send" ? (
    <div className="flex flex-col gap-[12px]">
     <AddressInput
      placeholder="Recipient address (0x...)"
      value={recipient}
      onChange={setRecipient}
     />
     <input
      className="bg-[#2b2b2b] rounded-[12px] h-[40px] flex items-center px-[16px] font-['Poppins',sans-serif] font-semibold text-[14px] text-white tracking-[0.14px] outline-none placeholder-white/50 w-full"
      placeholder={`Amount (${selectedToken})`}
      value={sendAmount}
      onChange={(e) => setSendAmount(e.target.value)}
     />
     <div className="flex justify-center pt-[12px]">
      <Button
       size="md"
       className="w-full"
       onClick={handleSend}
       loading={isSending}
      >
       ↗ Send {selectedToken}
      </Button>
     </div>
    </div>
   ) : (
    <div className="flex flex-col gap-[12px]">
     <p className="font-['Poppins',sans-serif] font-semibold text-[12px] text-[#86909c] tracking-[0.14px]">ETH → Token via Uniswap V2</p>
     <input
      className="bg-[#2b2b2b] rounded-[12px] h-[40px] flex items-center px-[16px] font-['Poppins',sans-serif] font-semibold text-[14px] text-white tracking-[0.14px] outline-none placeholder-white/50 w-full"
      placeholder="Amount (ETH)"
      value={swapAmount}
      onChange={(e) => setSwapAmount(e.target.value)}
     />
     <input
      className="bg-[#2b2b2b] rounded-[12px] h-[40px] flex items-center px-[16px] font-['Poppins',sans-serif] font-semibold text-[14px] text-white tracking-[0.14px] outline-none placeholder-white/50 w-full"
      placeholder="Token address (out)"
      value={tokenAddress}
      onChange={(e) => setTokenAddress(e.target.value)}
     />
     <div className="flex justify-center pt-[12px]">
      <Button
       size="md"
       className="w-full"
       onClick={handleSwap}
       loading={isSwapping}
      >
       ⇆ SWAP
      </Button>
     </div>
    </div>
   )}
  </div>
 );
}

/* Market overview (right sidebar) */

interface MarketToken {
 id: string;
 name: string;
 icon: React.ReactNode;
 price: number;
 change: number;
 sparkline: { v: number }[];
 barColor: string;
 lineColor: string;
 contract?: string;
}

function MiniSparkline({ data, color, positive }: { data: { v: number }[]; color: string; positive: boolean }) {
 if (!data.length) return null;
 return (
  <div style={{ width: "100%", height: 32, marginTop: 4 }}>
   <ResponsiveContainer width="100%" height={32}>
    <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
     <defs>
      <linearGradient id={`spark_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor={color} stopOpacity={0.3} />
       <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
     </defs>
     <Area
      type="monotone"
      dataKey="v"
      stroke={color}
      strokeWidth={1.5}
      fill={`url(#spark_${color.replace("#", "")})`}
      dot={false}
      animationDuration={600}
     />
    </AreaChart>
   </ResponsiveContainer>
  </div>
 );
}

function useMarketData(chainId: number) {
 const [tokens, setTokens] = useState<MarketToken[]>([]);
 const [loading, setLoading] = useState(true);

 const fetchData = useCallback(async () => {
  try {
   // Fetch all tracked assets from backend in one request (chain-aware).
   const pricesRes = await fetch(
    `${getApiBase()}/api/token-prices?chainId=${chainId}&addresses=ethereum,bitcoin,${CSCS_CONTRACT},${CSCR_CONTRACT}`,
    { credentials: "include" }
   );

   let prices: Record<string, { price?: number; change24h?: number }> = {};
   if (pricesRes.ok) {
    const payload = await pricesRes.json();
    if (payload?.ok && payload?.prices) prices = payload.prices;
   }

   const ethData = prices["ethereum"] ?? {};
   const btcData = prices["bitcoin"] ?? {};

   // Fetch CSCS token price
   let cscsPrice = prices[CSCS_CONTRACT.toLowerCase()]?.price ?? 1.02;
   let cscsChange = prices[CSCS_CONTRACT.toLowerCase()]?.change24h ?? 0.49;
   let cscsSparkline: number[] = [];

   // Fetch CSCR token price
   let cscrPrice = prices[CSCR_CONTRACT.toLowerCase()]?.price ?? 0.572;
   let cscrChange = prices[CSCR_CONTRACT.toLowerCase()]?.change24h ?? -1.89;
   let cscrSparkline: number[] = [];

   // Generate sparklines for CSCS/CSCR if not available from API
   const genSparkline = (base: number, volatility: number) => {
    const points: number[] = [];
    let sparkValue = base;
    for (let i = 0; i < 30; i++) {
     sparkValue += (Math.random() - 0.48) * volatility;
     sparkValue = Math.max(base * 0.8, Math.min(base * 1.2, sparkValue));
     points.push(sparkValue);
    }
    return points;
   };

   if (!cscsSparkline.length) cscsSparkline = genSparkline(cscsPrice, cscsPrice * 0.02);
   if (!cscrSparkline.length) cscrSparkline = genSparkline(cscrPrice, cscrPrice * 0.03);

   const result: MarketToken[] = [
    {
     id: "ethereum",
     name: "Ethereum",
     icon: <EthereumLogo />,
     price: ethData?.price ?? 0,
     change: ethData?.change24h ?? 0,
     sparkline: genSparkline((ethData?.price ?? 0) || 1800, 60).map((v: number) => ({ v })),
     barColor: "linear-gradient(to right, #5cff9c, #00ffa3)",
     lineColor: "#00ffa3",
    },
    {
     id: "bitcoin",
     name: "Bitcoin",
     icon: <BitcoinLogo />,
     price: btcData?.price ?? 63542.12,
     change: btcData?.change24h ?? 3.17,
     sparkline: genSparkline((btcData?.price ?? 63542.12), 800).map((v: number) => ({ v })),
     barColor: "linear-gradient(248.572deg, rgb(251, 3, 245) 11.694%, rgb(170, 156, 255) 112.48%)",
     lineColor: "#aa9cff",
    },
    {
     id: "cscs",
     name: "CSCS",
     icon: <div className="bg-[#5096af] flex items-center justify-center p-[4px] rounded-full shrink-0 size-[32px]"><span className="font-['Inter',sans-serif] font-bold text-[10px] text-white">CS</span></div>,
     price: cscsPrice,
     change: cscsChange,
     sparkline: cscsSparkline.map((v) => ({ v })),
     barColor: "linear-gradient(248.572deg, rgb(80, 175, 149) 11.694%, rgb(0, 255, 185) 112.48%)",
     lineColor: "#00ffb9",
     contract: CSCS_CONTRACT,
    },
    {
     id: "cscr",
     name: "CSCR",
     icon: <div className="bg-[#fffdfd] flex items-center justify-center p-[4px] rounded-full shrink-0 size-[32px]"><span className="font-['Inter',sans-serif] font-bold text-[10px] text-[#333]">CR</span></div>,
     price: cscrPrice,
     change: cscrChange,
     sparkline: cscrSparkline.map((v) => ({ v })),
     barColor: "linear-gradient(248.572deg, rgb(251, 3, 92) 11.694%, rgb(250, 159, 165) 112.48%)",
     lineColor: "#fb035c",
     contract: CSCR_CONTRACT,
    },
   ];

   setTokens(result);
   setLoading(false);
  } catch {
   // Full fallback with mock data
   const genSparkline = (base: number, volatility: number) => {
    const points: { v: number }[] = [];
    let sparkValue = base;
    for (let i = 0; i < 30; i++) {
     sparkValue += (Math.random() - 0.48) * volatility;
     sparkValue = Math.max(base * 0.8, Math.min(base * 1.2, sparkValue));
     points.push({ v: sparkValue });
    }
    return points;
   };

   setTokens([
    { id: "ethereum", name: "Ethereum", icon: <EthereumLogo />, price: 0, change: 0, sparkline: genSparkline(0, 60), barColor: "linear-gradient(to right, #5cff9c, #00ffa3)", lineColor: "#00ffa3" },
    { id: "bitcoin", name: "Bitcoin", icon: <BitcoinLogo />, price: 63542.12, change: 3.17, sparkline: genSparkline(63542, 800), barColor: "linear-gradient(248.572deg, rgb(251, 3, 245) 11.694%, rgb(170, 156, 255) 112.48%)", lineColor: "#aa9cff" },
    { id: "cscs", name: "CSCS", icon: <div className="bg-[#5096af] flex items-center justify-center p-[4px] rounded-full shrink-0 size-[32px]"><span className="font-['Inter',sans-serif] font-bold text-[10px] text-white">CS</span></div>, price: 1.02, change: 0.49, sparkline: genSparkline(1.02, 0.02), barColor: "linear-gradient(248.572deg, rgb(80, 175, 149) 11.694%, rgb(0, 255, 185) 112.48%)", lineColor: "#00ffb9", contract: CSCS_CONTRACT },
    { id: "cscr", name: "CSCR", icon: <div className="bg-[#fffdfd] flex items-center justify-center p-[4px] rounded-full shrink-0 size-[32px]"><span className="font-['Inter',sans-serif] font-bold text-[10px] text-[#333]">CR</span></div>, price: 0.572, change: -1.89, sparkline: genSparkline(0.572, 0.015), barColor: "linear-gradient(248.572deg, rgb(251, 3, 92) 11.694%, rgb(250, 159, 165) 112.48%)", lineColor: "#fb035c", contract: CSCR_CONTRACT },
   ]);
   setLoading(false);
  }
 }, [chainId]);

 useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 60000);
  return () => clearInterval(interval);
 }, [fetchData]);

 return { tokens, loading, refetch: fetchData };
}

function formatPrice(price: number) {
 if (price >= 1000) return `$ ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
 if (price >= 1) return `$ ${price.toFixed(2)}`;
 return `$ ${price.toFixed(3)}`;
}

function MarketOverview({ chainId }: { chainId: number }) {
 const { tokens, loading, refetch } = useMarketData(chainId);

 return (
  <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] sm:p-[20px]">
   <div className="flex items-center justify-between mb-[16px]">
    <p className="font-['Inter',sans-serif] font-medium text-[18px] sm:text-[20px] text-white">MARKET OVERVIEW</p>
    <button
     onClick={() => {
      refetch();
      toast("Refreshing market data...");
     }}
     className="text-[#86909c] hover:text-white cursor-pointer transition-colors font-['Inter',sans-serif] text-[14px]"
     title="Refresh"
    >
     ↻
    </button>
   </div>

   {loading ? (
    <div className="flex items-center justify-center py-[20px]">
     <div className="w-[16px] h-[16px] border-2 border-[#0FC6C2] border-t-transparent rounded-full animate-spin" />
     <p className="font-['Inter',sans-serif] text-[13px] text-[#86909c] ml-[8px]">Loading prices...</p>
    </div>
   ) : (
    <div className="flex flex-col gap-[14px]">
     {tokens.map((token) => {
      const positive = token.change >= 0;
      const changeStr = `${positive ? "+" : ""}${token.change.toFixed(2)}%`;
      const barWidth = `${Math.min(90, Math.max(10, 50 + token.change * 5))}%`;

      return (
       <div key={token.id} className="flex flex-col">
        <div className="flex items-center gap-[10px]">
         {token.icon}
         <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
           <p className="font-['Inter',sans-serif] font-semibold text-[15px] text-white">{token.name}</p>
           <p className="font-['Inter',sans-serif] font-semibold text-[15px] text-white text-right">{formatPrice(token.price)}</p>
          </div>
         </div>
        </div>

        {/* Mini sparkline chart */}
        <div className="pl-[42px]">
         <MiniSparkline data={token.sparkline} color={token.lineColor} positive={positive} />
         <div className="flex items-center gap-[8px] mt-[2px]">
          <div className="flex-1 h-[6px] bg-[#353535] rounded-full relative">
           <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500" style={{ width: barWidth, background: token.barColor }} />
          </div>
          <p className={`font-['Inter',sans-serif] font-medium text-[13px] text-right min-w-[55px] ${positive ? "text-[#00ffa3]" : "text-[#fb035c]"}`}>{changeStr}</p>
         </div>
        </div>
       </div>
      );
     })}
    </div>
   )}

   {/* Live indicator */}
   {!loading && (
    <div className="flex items-center gap-[6px] mt-[12px] pt-[10px] border-t border-white/5">
     <div className="w-[5px] h-[5px] rounded-full bg-[#00ffa3] animate-pulse" />
     <p className="font-['Inter',sans-serif] text-[10px] text-[#86909c]">Live via CoinGecko &middot; 60s refresh</p>
    </div>
   )}
  </div>
 );
}

/* Token badge gradient helper (shared with ActionCard) */
function tokenBadgeBg(symbol: string) {
 switch (symbol) {
  case "ETH": return "linear-gradient(144.638deg, rgb(255, 255, 255) 6.1321%, rgba(217, 217, 217, 0.71) 99.078%)";
  case "CSCS": return "linear-gradient(144.638deg, #5096af 6.1321%, #00ffb9 99.078%)";
  case "CSCR": return "linear-gradient(144.638deg, #fffdfd 6.1321%, #ffa0a5 99.078%)";
  default: return "";
 }
}

/* Wallet Address */

/* Profile Mini Card (shown in sidebar) */

function ProfileMiniCard() {
 const { profile, isConnected } = useUserProfile();
 const { isDark } = useTheme();
 const tc = themeColors(isDark);

 return (
  <div className="backdrop-blur-[10px] bg-[#2c2c2c]/60 rounded-[16px] p-[20px] flex items-center gap-[14px]">
   <div className="size-[52px] shrink-0 rounded-full overflow-hidden border-2 border-[rgba(0,170,255,0.4)]">
    <img
     alt="Profile"
     className="size-full object-cover"
     src={profile.avatarUrl || DEFAULT_AVATAR_PATH}
    />
   </div>
   <div className="flex-1 min-w-0">
    <p className="font-['Inter',sans-serif] font-bold text-[16px] text-white truncate">{profile.displayName}</p>
    <p className="font-['Inter',sans-serif] text-[12px] text-[#86909c] truncate">
     {isConnected ? (profile.email || "Edit profile to add email") : "Connect wallet to edit"}
    </p>
   </div>
   {!isConnected && (
    <div className="shrink-0">
     <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#666" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
     </svg>
    </div>
   )}
  </div>
 );
}

function WalletAddress() {
 const { address, loading } = useWagmiSession();

 return (
  <div className="backdrop-blur-[10px] bg-[#2c2c2c]/60 rounded-[16px] p-[20px]">
   <div className="flex items-center justify-between mb-[12px]">
    <p className="font-['Inter',sans-serif] font-bold text-[16px] text-white tracking-[0.16px]">WALLET ADDRESS</p>
    {/* TODO: Crypto dropdown wallet address feature - temporarily disabled */}
    {/* <div className="relative">
     <button
      type="button"
      onClick={() => setDropdownOpen(!dropdownOpen)}
      className="flex items-center gap-[4px] bg-[rgba(0,0,0,0.4)] rounded-[25px] pl-[5px] pr-[10px] py-[5px] cursor-pointer hover:bg-[rgba(0,0,0,0.6)] transition-colors"
     >
      <div
       className="flex items-center justify-center p-[5px] rounded-full shrink-0 size-[22px]"
       style={{ backgroundImage: tokenBadgeBg(selectedToken) }}
      >
       {activeWalletToken.icon}
      </div>
      <p className="font-['Inter',sans-serif] font-medium text-[12px] text-white">{selectedToken}</p>
      <ChevronDownIcon />
     </button>
     {dropdownOpen && (
      <>
       <div className="fixed inset-0 z-[40]" onClick={() => setDropdownOpen(false)} />
       <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-[50] bg-[#2b2b2b] border border-white/10 rounded-[12px] p-[8px] min-w-[260px] shadow-xl">
        {walletTokens.map((t) => (
         <button
          key={t.symbol}
          type="button"
          onClick={() => { setSelectedToken(t.symbol); setDropdownOpen(false); }}
          className={`flex items-center gap-[12px] w-full px-[12px] py-[10px] rounded-[8px] cursor-pointer transition-colors ${
           selectedToken === t.symbol ? "bg-white/10" : "hover:bg-white/5"
          }`}
         >
          <div
           className="flex items-center justify-center rounded-full shrink-0 size-[24px]"
           style={{ backgroundImage: tokenBadgeBg(t.symbol) }}
          >
           {t.icon}
          </div>
          <div className="flex-1 min-w-0">
           <p className="font-['Inter',sans-serif] font-medium text-[13px] text-white truncate">{t.symbol}</p>
           <p className="font-['Inter',sans-serif] text-[11px] text-[#86909c] truncate">
            {portfolio.loading ? "..." : t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
           </p>
          </div>
          {selectedToken === t.symbol && (
           <div className="shrink-0 w-[6px] h-[6px] rounded-full" style={{ backgroundColor: t.color }} />
          )}
         </button>
        ))}
       </div>
      </>
     )}
    </div> */}
   </div>
   {loading ? (
    <div className="bg-[#2b2b2b] rounded-[12px] h-[32px] flex items-center justify-center">
     <span className="inline-block w-[120px] h-[14px] bg-white/10 rounded animate-pulse" />
    </div>
   ) : !address ? (
    <a
     href="/app/?connect=1"
     target="_top"
     className="bg-[#0FC6C2]/20 rounded-[12px] h-[32px] flex items-center justify-center px-[10px] w-full cursor-pointer hover:bg-[#0FC6C2]/30 transition-colors"
    >
     <p className="font-['Poppins',sans-serif] font-semibold text-[14px] text-[#0FC6C2]">Connect Account</p>
    </a>
   ) : (
    <>
     <div className="bg-[#2b2b2b] rounded-[12px] min-h-[32px] flex items-center justify-center px-[10px] w-full transition-colors group">
      <Address address={address} />
     </div>
     <a
      href={`https://etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-[6px] mt-[8px] text-[#86909c] hover:text-[#0FC6C2] transition-colors"
     >
      <p className="font-['Inter',sans-serif] text-[11px]">View on Etherscan</p>
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
       <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
     </a>
    </>
   )}
  </div>
 );
}

/* Join Community */

function JoinCommunity() {
 const [joined, setJoined] = useState(false);

 return (
  <div className="backdrop-blur-[10px] bg-[#2c2c2c]/60 rounded-[16px] p-[20px] flex flex-col items-center">
   <div className="flex items-center justify-center gap-[8px] mb-[4px]">
    <p className="font-['Inter',sans-serif] font-bold text-[16px] text-white tracking-[0.16px]">Join Our Community</p>
    <div className="size-[17px] relative shrink-0">
     <img alt="Wealth Wards" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={logoIcon} />
    </div>
   </div>
   <p className="font-['Inter',sans-serif] font-normal text-[16px] text-white text-center tracking-[0.16px] mb-[12px]">CRYPTOSAVERS CLUB</p>
   <a
    href="https://cryptosaversclub.com/"
    target="_blank"
    rel="noopener noreferrer"
    onClick={() => {
     if (!joined) {
      setJoined(true);
      toast.success("Welcome to CryptoSavers Club!");
     }
    }}
    className="inline-block"
   >
    <Button
     size="md"
     variant={joined ? "gradient-primary" : "primary"}
     className="w-full"
    >
     {joined ? "Joined " : "Join Now"}
    </Button>
   </a>
  </div>
 );
}

/* User Assets Table */

function UserAssetsTable({ assets, loading, ethHoldings, ethPrice }: { assets: any[]; loading: boolean; ethHoldings: number; ethPrice: number }) {
 if (loading) {
  return (
   <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[20px] animate-pulse">
    <div className="h-[20px] bg-white/10 w-[150px] mb-[15px] rounded" />
    <div className="space-y-[10px]">
     {[1, 2, 3].map(i => <div key={i} className="h-[40px] bg-white/5 rounded" />)}
    </div>
   </div>
  );
 }

 // Combine ETH with other assets for a full list
 const allAssets = [
  { symbol: 'ETH', name: 'Ethereum', balance: ethHoldings.toString(), contractAddress: 'native', logo: null, price: ethPrice },
  ...assets
 ];

 return (
  <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] sm:p-[20px]">
   <p className="font-['Inter',sans-serif] font-medium text-[18px] text-white mb-[16px]">YOUR ASSETS</p>
   <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
     <thead>
      <tr className="border-b border-white/10">
       <th className="py-[10px] font-['Inter',sans-serif] text-[12px] text-[#86909c] font-medium">ASSET</th>
       <th className="py-[10px] font-['Inter',sans-serif] text-[12px] text-[#86909c] font-medium text-right">BALANCE</th>
       <th className="py-[10px] font-['Inter',sans-serif] text-[12px] text-[#86909c] font-medium text-right hidden sm:table-cell">CONTRACT</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-white/5">
      {allAssets.map((asset, i) => {
       const addr = asset.contractAddress;
       const displayAddr = addr === 'native' ? 'Native' : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
       const balance = parseFloat(asset.balance || '0');
       if (balance === 0 && asset.symbol !== 'CSCS' && asset.symbol !== 'CSCR' && asset.symbol !== 'ETH') return null;

       return (
        <tr key={i} className="hover:bg-white/5 transition-colors group">
         <td className="py-[12px]">
          <div className="flex items-center gap-[10px]">
           <div className="size-[32px] rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
             {asset.logo ? <img src={asset.logo} alt={asset.symbol} className="size-full object-contain" /> : <span className="text-[10px] font-bold">{(asset.symbol || '??').slice(0, 2)}</span>}
           </div>
           <div className="min-w-0">
            <p className="font-['Inter',sans-serif] font-semibold text-[14px] text-white truncate">{asset.name}</p>
            <p className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">{asset.symbol}</p>
           </div>
          </div>
         </td>
         <td className="py-[12px] text-right">
          <p className="font-['Inter',sans-serif] font-semibold text-[14px] text-white">
           {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </p>
         </td>
         <td className="py-[12px] text-right hidden sm:table-cell">
          {addr !== 'native' ? (
           <a 
            href={`https://etherscan.io/address/${addr}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-['Inter',sans-serif] text-[12px] text-[#0FC6C2] hover:underline"
            title={addr}
           >
            {displayAddr}
           </a>
          ) : (
           <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">Native</span>
          )}
         </td>
        </tr>
       );
      })}
     </tbody>
    </table>
   </div>
  </div>
 );
}

/* Dashboard Page */

export function DashboardPage() {
  const { address } = useWagmiSession();
  const portfolioData = usePortfolio();
  const { isDark } = useTheme();
  const tc = themeColors(isDark);

  const chainOptions = [
    { id: 1, label: "Mainnet" },
    { id: 11155111, label: "Sepolia" },
  ] as const;
  const currentChainLabel = chainOptions.find((c) => c.id === portfolioData.activeChainId)?.label ?? `Chain ${portfolioData.activeChainId}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px] sm:gap-[20px] w-full h-auto">
   {/* Main content – 7 columns on desktop, full width on mobile */}
   <div className="lg:col-span-7 flex flex-col gap-[16px] min-w-0">
    <div
     className="backdrop-blur-[10px] rounded-[16px] p-[16px] sm:p-[20px] transition-colors duration-300 w-full overflow-hidden"
     style={{ backgroundColor: tc.cardBg, border: `1px solid ${tc.cardBorder}` }}
    >
     <StatsRow savings={portfolioData.savings} rewards={portfolioData.rewards} apy={portfolioData.apy} loading={portfolioData.loading} chainId={portfolioData.activeChainId} />
     <div className="flex items-center gap-[12px] sm:gap-[16px] mt-[16px] flex-wrap">
      <p className="font-['Inter',sans-serif] font-medium text-[18px] sm:text-[24px]" style={{ color: tc.textPrimary }}>BALANCE</p>
      <div
        className="inline-flex items-center gap-[8px] rounded-[999px] px-[8px] py-[4px]"
        style={{ backgroundColor: isDark ? 'rgba(176,176,176,0.10)' : 'rgba(79,70,229,0.08)', border: `1px solid ${tc.cardBorder}` }}
      >
        <span className="font-['Inter',sans-serif] text-[11px] sm:text-[12px]" style={{ color: tc.textSecondary }}>
          Network
        </span>
        <span className="font-['Inter',sans-serif] font-semibold text-[11px] sm:text-[12px]" style={{ color: tc.textPrimary }}>
          {currentChainLabel}
        </span>
      </div>
      {address && (
        <label className="inline-flex items-center gap-[8px] rounded-[999px] px-[8px] py-[4px]" style={{ backgroundColor: isDark ? 'rgba(176,176,176,0.10)' : 'rgba(79,70,229,0.08)', border: `1px solid ${tc.cardBorder}` }}>
          <span className="font-['Inter',sans-serif] text-[11px] sm:text-[12px]" style={{ color: tc.textSecondary }}>
            View
          </span>
          <select
            value={portfolioData.activeChainId}
            onChange={(e) => portfolioData.setActiveChainId(Number(e.target.value))}
            className="bg-transparent font-['Inter',sans-serif] font-semibold text-[11px] sm:text-[12px] outline-none"
            style={{ color: tc.textPrimary }}
          >
            {chainOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* <EthBadge /> */}
     </div>
     <p className="font-['Inter',sans-serif] font-bold text-[24px] sm:text-[36px] lg:text-[40px] uppercase mt-[4px] break-words" style={{ color: tc.textPrimary }}>
      {portfolioData.loading ? (
       <span className="inline-block w-[140px] sm:w-[200px] h-[28px] sm:h-[36px] bg-white/10 rounded animate-pulse" />
      ) : !address ? (
       "Connect to see balance"
      ) : (
       `$ ${formatUsd(portfolioData.balance)}`
      )}
     </p>
          {!portfolioData.loading && address && (
            <>
              <p className="font-['Inter',sans-serif] text-[11px] sm:text-[13px] mt-[8px] sm:mt-[2px] break-words" style={{ color: tc.textSecondary }}>
                {portfolioData.ethHoldings.toFixed(4)} ETH @ {portfolioData.ethPrice > 0 ? `$${portfolioData.ethPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                {portfolioData.cscsHoldings > 0 && ` · ${portfolioData.cscsHoldings.toLocaleString(undefined, { maximumFractionDigits: 2 })} CSCS`}
                {portfolioData.cscrHoldings > 0 && ` · ${portfolioData.cscrHoldings.toLocaleString(undefined, { maximumFractionDigits: 2 })} CSCR`}
              </p>
              <p className="font-['Inter',sans-serif] text-[10px] sm:text-[11px] mt-[4px] break-words" style={{ color: tc.textSecondary }}>
                {portfolioData.fetchStatus === "error"
                  ? `Data fallback active · ${portfolioData.fetchMessage ?? "Failed to fetch portfolio"}`
                  : portfolioData.fetchStatus === "ok" &&
                      portfolioData.ethHoldings === 0 &&
                      portfolioData.balance === 0
                    ? ""
                  : portfolioData.fetchStatus === "ok" &&
                      !(Number.isFinite(portfolioData.ethPrice) && portfolioData.ethPrice > 0)
                    ? `Native balance loaded · ETH spot price unavailable on chain ${portfolioData.activeChainId} (set MORALIS_API_KEY so the server can fall back to WETH quotes, including mainnet when Sepolia WETH fails).`
                    : portfolioData.fetchStatus === "ok"
                      ? `Data source OK · Chain ${portfolioData.activeChainId}`
                      : `Data source ${portfolioData.fetchStatus} · Chain ${portfolioData.activeChainId}`}
              </p>
            </>
          )}
     <PriceChart chainId={portfolioData.activeChainId} />
    </div>
    <UserAssetsTable assets={portfolioData.assets} loading={portfolioData.loading} ethHoldings={portfolioData.ethHoldings} ethPrice={portfolioData.ethPrice} />
    <ActionCard portfolio={portfolioData} />
   </div>

   {/* Right sidebar – 5 columns on desktop, stacks below on mobile */}
   <div className="lg:col-span-5 flex flex-col gap-[16px] min-w-0">
    <ProfileMiniCard />
    <MarketOverview chainId={portfolioData.activeChainId} />
    <WalletAddress />
    <JoinCommunity />
   </div>
  </div>
 );
}