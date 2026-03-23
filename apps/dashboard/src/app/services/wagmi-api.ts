/**
 * Wagmi backend API — session, balance, and assets from /app/ server.
 * All requests use credentials: 'include' so the dashboard uses the same
 * session as the Wagmi app (SIWE cookie).
 */

const IS_ELECTRON = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

const API_BASE = IS_ELECTRON 
  ? (import.meta.env.VITE_API_URL_ELECTRON as string) || 'http://localhost:3002'
  : (import.meta.env.VITE_API_URL_WEB as string) || (import.meta.env.VITE_API_URL as string) || '';

export function getApiBase(): string {
  return API_BASE;
}

function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { credentials: 'include', ...options }).then((res) => {
    if (!res.ok) throw new Error(res.status === 401 ? 'Not logged in' : `API ${res.status}`);
    return res.json() as Promise<T>;
  });
}

export interface WalletSession {
  ok: boolean;
  address: string | null;
  provider?: string;
  email?: string | null;
  name?: string | null;
}

export interface BalanceResponse {
  ok: boolean;
  balance: string;
  chainId?: number;
}

export interface AssetItem {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number | null;
  balance: string | null;
  rawBalance?: string;
  logo: string | null;
}

export interface AssetsResponse {
  ok: boolean;
  assets: AssetItem[];
}

export interface TransactionItem {
  id: string;
  type: string;
  address: string;
  kind?: string;
  chainId?: number;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  amountEth?: string;
  tokenAddress?: string;
  tokenAmount?: string;
  timestamp?: string;
}

export interface TransactionsResponse {
  ok: boolean;
  transactions: TransactionItem[];
}

/** Get current wallet address from session (same as /app/). Returns 401 if not logged in. */
export async function getWalletSession(): Promise<WalletSession> {
  return fetchApi<WalletSession>('/api/walletAddress');
}

/** Get native ETH balance for the authenticated wallet. */
export async function getBalanceFromBackend(chainId = 1): Promise<BalanceResponse> {
  return fetchApi<BalanceResponse>(`/api/balance?chainId=${chainId}`);
}

/** Get ERC-20 token assets from backend deep discovery endpoint. */
export async function getAssetsFromBackend(address: string, chainId: number = 1): Promise<{ ok: boolean; assets: any[] }> {
  try {
    const url = `${getApiBase()}/api/all-assets?address=${encodeURIComponent(address)}&chainId=${chainId}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Backend assets fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("getAssetsFromBackend error:", error);
    return { ok: false, assets: [] };
  }
}

/** Get transaction log for the authenticated user. */
export async function getTransactionsFromBackend(limit = 50, type?: string): Promise<TransactionsResponse> {
  let path = `/api/transactions?limit=${limit}`;
  if (type) path += `&type=${encodeURIComponent(type)}`;
  return fetchApi<TransactionsResponse>(path);
}

/** Logout and clear session. */
export async function logoutFromBackend(): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>('/api/logout', { method: 'POST' });
}

export const WagmiAPI = {
  getWalletSession,
  getBalanceFromBackend,
  getAssetsFromBackend,
  getTransactionsFromBackend,
  logoutFromBackend,
};
