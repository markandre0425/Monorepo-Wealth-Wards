import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useWagmiSession } from "../hooks/useWagmiSession";
import { getTransactionsFromBackend, type TransactionItem } from "../services/wagmi-api";

/* Types */

interface Transaction {
  id: string;
  hash: string;
  type: "send" | "receive" | "swap" | "contract";
  asset: string;
  amount: string;
  to: string;
  from: string;
  date: string;
  time: string;
  status: "completed" | "pending" | "failed";
  usd: string;
  timestamp: number;
}

/* Map backend transaction to UI shape */

function mapBackendTx(d: TransactionItem, walletAddress: string): Transaction {
  const ts = d.timestamp ? new Date(d.timestamp).getTime() : Date.now();
  const date = new Date(ts);
  const type = (d.type?.toLowerCase() || "send") as Transaction["type"];
  const amountEth = d.amountEth != null ? parseFloat(String(d.amountEth)) : 0;
  const amount = d.tokenAmount ?? (amountEth < 0.001 && amountEth > 0 ? amountEth.toFixed(6) : amountEth.toFixed(4));
  const toShort = d.toAddress ? `${d.toAddress.slice(0, 6)}...${d.toAddress.slice(-4)}` : "—";
  const fromShort = d.fromAddress ? `${d.fromAddress.slice(0, 6)}...${d.fromAddress.slice(-4)}` : "—";
  const usd = amountEth > 0 ? `$ ${(amountEth * 2800).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  return {
    id: d.id ?? (d.txHash?.slice(0, 10) ?? "tx"),
    hash: d.txHash ?? "",
    type: type === "swap" ? "swap" : type === "receive" ? "receive" : "send",
    asset: d.kind ?? "ETH",
    amount: String(amount),
    to: toShort,
    from: d.fromAddress ?? walletAddress,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    status: "completed",
    usd,
    timestamp: ts,
  };
}

/* Hook: fetch transactions from Wagmi backend when user is logged in */

function useTransactions(address: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTransactionsFromBackend(50);
      if (data?.ok && Array.isArray(data.transactions)) {
        const mapped = data.transactions.map((d) => mapBackendTx(d, address));
        mapped.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(mapped);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { transactions, loading, refetch: fetchData };
}

/* Component */

type FilterType = "all" | "send" | "receive" | "swap" | "contract";

export function TransactionsPage() {
  const { address, loading: sessionLoading } = useWagmiSession();
  const { transactions, loading, refetch } = useTransactions(address);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === "all" || tx.type === filter;
    const matchesSearch =
      searchQuery === "" ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Compute summary totals
  const totals = transactions.reduce(
    (acc, tx) => {
      const val = parseFloat(tx.usd.replace(/[^0-9.-]/g, "")) || 0;
      if (tx.type === "send") acc.sent += val;
      else if (tx.type === "receive") acc.received += val;
      else if (tx.type === "swap") acc.swaps += val;
      else if (tx.type === "contract") acc.swaps += val;
      return acc;
    },
    { sent: 0, received: 0, swaps: 0 }
  );

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Sent", value: "send" },
    { label: "Received", value: "receive" },
    { label: "Swaps", value: "swap" },
    { label: "Contracts", value: "contract" },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "send": return "↑";
      case "receive": return "↓";
      case "swap": return "⇆";
      case "contract": return "⚙";
      default: return "•";
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case "send": return "bg-[#fb035c]/20 text-[#fb035c]";
      case "receive": return "bg-[#00ffa3]/20 text-[#00ffa3]";
      case "swap": return "bg-[rgba(0,170,255,0.2)] text-[#00aaff]";
      case "contract": return "bg-[#aa9cff]/20 text-[#aa9cff]";
      default: return "bg-white/10 text-white";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed": return "text-[#00ffa3] bg-[#00ffa3]/10";
      case "pending": return "text-[#ffaa00] bg-[#ffaa00]/10";
      case "failed": return "text-[#fb035c] bg-[#fb035c]/10";
      default: return "text-white bg-white/10";
    }
  };

  const handleExportCSV = () => {
    const header = "Hash,Type,Asset,Amount,To/From,USD,Date,Time,Status\n";
    const rows = filtered.map((tx) =>
      `${tx.hash},${tx.type},${tx.asset},${tx.amount},${tx.to},${tx.usd.replace(",", "")},${tx.date},${tx.time},${tx.status}`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${address?.slice(0, 8) ?? "wallet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  return (
    <div className="flex flex-col gap-[20px] flex-1 max-w-[1100px]">
      {/* Header */}
      <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[24px]">
        <div className="flex items-center justify-between mb-[20px]">
          <div className="flex items-center gap-[12px]">
            <h2 className="font-['Inter',sans-serif] font-bold text-[24px] text-white">Transactions</h2>
          </div>
          <div className="flex items-center gap-[8px]">
            <button
              onClick={() => { refetch(); toast("Refreshing transactions..."); }}
              className="bg-[#2b2b2b] rounded-[8px] px-[12px] py-[8px] font-['Inter',sans-serif] text-[14px] text-white cursor-pointer hover:bg-[#363636] transition-colors"
              title="Refresh"
            >
              ↻
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#2b2b2b] rounded-[8px] px-[16px] py-[8px] font-['Inter',sans-serif] text-[14px] text-white cursor-pointer hover:bg-[#363636] transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Wallet badge */}
        <div className="flex items-center gap-[8px] mb-[16px]">
          <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">Wallet:</span>
          {sessionLoading ? (
            <span className="font-['Inter',sans-serif] text-[12px] text-[#86909c]">Loading...</span>
          ) : !address ? (
            <a href="/app/?connect=1" target="_top" className="font-['Inter',sans-serif] text-[12px] text-[#0FC6C2] hover:underline">
              Connect Account
            </a>
          ) : (
            <a
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Inter',sans-serif] text-[12px] text-[#0FC6C2] hover:underline"
            >
              {address.slice(0, 6)}...{address.slice(-4)}
            </a>
          )}
          <span className="font-['Inter',sans-serif] text-[11px] text-[#86909c]">· Ethereum Mainnet</span>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-[12px] flex-wrap">
          <div className="flex items-center gap-[4px] bg-[#2b2b2b] rounded-[12px] p-[4px]">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-[14px] py-[6px] rounded-[8px] font-['Inter',sans-serif] text-[14px] cursor-pointer transition-all ${
                  filter === f.value
                    ? "bg-[rgba(0,170,255,0.5)] text-white"
                    : "text-[#86909c] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="flex-1 bg-[#2b2b2b] rounded-[12px] px-[16px] py-[8px] font-['Inter',sans-serif] text-[14px] text-white outline-none placeholder-white/40 min-w-[200px]"
            placeholder="Search by hash, asset, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex gap-[12px]">
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] flex-1">
          <p className="font-['Inter',sans-serif] font-normal text-[14px] text-[#86909c] mb-[4px]">Total Sent</p>
          <p className="font-['Inter',sans-serif] font-bold text-[20px] text-[#fb035c]">
            $ {totals.sent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] flex-1">
          <p className="font-['Inter',sans-serif] font-normal text-[14px] text-[#86909c] mb-[4px]">Total Received</p>
          <p className="font-['Inter',sans-serif] font-bold text-[20px] text-[#00ffa3]">
            $ {totals.received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] p-[16px] flex-1">
          <p className="font-['Inter',sans-serif] font-normal text-[14px] text-[#86909c] mb-[4px]">Contracts / Swaps</p>
          <p className="font-['Inter',sans-serif] font-bold text-[20px] text-[#00aaff]">
            $ {totals.swaps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="backdrop-blur-[10px] bg-[#1c1c1c]/60 rounded-[16px] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center px-[24px] py-[12px] border-b border-white/5">
          <div className="w-[50px] font-['Inter',sans-serif] text-[12px] text-[#86909c]">Type</div>
          <div className="w-[120px] font-['Inter',sans-serif] text-[12px] text-[#86909c]">Hash</div>
          <div className="flex-1 font-['Inter',sans-serif] text-[12px] text-[#86909c]">Asset</div>
          <div className="w-[150px] font-['Inter',sans-serif] text-[12px] text-[#86909c]">To / From</div>
          <div className="w-[140px] font-['Inter',sans-serif] text-[12px] text-[#86909c] text-right">Amount</div>
          <div className="w-[120px] font-['Inter',sans-serif] text-[12px] text-[#86909c] text-right">USD Value</div>
          <div className="w-[140px] font-['Inter',sans-serif] text-[12px] text-[#86909c] text-right">Date</div>
          <div className="w-[100px] font-['Inter',sans-serif] text-[12px] text-[#86909c] text-right">Status</div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-[40px] gap-[8px]">
            <div className="w-[16px] h-[16px] border-2 border-[#0FC6C2] border-t-transparent rounded-full animate-spin" />
            <p className="font-['Inter',sans-serif] text-[14px] text-[#86909c]">Loading transactions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-[40px]">
            <p className="font-['Inter',sans-serif] text-[16px] text-[#86909c]">No transactions found</p>
          </div>
        ) : (
          filtered.map((tx) => (
            <a
              key={tx.hash + tx.asset + tx.timestamp}
              href={`https://etherscan.io/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-[24px] py-[14px] w-full border-b border-white/5 last:border-b-0 hover:bg-white/[0.04] cursor-pointer transition-colors text-left no-underline"
            >
              <div className="w-[50px]">
                <div className={`size-[32px] rounded-full flex items-center justify-center text-[14px] ${getTypeBg(tx.type)}`}>
                  {getTypeIcon(tx.type)}
                </div>
              </div>
              <div className="w-[120px] font-['Inter',sans-serif] font-medium text-[14px] text-white/60 truncate" title={tx.hash}>
                {tx.hash.slice(0, 8)}...{tx.hash.slice(-4)}
              </div>
              <div className="flex-1 font-['Inter',sans-serif] font-semibold text-[14px] text-white">{tx.asset}</div>
              <div className="w-[150px] font-['Inter',sans-serif] font-normal text-[14px] text-white/60">{tx.to}</div>
              <div className="w-[140px] font-['Inter',sans-serif] font-semibold text-[14px] text-white text-right">{tx.amount}</div>
              <div className="w-[120px] font-['Inter',sans-serif] font-normal text-[14px] text-[#86909c] text-right">{tx.usd}</div>
              <div className="w-[140px] font-['Inter',sans-serif] font-normal text-[12px] text-[#86909c] text-right">
                <div>{tx.date}</div>
                <div>{tx.time}</div>
              </div>
              <div className="w-[100px] text-right">
                <span className={`inline-block px-[8px] py-[2px] rounded-[6px] font-['Inter',sans-serif] text-[12px] capitalize ${getStatusStyle(tx.status)}`}>
                  {tx.status}
                </span>
              </div>
            </a>
          ))
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-[24px] py-[10px] border-t border-white/5">
            <p className="font-['Inter',sans-serif] text-[10px] text-[#86909c]">
              Click any row to view on Etherscan
            </p>
            <p className="font-['Inter',sans-serif] text-[11px] text-[#86909c]">
              {filtered.length} of {transactions.length} transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
