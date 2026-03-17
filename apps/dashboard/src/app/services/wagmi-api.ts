/**
 * Wagmi backend API — session, balance, and assets from /app/ server.
 * All requests use credentials: 'include' so the dashboard uses the same
 * session as the Wagmi app (SIWE cookie).
 */

// Resolve the API base URL. In turbo monorepo, dashboard runs on :3001 and server on :3002,
// set VITE_API_URL (or VITE_API_URL_WEB) to http://localhost:3002 so all API calls hit the server.
const API_BASE = (import.meta.env.VITE_API_URL_WEB as string) || (import.meta.env.VITE_API_URL as string) || '';

export function getApiBase(): string {
  return API_BASE || 'http://localhost:3002';
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

/** Get ERC-20 token assets for the authenticated wallet (Alchemy). */
export async function getAssetsFromBackend(address: string, chainId = 1): Promise<AssetsResponse> {
  return fetchApi<AssetsResponse>(`/api/assets?address=${encodeURIComponent(address)}&chainId=${chainId}`);
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
