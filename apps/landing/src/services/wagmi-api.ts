/* Server API base (e.g. http://localhost:3002). Used for SIWE and all backend calls. */
const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:3002";

export const getBalanceFromBackend = async (address: string) => {
  const response = await fetch(`${API_BASE}/api/balance?address=${address}`);
  return response.json();
};

export const getAssetsFromBackend = async (address: string) => {
  const response = await fetch(`${API_BASE}/api/assets?address=${address}`);
  return response.json();
};

export const WagmiAPI = {
  getSiweMessage: async (address: string) => {
    const res = await fetch(`${API_BASE}/api/siwe/message?address=${encodeURIComponent(address)}&uri=${encodeURIComponent(window.location.origin)}`);
    return res.json();
  },
  verifySiweMessage: async (message: string, signature: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/siwe/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
  }
}