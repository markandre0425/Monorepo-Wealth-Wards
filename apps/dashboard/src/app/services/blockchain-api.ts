/**
 * Multi-provider blockchain API service with fallback logic
 * Primary: Moralis
 * Secondary: Alchemy
 * Tertiary: Etherscan
 * Price: Backend (Moralis server-side) first, CoinGecko fallback
 */

// Backend API base — same-origin by default (Vite proxy in dev, same host in prod).
// Set VITE_API_URL_WEB in production to point to the deployed API.
const API_BASE = (import.meta.env.VITE_API_URL_WEB as string) || (import.meta.env.VITE_API_URL as string) || '';

// Known token id -> mainnet contract address (for backend /api/token-price which uses contract address)
const TOKEN_ID_TO_ADDRESS: Record<string, string> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  bitcoin: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
};

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY;
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;

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

// MORALIS API
async function getMoralisTokenData(contractAddress: string): Promise<TokenData | null> {
  try {
    if (!MORALIS_API_KEY) return null;

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/metadata?chain=eth`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      symbol: data.symbol || '',
      name: data.name || '',
      contractAddress: data.address,
    };
  } catch {
    return null;
  }
}

async function getMoralisBalance(address: string): Promise<BalanceData | null> {
  try {
    if (!MORALIS_API_KEY) return null;

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${address}/balance?chain=eth`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      address,
      balance: data.balance || '0',
    };
  } catch {
    return null;
  }
}

// ALCHEMY API
async function getAlchemyTokenData(contractAddress: string): Promise<TokenData | null> {
  try {
    if (!ALCHEMY_API_KEY) return null;

    const response = await fetch(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getTokenMetadata',
          params: [contractAddress],
          id: 1,
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result) {
      return {
        symbol: data.result.symbol || '',
        name: data.result.name || '',
        contractAddress: contractAddress,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function getAlchemyBalance(address: string): Promise<BalanceData | null> {
  try {
    if (!ALCHEMY_API_KEY) return null;

    const response = await fetch(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.result) {
      return {
        address,
        balance: data.result,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ETHERSCAN API
async function getEtherscanTokenData(contractAddress: string): Promise<TokenData | null> {
  try {
    if (!ETHERSCAN_API_KEY) return null;

    const response = await fetch(
      `https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === '1' && data.result) {
      return {
        symbol: data.result[0].symbol || '',
        name: data.result[0].name || '',
        contractAddress: contractAddress,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getEtherscanBalance(address: string): Promise<BalanceData | null> {
  try {
    if (!ETHERSCAN_API_KEY) return null;

    const response = await fetch(
      `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === '1') {
      return {
        address,
        balance: data.result || '0',
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Backend (Moralis server-side) — primary for price. Keys stay on server.
async function getBackendTokenPrice(contractAddress: string, chainId = 1): Promise<{ price?: number; change24h?: number } | null> {
  if (!API_BASE) return null;
  try {
    const url = `${API_BASE}/api/token-price?address=${encodeURIComponent(contractAddress)}&chainId=${chainId}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.ok && (data.price != null || data.change24h != null)) {
      return { price: data.price ?? undefined, change24h: data.change24h ?? undefined };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// CoinGecko (fallback when backend price unavailable)
async function getCoinGeckoPrice(tokenId: string): Promise<{ price?: number; change24h?: number } | null> {
  try {
    const response = await fetch(
      `/api/coingecko/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data[tokenId]) {
      return {
        price: data[tokenId].usd,
        change24h: data[tokenId].usd_24h_change,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// FALLBACK CHAIN LOGIC
export async function getTokenData(contractAddress: string): Promise<TokenData> {
  // Try providers in order
  let result = await getMoralisTokenData(contractAddress);
  if (result) return result;
  result = await getAlchemyTokenData(contractAddress);
  if (result) return result;
  result = await getEtherscanTokenData(contractAddress);
  if (result) return result;
  return { symbol: 'UNKNOWN', name: 'Unknown Token', contractAddress };
}

export async function getBalance(address: string): Promise<BalanceData> {
  // Try providers in order
  let result = await getMoralisBalance(address);
  if (result) return result;
  result = await getAlchemyBalance(address);
  if (result) return result;
  result = await getEtherscanBalance(address);
  if (result) return result;
  return { address, balance: '0' };
}

export async function getTokenPrice(tokenId: string = 'ethereum'): Promise<{ price?: number; change24h?: number }> {
  const address = TOKEN_ID_TO_ADDRESS[tokenId.toLowerCase()] || (tokenId.startsWith('0x') ? tokenId : null);
  if (address && API_BASE) {
    const result = await getBackendTokenPrice(address, 1);
    if (result) {
      return result;
    }
  }
  const result = await getCoinGeckoPrice(tokenId);
  if (result) return result;
  return {};
}

// Multi-token price fetch: backend (Moralis) first, then CoinGecko
export async function getMultipleTokenPrices(tokenIds: string[]): Promise<Record<string, { price?: number; change24h?: number }>> {
  if (API_BASE && tokenIds.length > 0) {
    const addresses = tokenIds.map((id) => TOKEN_ID_TO_ADDRESS[id.toLowerCase()] || (id.startsWith('0x') ? id : null)).filter(Boolean) as string[];
    if (addresses.length > 0) {
      try {
        const url = `${API_BASE}/api/token-prices?addresses=${addresses.join(',')}&chainId=1`;
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data?.ok && data.prices) {
            const byAddress = data.prices as Record<string, { price?: number; change24h?: number }>;
            const result: Record<string, { price?: number; change24h?: number }> = {};
            tokenIds.forEach((id) => {
              const addr = TOKEN_ID_TO_ADDRESS[id.toLowerCase()] || (id.startsWith('0x') ? id.toLowerCase() : null);
              if (addr && byAddress[addr]) result[id] = byAddress[addr];
            });
            if (Object.keys(result).length > 0) return result;
          }
        }
      } catch {
        // fallback to CoinGecko below
      }
    }
  }
  try {
    const idsParam = tokenIds.join(',');
    const response = await fetch(
      `/api/coingecko/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true`
    );
    if (!response.ok) return {};
    const data = await response.json();
    const result: Record<string, { price?: number; change24h?: number }> = {};
    for (const tokenId of tokenIds) {
      if (data[tokenId]) {
        result[tokenId] = {
          price: data[tokenId].usd,
          change24h: data[tokenId].usd_24h_change,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export const BlockchainAPI = {
  getTokenData,
  getBalance,
  getTokenPrice,
  getMultipleTokenPrices,
};

export default BlockchainAPI;
