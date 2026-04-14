/**
 * web3-config.js — Singleton Wagmi configuration
 *
 * Web     → Standard @wagmi/core createConfig with the injected connector.
 * Electron → @reown/appkit + WagmiAdapter for WalletConnect QR modal.
 *
 * This module is the SINGLE place where the Wagmi config is created.
 * It is imported by main.js (and potentially other entry points).
 * Because ES modules are evaluated exactly once, the init code below
 * only runs once — no matter how many files import this module.
 */

import { createConfig } from '@wagmi/core'
import { injected } from '@wagmi/connectors'
import { http } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

/** Alchemy when key is set; otherwise chain default HTTP RPCs (no API key). */
function buildTransports(alchemyKey) {
  if (alchemyKey) {
    return {
      [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
      [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`),
    }
  }
  return {
    [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
    [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
  }
}

// Environment detection (hardened)
// Prefer process.versions.electron, fallback to UA check.
// You can force-disable Reown/AppKit on web with: VITE_FORCE_WEB_CONNECTOR_ONLY=true
const hasElectronProcess =
  typeof window !== 'undefined' &&
  !!window.process?.versions?.electron

const uaHasElectron =
  typeof navigator !== 'undefined' &&
  /Electron/i.test(navigator.userAgent || '')

const forceWebConnectorOnly =
  String(import.meta.env.VITE_FORCE_WEB_CONNECTOR_ONLY || 'false').toLowerCase() === 'true'

const IS_ELECTRON = !forceWebConnectorOnly && (hasElectronProcess || uaHasElectron)

// Exported state
/** @type {import('@wagmi/core').Config | null} */
export let config = null

export let walletEnabled = false

/** @type {{ open(): Promise<void>, close(): Promise<void> } | null} */
export let appKitModal = null

export { IS_ELECTRON }

// Singleton guard — Vite HMR can re-execute top-level code.
// globalThis._WAGMI_INIT prevents double init.
if (globalThis._WAGMI_INIT) {
  config = globalThis._wagmiConfig ?? null
  appKitModal = globalThis._appKitModal ?? null
  walletEnabled = !!config
} else {
  globalThis._WAGMI_INIT = true

  try {
    if (IS_ELECTRON) {
      // ── Electron: AppKit modal (WalletConnect QR / external wallet) ──

      const { createAppKit } = await import('@reown/appkit')
      const { WagmiAdapter } = await import('@reown/appkit-adapter-wagmi')
      const { siweConfig } = await import('./siwe-config.ts')

      const projectId = import.meta.env.VITE_REOWN_PROJECT_ID
      if (!projectId) {
        const errorMsg = 'FATAL: VITE_REOWN_PROJECT_ID env var missing. Electron AppKit requires this. Check .env and vite.config.js'
        console.error('[web3-config]', errorMsg)
        throw new Error(errorMsg)
      }

      const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || ''
      const wagmiAdapter = new WagmiAdapter({
        projectId,
        networks: [mainnet, sepolia],
        transports: buildTransports(alchemyKey),
      })

      config = wagmiAdapter.wagmiConfig
      appKitModal = createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: [mainnet, sepolia],
        features: { analytics: false },
        siweConfig,
      })

      globalThis._appKitModal = appKitModal
    } else {
      // ── Web: injected connector only (MetaMask / browser extension) ──
      // Electron must NEVER reach this branch.
      const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || ''
      config = createConfig({
        chains: [mainnet, sepolia],
        connectors: [injected()],
        transports: buildTransports(alchemyKey),
      })

    }

    walletEnabled = true
    globalThis._wagmiConfig = config
  } catch (err) {
    console.error('[web3-config]  FATAL: Failed to initialise Web3 config:', err)
    walletEnabled = false
    globalThis._wagmiConfig = null
    globalThis._appKitModal = null
  }
}
