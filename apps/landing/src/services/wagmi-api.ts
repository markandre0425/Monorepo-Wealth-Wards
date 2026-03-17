/* Server API base (e.g. http://localhost:3002). Used for SIWE and all backend calls. */
const IS_ELECTRON = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
const API_BASE = IS_ELECTRON 
  ? (import.meta.env.VITE_API_URL_ELECTRON as string) || "http://localhost:3002"
  : (import.meta.env.VITE_API_URL as string) || "http://localhost:3002";

// Helper to add Electron header if needed
const getHeaders = (headers: any = {}) => {
  const h = { ...headers };
  if (IS_ELECTRON) {
    h['x-electron-app'] = '1';
  }
  return h;
};

export const getBalanceFromBackend = async (address: string) => {
  const response = await fetch(`${API_BASE}/api/balance?address=${address}`, {
    headers: getHeaders(),
    credentials: 'include'
  });
  return response.json();
};

export const getAssetsFromBackend = async (address: string) => {
  const response = await fetch(`${API_BASE}/api/assets?address=${address}`, {
    headers: getHeaders(),
    credentials: 'include'
  });
  return response.json();
};

export const WagmiAPI = {
  getSiweMessage: async (address: string) => {
    const res = await fetch(`${API_BASE}/api/siwe/message?address=${encodeURIComponent(address)}&uri=${encodeURIComponent(window.location.origin)}`, {
      headers: getHeaders(),
      credentials: 'include'
    });
    return res.json();
  },
  verifySiweMessage: async (message: string, signature: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/siwe/verify`, {
        method: 'POST',
        headers: getHeaders({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
        body: JSON.stringify({ message, signature }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Server shouted No:", errorData);
        return { ok: false, error: errorData.error };
      }
  
      return res.json();
    } catch (err) {
      console.error("The fetch itself failed:", err);
      return { ok: false, error: "Network error" };
    }
  },
  getWalletSession: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!res.ok) return { ok: false };
      return res.json();
    } catch (err) {
      return { ok: false };
    }
  }
}