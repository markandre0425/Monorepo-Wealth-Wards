/**
 * Dashboard blockchain data service.
 *
 * Server-first design:
 * - Uses backend API endpoints for prices/balance data
 * - Avoids direct browser calls to Moralis/Alchemy/Etherscan with API keys
 */

import { getApiBase } from './wagmi-api';

// Known token id -> mainnet contract address (backend price endpoint expects token address)
const TOKEN_ID_TO_ADDRESS: Record<string, string> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  bitcoin: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
};

interface TokenData {
  symbol: string;
  name: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  contractAddress?: string;
}

interface BalanceData {
  address: string;
  balance: string;
  balanceUSD?: number;
}

async function fetchBackendJson<T>(path: string): Promise<T | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, { credentials: 'include' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Legacy helper kept for compatibility with hooks.
// Uses backend price endpoint only (no client-side provider keys).
export async function getTokenData(contractAddress: string, chainId = 1): Promise<TokenData> {
  const normalized = (contractAddress || '').toLowerCase();
  const data = await fetchBackendJson<{ ok: boolean; prices?: Record<string, { price?: number; change24h?: number }> }>(
    `/api/token-prices?addresses=${encodeURIComponent(normalized)}&chainId=${chainId}`,
  );

  const point = data?.ok ? data.prices?.[normalized] : undefined;
  return {
    symbol: normalized ? normalized.slice(2, 6).toUpperCase() : 'TOKEN',
    name: 'Token',
    contractAddress,
    price: point?.price,
    priceChange24h: point?.change24h,
  };
}

// Legacy helper kept for compatibility with hooks.
// Reads authenticated wallet balance from backend (/api/balance).
export async function getBalance(address: string, chainId = 1): Promise<BalanceData> {
  const data = await fetchBackendJson<{ ok: boolean; balance?: string }>(`/api/balance?chainId=${chainId}`);
  return {
    address,
    balance: data?.ok && data.balance != null ? String(data.balance) : '0',
  };
}

async function getBackendTokenPrice(asset: string, chainId = 1): Promise<{ price?: number; change24h?: number } | null> {
  const data = await fetchBackendJson<{ ok: boolean; price?: number | null; change24h?: number | null }>(
    `/api/token-price?address=${encodeURIComponent(asset)}&chainId=${chainId}`,
  );
  if (!data?.ok) return null;
  const price =
    data.price != null && Number.isFinite(Number(data.price)) ? Number(data.price) : undefined;
  const change24h =
    data.change24h != null && Number.isFinite(Number(data.change24h)) ? Number(data.change24h) : undefined;
  return { price, change24h };
}

function hasPositiveFiniteSpot(r: { price?: number } | null | undefined): boolean {
  const spotPrice = r?.price;
  return spotPrice != null && Number.isFinite(spotPrice) && spotPrice > 0;
}

/** Same server, different handler — portfolio logs showed token-price empty while token-prices had ETH. */
async function getNativeSpotFromTokenPrices(
  asset: 'ethereum' | 'bitcoin',
  chainId: number,
): Promise<{ price?: number; change24h?: number } | null> {
  const data = await fetchBackendJson<{ ok: boolean; prices?: Record<string, { price?: number; change24h?: number }> }>(
    `/api/token-prices?addresses=${encodeURIComponent(asset)}&chainId=${chainId}`,
  );
  const pt = data?.ok ? data.prices?.[asset] : undefined;
  if (!pt) return null;
  const price = pt.price != null && Number.isFinite(Number(pt.price)) ? Number(pt.price) : undefined;
  const change24h =
    pt.change24h != null && Number.isFinite(Number(pt.change24h)) ? Number(pt.change24h) : undefined;
  return { price, change24h };
}

const LLAMA_COIN_KEY: Record<'ethereum' | 'bitcoin', string> = {
  ethereum: 'coingecko:ethereum',
  bitcoin: 'coingecko:bitcoin',
};

/** Browser-safe when our server has no quotes (CORS * on coins.llama.fi). Display / estimate only. */
async function getNativeSpotFromLlama(asset: 'ethereum' | 'bitcoin'): Promise<{ price?: number } | null> {
  const coin = LLAMA_COIN_KEY[asset];
  try {
    const res = await fetch(`https://coins.llama.fi/prices/current/${encodeURIComponent(coin)}`);
    if (!res.ok) return null;
    const llamaResponse = (await res.json()) as { coins?: Record<string, { price?: number }> };
    const rawCoinPrice = llamaResponse?.coins?.[coin]?.price;
    const price = rawCoinPrice != null && Number.isFinite(Number(rawCoinPrice)) ? Number(rawCoinPrice) : undefined;
    return price != null && price > 0 ? { price } : null;
  } catch {
    return null;
  }
}

export async function getTokenPrice(tokenId: string = 'ethereum', chainId = 1): Promise<{ price?: number; change24h?: number }> {
  const normalized = tokenId.toLowerCase();
  const requestAsset = normalized === 'ethereum' || normalized === 'bitcoin'
    ? normalized
    : (TOKEN_ID_TO_ADDRESS[normalized] || (tokenId.startsWith('0x') ? tokenId : null));

  if (!requestAsset) return {};
  const fromSingle = (await getBackendTokenPrice(requestAsset, chainId)) ?? {};

  if (
    (requestAsset === 'ethereum' || requestAsset === 'bitcoin') &&
    !hasPositiveFiniteSpot(fromSingle)
  ) {
    const fromBatch = await getNativeSpotFromTokenPrices(requestAsset, chainId);
    if (hasPositiveFiniteSpot(fromBatch)) {
      return {
        price: fromBatch!.price,
        change24h: fromBatch!.change24h ?? fromSingle.change24h,
      };
    }

    const fromLlama = await getNativeSpotFromLlama(requestAsset);
    if (hasPositiveFiniteSpot(fromLlama)) {
      return {
        price: fromLlama!.price,
        change24h: fromSingle.change24h,
      };
    }
  }

  return fromSingle;
}

export async function getMultipleTokenPrices(tokenIds: string[], chainId = 1): Promise<Record<string, { price?: number; change24h?: number }>> {
  if (!tokenIds?.length) return {};

  const requestKeys = tokenIds
    .map((id) => {
      const normalized = id.toLowerCase();
      if (normalized === 'ethereum' || normalized === 'bitcoin') return normalized;
      return TOKEN_ID_TO_ADDRESS[normalized] || (id.startsWith('0x') ? id.toLowerCase() : null);
    })
    .filter(Boolean) as string[];

  if (!requestKeys.length) return {};

  const data = await fetchBackendJson<{ ok: boolean; prices?: Record<string, { price?: number; change24h?: number }> }>(
    `/api/token-prices?addresses=${requestKeys.join(',')}&chainId=${chainId}`,
  );

  if (!data?.ok || !data.prices) return {};

  const byAddress = data.prices;
  const result: Record<string, { price?: number; change24h?: number }> = {};
  tokenIds.forEach((id) => {
    const normalized = id.toLowerCase();
    const key = normalized === 'ethereum' || normalized === 'bitcoin'
      ? normalized
      : (TOKEN_ID_TO_ADDRESS[normalized] || (id.startsWith('0x') ? id.toLowerCase() : null));
    if (key && byAddress[key]) result[id] = byAddress[key];
  });

  return result;
}

export const BlockchainAPI = {
  getTokenData,
  getBalance,
  getTokenPrice,
  getMultipleTokenPrices,
};

export default BlockchainAPI;
