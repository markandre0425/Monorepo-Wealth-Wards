import { createSIWEConfig, formatMessage } from '@reown/appkit-siwe'

// The landing page vite config proxies /api/ to the backend server (port 3002).
const API_BASE = '/api'

export const siweConfig = createSIWEConfig({
  getMessageParams: async () => {
    // Return params mapping to the backend's expected SIWE format
    return {
      domain: window.location.host,
      uri: window.location.origin,
      chains: [1, 11155111],
      statement: 'Sign in to Wealth Wards.'
    }
  },
  
  createMessage: ({ address, ...args }: { address: string; nonce: string; chainId: number; domain: string; uri: string; version?: string; statement?: string }) => {
    return formatMessage(args, address)
  },
  
  getNonce: async () => {
    const res = await fetch(`${API_BASE}/siwe/nonce`)
    if (!res.ok) throw new Error('Failed to fetch nonce')
    const { nonce } = await res.json()
    return nonce
  },
  
  getSession: async () => {
    try {
      // Source of truth: wallet session endpoint includes address + chainId from SIWE JWT.
      const walletRes = await fetch(`${API_BASE}/walletAddress`, { credentials: 'include' })
      if (walletRes.ok) {
        const wallet = await walletRes.json()
        if (wallet?.ok && wallet?.address) {
          return { address: wallet.address, chainId: Number(wallet.chainId ?? 1) }
        }
      }

      // Fallback: profile endpoint may still be useful in some auth flows.
      const profileRes = await fetch(`${API_BASE}/user/profile`, { credentials: 'include' })
      if (!profileRes.ok) return null
      const { profile } = await profileRes.json()
      if (profile && profile.address) {
        return { address: profile.address, chainId: Number(profile.chainId ?? 1) }
      }
    } catch {
      return null
    }
    return null
  },
  
  verifyMessage: async ({ message, signature }) => {
    try {
      // Send the signature to backend for validation.
      const res = await fetch(`${API_BASE}/siwe/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, signature }),
      })
      
      if (!res.ok) {
        console.error('SIWE Verify HTTP error:', res.status)
        return false
      }
      const session = await res.json()
      // Backend returns { ok: true, balance } on success (no separate `address` field)
      return Boolean(session.ok)
    } catch (error) {
      console.error('SIWE Verify Failed:', error)
      return false
    }
  },
  
  signOut: async () => {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST' })
      return true
    } catch {
      return false
    }
  }
})
