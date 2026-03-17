const API_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_URL) ||
  "http://localhost:3002";

export const getBalanceFromBackend = async (address: string) => {
  const response = await fetch(`${API_URL}/api/balance?address=${address}`);
  return response.json();
};

export const getAssetsFromBackend = async (address: string) => {
  const response = await fetch(`${API_URL}/api/assets?address=${address}`);
  return response.json();
};