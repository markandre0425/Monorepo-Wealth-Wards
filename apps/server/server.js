import dotenv from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env from the project root (root of the monorepo)
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../../.env') })

import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { isAddress, createPublicClient, http, formatEther, formatUnits, getAddress } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { SiweMessage } from 'siwe'
import { ParsedMessage } from '@spruceid/siwe-parser'
import rateLimit from 'express-rate-limit'
import Redis from 'ioredis' // optional for nonce (fallback to memory if unavailable)
import mongoose from 'mongoose' // optional for logs (fallback to file if unavailable)
import { appendFile, readFile, stat, rename, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

function getManilaTime() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date());
}

const app = express()

// SECURITY & PERFORMANCE MIDDLEWARE
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for landing/dashboard dev compatibility if needed
  crossOriginEmbedderPolicy: false
}))
app.use(compression()) // Gzip all responses

// Config trust proxy deployment env
const TRUST_PROXY_SETTING = (() => {
  const value = process.env.TRUST_PROXY;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(Number(value))) return Number(value);
  return value ?? 'loopback'; // Default to 'loopback' for local dev
})();
app.set('trust proxy', TRUST_PROXY_SETTING);

// DATABASE CONNECTIONS (optional; fallback to in-memory/file)

let redis = null
const REDIS_CONFIG = process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  retryStrategy: (times) => times > 3 ? null : Math.min(times * 100, 2000),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3
}

try {
  redis = new Redis(REDIS_CONFIG)
  redis.on('error', (err) => {
    // Only log if it's the first error to avoid spamming
    if (!redis._hasErrored) {
      console.warn('[server] Redis connection failed; falling back to memory/no-cache.', err.message)
      redis._hasErrored = true
    }
  })
  redis.on('connect', () => {
    console.log('[server] ✅ Connected to Redis')
    redis._hasErrored = false
  })
} catch (err) {
  console.error('[server] Redis init failed:', err.message)
  redis = null
}

const TRANSACTION_TYPES = Object.freeze(['Send', 'Swap', 'Receive', 'Buy'])
const ACTIVITY_TYPES = ['login', 'disconnect']

let ActivityLog = null
let TransactionLog = null
let mongoReady = false
if (process.env.MONGO_URI) {
  mongoose.connection.on('connected', () => {
    mongoReady = true
  })
  mongoose.connection.on('disconnected', () => {
    mongoReady = false
  })
  mongoose.connection.on('error', () => {
    mongoReady = false
  })

  const ActivityLogSchema = new mongoose.Schema({
    type: {
      type: String,
      required: true,
      enum: ACTIVITY_TYPES,
      set: (value) => value?.toLowerCase()
    },
    address: { type: String, required: true, index: true, lowercase: true },
    balance: { type: String },
    chainId: { type: Number },
    connectorName: { type: String },
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
    timestampLocal: { type: String, default: getManilaTime },
  })
  ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema)

  // Separate collection for transaction records (Send, Swap, Receive, Buy)
  const TransactionLogSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: [...TRANSACTION_TYPES] },
    address: { type: String, required: true, index: true, lowercase: true },
    chainId: { type: Number, default: 1 },
    connectorName: { type: String, default: null, maxlength: 50 },
    txHash: { type: String, default: null, match: /^0x[a-fA-F0-9]{64}$/, maxlength: 66 },
    fromAddress: { type: String, default: null, validate: { validator: (v) => v === null || isAddress(v), message: 'Invalid fromAddress' } },
    toAddress: { type: String, default: null, validate: { validator: (v) => v === null || isAddress(v), message: 'Invalid toAddress' } },
    amountEth: { type: String, default: null, maxlength: 50 },
    blockNumber: { type: Number, default: null },
    kind: { type: String, default: null, maxlength: 50 },
    tokenAddress: { type: String, default: null, validate: { validator: (v) => v === null || isAddress(v), message: 'Invalid tokenAddress' } },
    tokenAmount: { type: String, default: null, maxlength: 50 },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
    timestampLocal: { type: String, default: getManilaTime },
  })
  TransactionLogSchema.index({ address: 1, timestamp: -1 })
  TransactionLogSchema.index({ type: 1 })
  TransactionLog = mongoose.models.TransactionLog || mongoose.model('TransactionLog', TransactionLogSchema)
} else {
  console.log('MONGO_URI not set; activity logs will use file fallback.')
}
// ------------------------------------------------------------------

const ACTIVITY_LOG_PATH = join(__dirname, 'activity.txt')


const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const IS_PROD = process.env.NODE_ENV === 'production'

if (!IS_PROD) {
  console.log(`Trust proxy set to: ${TRUST_PROXY_SETTING}`)
}

if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me')) {
  console.error('Fatal: Set JWT_SECRET to a strong random value in production.')
  process.exit(1)
}

// Public clients for balance lookups (per chain). Sepolia default avoids rpc.sepolia.org (often slow/timeout).
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || 'oKsh3Sa8Xm98u-B_EuQSXYA5n93ZzThE'
const rpcByChain = {
  [mainnet.id]: process.env.RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  [sepolia.id]: process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
}
const publicClients = {
  [mainnet.id]: createPublicClient({ chain: mainnet, transport: http(rpcByChain[mainnet.id]) }),
  [sepolia.id]: createPublicClient({ chain: sepolia, transport: http(rpcByChain[sepolia.id]) }),
}
function getPublicClient(chainId) {
  return publicClients[chainId] ?? publicClients[mainnet.id]
}

// Client IP for logging: with trust proxy, req.ip is from X-Forwarded-For (end user);
// otherwise fallback to socket.remoteAddress (direct client or proxy IP). Normalize IPv4-mapped IPv6 to plain IPv4 only when valid (0-255 per octet).
const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)'
const IPV4_MAPPED_IPv6 = new RegExp(`^::ffff:(${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3})$`)
function getClientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown'
  const match = raw.match(IPV4_MAPPED_IPv6)
  return match ? match[1] : raw
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ ok: false, error: 'Not logged in' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const isWallet = typeof payload.sub === 'string' && payload.sub.startsWith('0x') && isAddress(payload.sub)
    req.user = {
      address: isWallet ? payload.sub : null,
      provider: payload.provider ?? null,
      email: payload.email ?? null,
      name: payload.name ?? null,
      sub: payload.sub,
    }
    return next()
  } catch (err) {
    console.error('requireAuth: JWT verification failed:', err.message)
    return res.status(401).json({ ok: false, error: 'Invalid/expired token' })
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (origin === 'null') return callback(null, true)

    const allowedManualOrigins = [
      'http://localhost:3000', // Landing
      'http://localhost:3001', // Dashboard
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

    if (allowedManualOrigins.includes(origin)) return callback(null, true);

    // Keep your existing Vite dev server logic as a backup
    if (!IS_PROD && /^http:\/\/(localhost|127\.0\.0\.1)/.test(origin)) return callback(null, true)

    return callback(null, false)
  },
  credentials: true,
}))
// Increase JSON limit to handle large avatar data URLs (up to 10MB)
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())


// UPDATED NONCE LOGIC (Redis if available, else in-memory)

const NONCE_TTL_SECONDS = 720 // 12 minutes (must match or exceed SIWE_TTL_MS + SIWE_CLOCK_SKEW_MS to prevent nonce expiry before message expiry)
const nonceMemory = new Map()

const getNonceKey = (address, nonce) => `nonce:${address.toLowerCase()}:${nonce}`

// SIWE EIP-4361 requires nonce to be 8*( ALPHA / DIGIT ) — alphanumeric only (no hyphens)
function generateSiweNonce() {
  return randomBytes(16).toString('hex')
}

async function issueNonce(address) {
  const nonce = generateSiweNonce()
  const key = getNonceKey(address, nonce)

  if (redis) {
    try {
      await redis.set(key, nonce, 'EX', NONCE_TTL_SECONDS)
      return { nonce, expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000 }
    } catch (err) {
      // Fallback to memory below if redis fails
    }
  }

  const expiresAt = Date.now() + NONCE_TTL_SECONDS * 1000
  nonceMemory.set(key, { nonce, expiresAt })
  return { nonce, expiresAt }
}

async function takeNonce(address, nonce) {
  const key = getNonceKey(address, nonce)

  if (redis) {
    try {
      // Atomic get-and-delete so two concurrent verifies cannot consume the same nonce
      const stored = await redis.getdel(key)
      if (stored) return stored === nonce ? nonce : null
    } catch (err) {
      // Fallback to memory below
    }
  }

  const entry = nonceMemory.get(key)
  nonceMemory.delete(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) return null
  return entry.nonce === nonce ? nonce : null
}

// Periodic cleanup of expired in-memory nonces (when Redis is not used)
if (!redis) {
  const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000
  setInterval(() => {
    const now = Date.now()
    const toDelete = []
    for (const [key, entry] of nonceMemory.entries()) {
      if (now > entry.expiresAt) toDelete.push(key)
    }
    for (const key of toDelete) nonceMemory.delete(key)
  }, NONCE_CLEANUP_INTERVAL_MS)
}
// ------------------------------------------------------------------

// Helper to check if log file is empty (for adding headers)
async function isLogFileEmpty() {
  try {
    const stats = await stat(ACTIVITY_LOG_PATH)
    return stats.size === 0
  } catch (err) {
    console.error('isLogFileEmpty: stat failed:', err.message)
    return true // file doesn't exist yet
  }
}

const SIWE_STATEMENT = 'Sign in with Ethereum to Wealth Wards.'
const SIWE_TTL_MS = 10 * 60 * 1000
const SIWE_CLOCK_SKEW_MS = 2 * 60 * 1000
const ALLOWED_CHAIN_IDS = new Set([mainnet.id, sepolia.id])

// Rate limits
const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false })
const strictAuthLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })

// Helper: Extract Nonce from Message
function extractNonceFromMessage(message) {
  const match = message.match(/^Nonce:\s*(.+)$/m)
  return match?.[1]?.trim() ?? null
}

// API: Get Nonce
app.get('/api/nonce', authLimiter, async (req, res) => {
  const address = String(req.query.address ?? '')
  if (!isAddress(address)) return res.status(400).json({ error: 'Invalid address' })

  try {
    const { nonce, expiresAt } = await issueNonce(address)
    res.json({ address, nonce, expiresAt })
  } catch (err) {
    console.error('Redis error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// API: SIWE Message (Sign-In With Ethereum)
app.get('/api/siwe/message', authLimiter, async (req, res) => {
  const address = String(req.query.address ?? '')
  const chainId = Number(req.query.chainId ?? mainnet.id)
  const uri = String(req.query.uri ?? '')

  if (!isAddress(address)) return res.status(400).json({ ok: false, error: 'Invalid address' })
  const chainIdInt = Number.isFinite(chainId) ? Math.floor(chainId) : mainnet.id
  if (!ALLOWED_CHAIN_IDS.has(chainIdInt)) return res.status(400).json({ ok: false, error: 'Unsupported chainId' })

  let domain
  try {
    domain = new URL(uri).host
  } catch (err) {
    console.error('SIWE message: invalid uri:', err.message)
    return res.status(400).json({ ok: false, error: 'Invalid uri' })
  }

  try {
    const { nonce } = await issueNonce(address)
    const issuedAt = new Date()
    const expirationTime = new Date(issuedAt.getTime() + SIWE_TTL_MS)

    const msg = new SiweMessage({
      domain,
      address: getAddress(address),
      statement: SIWE_STATEMENT,
      uri,
      version: '1',
      chainId: chainIdInt,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      notBefore: issuedAt.toISOString(),
    })

    return res.json({ ok: true, message: msg.prepareMessage(), nonce })
  } catch (err) {
    console.error('SIWE generation error:', err)
    return res.status(500).json({ ok: false, error: 'Internal error' })
  }
})

// API: SIWE Verify
app.post('/api/siwe/verify', strictAuthLimiter, async (req, res) => {
  const { message, signature } = req.body ?? {}
  if (!message || !signature) return res.status(400).json({ ok: false, error: 'Missing data' })
  if (typeof message !== 'string') return res.status(400).json({ ok: false, error: 'Invalid SIWE message: expected EIP-4361 string' })

  let siwe
  try {
    const parsed = new ParsedMessage(message)
    siwe = new SiweMessage({
      scheme: parsed.scheme,
      domain: parsed.domain,
      address: parsed.address,
      statement: parsed.statement,
      uri: parsed.uri,
      version: parsed.version,
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      issuedAt: parsed.issuedAt,
      expirationTime: parsed.expirationTime,
      notBefore: parsed.notBefore,
      requestId: parsed.requestId,
      resources: parsed.resources,
    })
  } catch (err) {
    console.error('SIWE verify: invalid message format:', err.message)
    return res.status(400).json({ ok: false, error: 'Invalid SIWE message' })
  }

  // Standard SIWE field checks 
  if (siwe.version !== '1') return res.status(400).json({ ok: false, error: 'Invalid SIWE version' })
  if (siwe.statement !== SIWE_STATEMENT) return res.status(400).json({ ok: false, error: 'Invalid SIWE statement' })
  if (!isAddress(siwe.address)) return res.status(400).json({ ok: false, error: 'Invalid address' })
  const verifyChainId = Number(siwe.chainId)
  const verifyChainIdInt = Number.isFinite(verifyChainId) ? Math.floor(verifyChainId) : 0
  if (!ALLOWED_CHAIN_IDS.has(verifyChainIdInt)) return res.status(400).json({ ok: false, error: 'Unsupported chainId' })

  // Validate expected frontend origin/domain (must match CORS: 5170-5179 in dev)
  const isElectron = req.headers['x-electron-app'] === '1'
  const allowedOrigins = new Set()
  if (process.env.WEB_ORIGIN) allowedOrigins.add(process.env.WEB_ORIGIN)
  // Electron desktop app may use a different API origin as the SIWE uri
  if (process.env.ELECTRON_ORIGIN) allowedOrigins.add(process.env.ELECTRON_ORIGIN)
  // Accept VITE_API_URL / VITE_API_URL_ELECTRON so the frontend's SIWE uri
  // is recognised even when WEB_ORIGIN or ELECTRON_ORIGIN aren't set to
  // the same value (common in same-origin deployments and Electron).
  if (process.env.VITE_API_URL) allowedOrigins.add(process.env.VITE_API_URL)
  if (process.env.VITE_API_URL_ELECTRON) allowedOrigins.add(process.env.VITE_API_URL_ELECTRON)
  if (!IS_PROD) {
    for (let p = 5170; p <= 5179; p++) {
      allowedOrigins.add(`http://localhost:${p}`)
      allowedOrigins.add(`http://127.0.0.1:${p}`)
    }
    allowedOrigins.add('http://localhost:3000')
    allowedOrigins.add('http://localhost:3001')
    // Dev Electron uses the local API server as SIWE uri
    allowedOrigins.add('http://localhost:3001')
  }

  if (IS_PROD && allowedOrigins.size === 0) {
    return res.status(503).json({ ok: false, error: 'Server misconfiguration: WEB_ORIGIN required in production' })
  }

  let msgOrigin
  try {
    msgOrigin = new URL(siwe.uri).origin
  } catch (err) {
    console.error('SIWE verify: invalid uri in message:', err.message)
    return res.status(400).json({ ok: false, error: 'Invalid uri in SIWE message' })
  }
  if (!allowedOrigins.has(msgOrigin)) {
    return res.status(400).json({ ok: false, error: `Invalid origin: ${msgOrigin}` })
  }
  const expectedDomain = new URL(msgOrigin).host
  if (siwe.domain !== expectedDomain) {
    return res.status(400).json({ ok: false, error: 'SIWE domain mismatch' })
  }

  // Time window checks (prevents old/future messages)
  const now = Date.now()
  const issuedAtMs = Date.parse(siwe.issuedAt || '')
  if (!Number.isFinite(issuedAtMs)) return res.status(400).json({ ok: false, error: 'Invalid issuedAt' })
  if (issuedAtMs > now + SIWE_CLOCK_SKEW_MS) return res.status(400).json({ ok: false, error: 'issuedAt is in the future' })
  if (now - issuedAtMs > SIWE_TTL_MS + SIWE_CLOCK_SKEW_MS) return res.status(400).json({ ok: false, error: 'SIWE message too old' })

  const expirationMs = Date.parse(siwe.expirationTime || '')
  if (!Number.isFinite(expirationMs)) return res.status(400).json({ ok: false, error: 'Missing/invalid expirationTime' })
  if (now > expirationMs + SIWE_CLOCK_SKEW_MS) return res.status(400).json({ ok: false, error: 'SIWE message expired' })

  if (siwe.notBefore) {
    const notBeforeMs = Date.parse(siwe.notBefore)
    if (!Number.isFinite(notBeforeMs)) return res.status(400).json({ ok: false, error: 'Invalid notBefore' })
    if (now + SIWE_CLOCK_SKEW_MS < notBeforeMs) return res.status(400).json({ ok: false, error: 'SIWE message not active yet' })
  }

  // Consume nonce BEFORE signature verification (anti-replay).
  // Trade-off: a bad signature burns the nonce, forcing the user to request a
  // new SIWE message. This is intentional — it prevents an attacker from
  // replaying a valid nonce with forged signatures in a retry loop.
  const nonceValid = await takeNonce(siwe.address, siwe.nonce)
  if (!nonceValid) return res.status(400).json({ ok: false, error: 'Missing/expired nonce. Please request a new sign-in message.' })

  let verifyResult
  try {
    verifyResult = await siwe.verify({
      signature,
      domain: expectedDomain,
      nonce: siwe.nonce,
      time: new Date().toISOString(),
    })
  } catch (err) {
    console.error('SIWE verify threw:', err)
    return res.status(401).json({ ok: false, error: 'Invalid SIWE signature' })
  }

  if (!verifyResult.success) return res.status(401).json({ ok: false, error: 'Invalid SIWE signature' })

  // Balance check (on the chain from the SIWE message)
  let balanceEth = null
  const chainId = Number(siwe.chainId)
  try {
    const client = getPublicClient(chainId)
    const balance = await client.getBalance({ address: siwe.address })
    balanceEth = formatEther(balance)
  } catch (err) {
    console.warn('Balance fetch failed', err.message)
  }

  // Issue Token
  const token = jwt.sign({ sub: siwe.address.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' })
  // Detect localhost: cannot use Secure flag over HTTP, and SameSite=None requires Secure
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1'
  const secureCookie = isLocalhost ? false : (isElectron || IS_PROD)
  const sameSite = isLocalhost ? 'lax' : (isElectron ? 'none' : 'lax')
  res.cookie('token', token, {
    httpOnly: true,
    sameSite,
    secure: secureCookie,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  // Automatic Login Logging
  if (ActivityLog && mongoReady) {
    try {
      await ActivityLog.create({
        type: 'login',
        address: siwe.address.toLowerCase(),
        balance: balanceEth,
        chainId: Number(siwe.chainId),
        connectorName: 'SIWE',
        ip: getClientIp(req),
        userAgent: req.get('user-agent') || 'unknown',
        timestampLocal: getManilaTime()
      })
    } catch (logErr) {
      console.error('Failed to auto-log login:', logErr.message)
    }
  }

  return res.json({ ok: true, balance: balanceEth })
})

// 3. UPDATED LOGGING (Using MongoDB)
// ------------------------------------------------------------------
app.post('/api/log-activity', requireAuth, async (req, res) => {
  const { type, address, balance, chainId, connectorName } = req.body ?? {}
  if (!type) return res.status(400).json({ ok: false, error: 'Missing type' })
  // Require wallet-based auth so I never accept arbitrary body address (e.g. email-only JWT would have req.user.address = null)
  const authAddress = req.user?.address ?? null
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required to log activity' })
  const bodyAddress = address != null && address !== '' ? String(address).trim() : null
  const resolvedAddress = !bodyAddress || bodyAddress.toLowerCase() === authAddress.toLowerCase() ? authAddress : null
  if (!resolvedAddress) return res.status(403).json({ ok: false, error: 'Cannot log activity for another address' })
  if (!isAddress(resolvedAddress)) return res.status(400).json({ ok: false, error: 'Invalid address' })
  const normalizedType = String(type).trim().toLowerCase()
  if (!ACTIVITY_TYPES.includes(normalizedType)) {
    return res.status(400).json({ ok: false, error: 'Invalid type. Use POST /api/transactions for transaction logging.' })
  }

  const ip = getClientIp(req)
  if (process.env.DEBUG_LOG_HEADERS === 'true') {
    console.log('Forwarded headers:', req.headers['x-forwarded-for'])
  }
  const userAgent = req.get('user-agent') || 'unknown'

  const logData = {
    type: normalizedType,
    address: resolvedAddress,
    balance: balance != null && balance !== '' ? String(balance) : null,
    chainId: chainId != null && Number.isFinite(Number(chainId)) ? Number(chainId) : null,
    connectorName: connectorName != null && String(connectorName).trim() ? String(connectorName).trim() : null,
    ip,
    userAgent,
  }

  try {
    // Save to MongoDB if available
    if (ActivityLog && mongoReady) {
      try {
        await ActivityLog.create(logData)
      } catch (err) {
        console.error('Failed to write to MongoDB activity log:', err)
      }
    }

    // File fallback: append to activity.txt when MongoDB is unavailable
    if (!mongoReady || !ActivityLog) {
      const now = new Date()
      const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
      const time = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const statusLabel = normalizedType === 'login' ? 'Logged In' : 'Disconnected'
      const balanceLine = `Balance:         ${logData.balance != null ? logData.balance + ' ETH' : '—'}\n`
      const chainIdLine = `Chain ID:        ${logData.chainId != null ? logData.chainId : '—'}\n`
      const connectorLine = `Connector:       ${logData.connectorName != null ? logData.connectorName : '—'}\n`

      if (await isLogFileEmpty()) {
        const header = `${'='.repeat(120)}
ACTIVITY LOG - Web3 Login System
${'='.repeat(120)}

`
        await appendFile(ACTIVITY_LOG_PATH, header, { mode: 0o600 })
      }

      const entry = `${'─'.repeat(80)}
Time:           ${date} ${time}
Status:         ${statusLabel}
Wallet Address: ${resolvedAddress}
${balanceLine}${chainIdLine}${connectorLine}IP Address:     ${ip}
User Agent:     ${userAgent}
`
      await appendFile(ACTIVITY_LOG_PATH, entry, { mode: 0o600 })

      // Log rotation if file size exceeds 5MB
      try {
        const stats = await stat(ACTIVITY_LOG_PATH)
        if (stats.size > 5 * 1024 * 1024) {
          const rotatedPath = `${ACTIVITY_LOG_PATH}.${Date.now()}`
          await rename(ACTIVITY_LOG_PATH, rotatedPath)
          console.log(`Log rotated: ${rotatedPath}`)
        }
      } catch (rotateErr) {
        console.warn('Log rotation check failed:', rotateErr.message)
      }
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('Failed to write activity log:', err)
    return res.status(500).json({ ok: false, error: 'Logging failed' })
  }
})

// GET activity log (from MongoDB or parsed from activity.txt)
app.get('/api/activity', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const authAddress = req.user?.address ?? null
  const queryAddress = req.query.address ? String(req.query.address).trim().toLowerCase() : null
  const filterAddress = queryAddress && authAddress && queryAddress === authAddress.toLowerCase() ? queryAddress : authAddress
  if (!authAddress) return res.json({ ok: true, activity: [] })

  try {
    if (ActivityLog && mongoReady) {
      const query = filterAddress
        ? { address: filterAddress.toLowerCase() }
        : {}
      const docs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(limit).lean()
      const list = docs.map((d) => ({
        time: d.timestamp,
        status: d.type === 'login' ? 'Logged In' : d.type === 'disconnect' ? 'Disconnected' : d.type,
        address: d.address,
        balance: d.balance,
        chainId: d.chainId,
        connector: d.connectorName,
      }))
      return res.json({ ok: true, activity: list })
    }

    // File fallback: read and parse activity.txt
    let content
    try {
      content = await readFile(ACTIVITY_LOG_PATH, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return res.json({ ok: true, activity: [] })
      throw err
    }
    const blocks = content.split(/\n[-─]{20,}\n/).filter((b) => b.trim())
    const list = []
    for (const block of blocks) {
      const entry = {}
      for (const line of block.split('\n')) {
        const match = line.match(/^(\S[\w\s]*?):\s+(.*)$/)
        if (!match) continue
        const [, key, value] = match
        if (key === 'Time') entry.time = value
        else if (key === 'Status') entry.status = value
        else if (key === 'Wallet Address') entry.address = value
        else if (key === 'Balance') entry.balance = value === '—' ? null : (value.replace(/\s*ETH$/, '').trim() || null)
        else if (key === 'Chain ID') entry.chainId = value === '—' ? null : Number(value) || null
        else if (key === 'Connector') entry.connector = value === '—' ? null : value
      }
      if (entry.address && (!filterAddress || entry.address.toLowerCase() === filterAddress)) list.push(entry)
    }
    list.reverse()
    res.json({ ok: true, activity: list.slice(0, limit) })
  } catch (err) {
    console.error('Failed to read activity log:', err)
    return res.status(500).json({ ok: false, error: 'Failed to load activity' })
  }
})
// ------------------------------------------------------------------

// TRANSACTION LOG ENDPOINTS (separate MongoDB collection: TransactionLog)
// ------------------------------------------------------------------
const TRANSACTION_LOGGING_ERROR = 'Transaction logging requires MongoDB (MONGO_URI)'


// POST /api/transactions — log a transaction
app.post('/api/transactions', requireAuth, async (req, res) => {
  const { type, chainId, connectorName, txHash, fromAddress, toAddress, amountEth, blockNumber, kind, tokenAddress, tokenAmount } = req.body ?? {}

  // Require wallet-based auth
  const authAddress = req.user?.address ?? null
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
  if (!isAddress(authAddress)) return res.status(400).json({ ok: false, error: 'Invalid address' })

  // Validate type (case-insensitive match, store as capitalized enum value)
  const matchedType = TRANSACTION_TYPES.find(t => t.toLowerCase() === String(type).trim().toLowerCase())
  if (!matchedType) {
    return res.status(400).json({ ok: false, error: `Invalid type. Must be one of: ${TRANSACTION_TYPES.join(', ')}` })
  }

  // Require MongoDB for this endpoint
    console.warn(`[server] Transaction log POST requested but MongoDB not ready (mongoReady=${mongoReady})`);
    return res.status(202).json({ ok: true, warning: 'Transaction logged locally only (DB offline)' })

  const ip = getClientIp(req)
  const userAgent = req.get('user-agent') || 'unknown'

  const chainIdNum = chainId != null && Number.isFinite(Number(chainId)) ? Number(chainId) : 1
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(String(txHash).trim())) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing txHash. A valid transaction hash is required.' })
  }
  const hash = String(txHash).trim()

  let txData = {
    type: matchedType,
    address: authAddress.toLowerCase(),
    chainId: chainIdNum,
    connectorName: connectorName != null && String(connectorName).trim() ? String(connectorName).trim().slice(0, 50) : null,
    txHash: hash,
    fromAddress: fromAddress && isAddress(String(fromAddress).trim()) ? String(fromAddress).trim() : null,
    toAddress: toAddress && isAddress(String(toAddress).trim()) ? String(toAddress).trim() : null,
    amountEth: amountEth != null && amountEth !== '' ? String(amountEth).slice(0, 50) : null,
    blockNumber: blockNumber != null && Number.isFinite(Number(blockNumber)) ? Number(blockNumber) : null,
    kind: kind != null && String(kind).trim() ? String(kind).trim().slice(0, 50) : null,
    tokenAddress: tokenAddress && isAddress(String(tokenAddress).trim()) ? String(tokenAddress).trim() : null,
    tokenAmount: tokenAmount != null && tokenAmount !== '' ? String(tokenAmount).slice(0, 50) : null,
    ip,
    userAgent,
  }

  // If txHash is provided and missing details, try to fetch from RPC
  if (hash && (!txData.fromAddress || !txData.toAddress || txData.amountEth == null) && ALLOWED_CHAIN_IDS.has(chainIdNum)) {
    try {
      const client = getPublicClient(chainIdNum)
      const tx = await client.getTransaction({ hash: /** @type {import('viem').Hash} */ (hash) })
      if (tx) {
        if (!txData.fromAddress) txData.fromAddress = tx.from
        if (!txData.toAddress && tx.to) txData.toAddress = tx.to
        if (txData.amountEth == null && tx.value != null) txData.amountEth = formatEther(tx.value)
        if (txData.blockNumber == null && tx.blockNumber != null) txData.blockNumber = Number(tx.blockNumber)
      }
    } catch (err) {
      console.warn('Failed to fetch tx details for transaction log:', err.message)
    }
  }

  try {
    await TransactionLog.create({ ...txData, timestampLocal: getManilaTime() })
    return res.json({ ok: true })
  } catch (err) {
    console.error('Failed to write transaction log:', err)
    return res.status(500).json({ ok: false, error: 'Transaction logging failed' })
  }
})

// GET /api/transactions — retrieve transaction logs for the authenticated user
app.get('/api/transactions', requireAuth, async (req, res) => {
  const authAddress = req.user?.address ?? null
  if (!authAddress) return res.json({ ok: true, transactions: [] })

  if (!TransactionLog || !mongoReady) {
    console.warn(`[server] Transactions GET requested but MongoDB not ready (mongoReady=${mongoReady})`);
    return res.json({ ok: true, transactions: [], warning: 'Database connection inactive' })
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const typeFilter = req.query.type ? String(req.query.type).trim() : null

  try {
    const query = { address: authAddress.toLowerCase() }
    if (typeFilter) {
      const normalizedType = TRANSACTION_TYPES.find(t => t.toLowerCase() === typeFilter.toLowerCase())
      if (normalizedType) {
        query.type = normalizedType
      }
    }

    const docs = await TransactionLog.find(query).sort({ timestamp: -1 }).limit(limit).lean()
    const transactions = docs.map((d) => ({
      id: d._id,
      type: d.type,
      address: d.address,
      chainId: d.chainId,
      connectorName: d.connectorName,
      txHash: d.txHash,
      fromAddress: d.fromAddress,
      toAddress: d.toAddress,
      amountEth: d.amountEth,
      blockNumber: d.blockNumber,
      kind: d.kind,
      tokenAddress: d.tokenAddress,
      tokenAmount: d.tokenAmount,
      timestamp: d.timestamp,
    }))
    return res.json({ ok: true, transactions })
  } catch (err) {
    console.error('Failed to read transaction log:', err)
    return res.status(500).json({ ok: false, error: 'Failed to load transactions' })
  }
})
// ------------------------------------------------------------------


// ERC-20 TOKEN ASSETS (via Alchemy Enhanced API)
// ------------------------------------------------------------------
// SECURITY NOTE: The Alchemy API key is kept server-side only.
// It calls our /api/assets proxy endpoint,
// which forwards the request to Alchemy. This is the recommended pattern:
//   Browser → my server (/api/assets) → Alchemy JSON-RPC
// If you need additional protection, enable Alchemy's "Allowlists" feature
// to restrict the key to your server's IP or referrer domain.
// ------------------------------------------------------------------
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? null
if (!ALCHEMY_API_KEY) {
  console.warn('[server] ALCHEMY_API_KEY is not set. GET /api/assets will return 503.')
}

// Map chainId → Alchemy network slug
const ALCHEMY_NETWORK = {
  [mainnet.id]: 'eth-mainnet',
  [sepolia.id]: 'eth-sepolia',
}

function getAlchemyUrl(chainId) {
  const network = ALCHEMY_NETWORK[chainId] ?? ALCHEMY_NETWORK[mainnet.id]
  // Alchemy's JSON-RPC expects the key in the URL path for v2 endpoints.
  // This is server-side only — the key is never exposed to the browser.
  // For an extra layer of protection, avoid logging this URL and enable
  // Alchemy's IP/referrer Allowlists in the dashboard.
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
}

// GET /api/assets?address=0x...&chainId=1
// Returns all non-zero ERC-20 token balances with name, symbol, decimals.
// Includes hardcoded fallback for pinned custom tokens (e.g. CSCS) that
// Alchemy's getTokenBalances may not index automatically.
const PINNED_TOKEN_ADDRESSES = [
  '0xa6Ec49E06C25F63292bac1Abc1896451A0f4cFB7', // CSCS (Mainnet)
  '0x9C9580A8915d2797fb9E9651c93aE1559D8A498e', // CSCR (Mainnet)
]

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? null
const ETHERSCAN_BASE_URL = {
  [mainnet.id]: 'https://api.etherscan.io/api',
  [sepolia.id]: 'https://api-sepolia.etherscan.io/api',
}

const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? null
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2'

if (!ETHERSCAN_API_KEY) console.warn('[server] ETHERSCAN_API_KEY missing')
if (!MORALIS_API_KEY) console.warn('[server] MORALIS_API_KEY missing')

// --- Helper Functions for Token Discovery ---

async function fetchAlchemyAssets(address, chainId) {
  if (!ALCHEMY_API_KEY) return [];
  const alchemyUrl = getAlchemyUrl(chainId);
  try {
    const balancesRes = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenBalances',
        params: [address, 'erc20'],
      }),
    });
    const balancesJson = await balancesRes.json();
    const tokenBalances = balancesJson.result?.tokenBalances ?? [];
    const nonZero = tokenBalances.filter((t) => t.tokenBalance && BigInt(t.tokenBalance) > 0n);

    // Metadata fetch (batched)
    if (nonZero.length === 0) return [];
    const batchBody = nonZero.map((t, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'alchemy_getTokenMetadata',
      params: [t.contractAddress],
    }));
    const metaRes = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batchBody),
    });
    const metaJson = await metaRes.json();
    const metaArray = Array.isArray(metaJson) ? metaJson : [metaJson];
    const metaMap = new Map();
    for (const m of metaArray) {
      if (m.result) metaMap.set(m.id, m.result);
    }

    return nonZero.map((t, i) => {
      const meta = metaMap.get(i) ?? {};
      const decimals = meta.decimals != null ? meta.decimals : null;
      return {
        contractAddress: t.contractAddress,
        name: meta.name || 'Unknown Token',
        symbol: meta.symbol || '???',
        decimals,
        balance: decimals != null ? formatUnits(BigInt(t.tokenBalance), decimals) : null,
        logo: meta.logo ?? null,
        source: 'alchemy'
      };
    });
  } catch (err) {
    console.error('fetchAlchemyAssets error:', err.message);
    return [];
  }
}

async function fetchEtherscanAssets(address, chainId) {
  if (!ETHERSCAN_API_KEY) return [];
  const etherscanBaseUrl = ETHERSCAN_BASE_URL[chainId] ?? ETHERSCAN_BASE_URL[mainnet.id];
  try {
    const tokentxUrl = `${etherscanBaseUrl}?module=account&action=tokentx&address=${encodeURIComponent(address)}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const tokentxRes = await fetch(tokentxUrl);
    const tokentxJson = await tokentxRes.json();
    const transfers = Array.isArray(tokentxJson.result) ? tokentxJson.result : [];
    
    const tokenMap = new Map();
    for (const tx of transfers) {
      const contractAddr = tx.contractAddress?.toLowerCase();
      if (!contractAddr || tokenMap.has(contractAddr)) continue;
      tokenMap.set(contractAddr, {
        contractAddress: tx.contractAddress,
        name: tx.tokenName || 'Unknown Token',
        symbol: tx.tokenSymbol || '???',
        decimals: tx.tokenDecimal != null ? Number(tx.tokenDecimal) : null,
      });
    }

    const client = getPublicClient(chainId);
    const erc20BalanceAbi = [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }];
    const assets = [];
    const tokenEntries = Array.from(tokenMap.values());
    const BATCH_SIZE = 20;

    for (let i = 0; i < tokenEntries.length; i += BATCH_SIZE) {
      const batch = tokenEntries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (token) => {
        try {
          const balance = await client.readContract({
            address: token.contractAddress,
            abi: erc20BalanceAbi,
            functionName: 'balanceOf',
            args: [address],
          });
          return { token, balance: BigInt(balance) };
        } catch { return { token, balance: 0n }; }
      }));
      for (const { token, balance } of results) {
        if (balance > 0n) {
          assets.push({
            contractAddress: token.contractAddress,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            balance: token.decimals != null ? formatUnits(balance, token.decimals) : null,
            logo: null,
            source: 'etherscan'
          });
        }
      }
    }
    return assets;
  } catch (err) {
    console.error('fetchEtherscanAssets error:', err.message);
    return [];
  }
}

async function fetchMoralisAssets(address, chainId) {
  if (!MORALIS_API_KEY) return [];
  const moralisChain = getMoralisChain(chainId);
  try {
    const url = `${MORALIS_BASE_URL}/wallets/${address}/tokens?chain=${moralisChain}`;
    const headers = { 'accept': 'application/json' };
    if (MORALIS_API_KEY.startsWith('eyJ')) headers['Authorization'] = `Bearer ${MORALIS_API_KEY}`;
    else headers['X-API-Key'] = MORALIS_API_KEY;

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) return [];
    const data = await response.json();
    const tokens = data.result ?? [];

    return tokens.map((token) => ({
      contractAddress: token.token_address,
      symbol: token.symbol ?? '???',
      name: token.name ?? 'Unknown Token',
      balance: token.balance != null && token.decimals != null ? formatUnits(BigInt(token.balance), token.decimals) : (token.balance ?? '0'),
      decimals: token.decimals ?? null,
      logo: token.thumbnail ?? null,
      source: 'moralis'
    }));
  } catch (err) {
    console.error('fetchMoralisAssets error:', err.message);
    return [];
  }
}

function getMoralisChain(chainId) {
  return MORALIS_CHAIN[chainId] ?? MORALIS_CHAIN[mainnet.id];
}

// ------------------------------------------------------------------

app.get('/api/assets', requireAuth, async (req, res) => {
  const authAddress = req.user?.address ?? null;
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' });

  const queryAddress = req.query.address ? String(req.query.address).trim() : authAddress;
  if (queryAddress.toLowerCase() !== authAddress.toLowerCase()) return res.status(403).json({ ok: false, error: 'Forbidden' });
  const chainId = Number(req.query.chainId ?? mainnet.id);

  const assets = await fetchAlchemyAssets(queryAddress, chainId);
  
  // Apply pinned tokens and sorting (shared logic)
  const pinnedSet = new Set(PINNED_TOKEN_ADDRESSES.map(a => a.toLowerCase()));
  // (In a real app, we'd also fetch specific balances for pinned tokens if missing)
  
  return res.json({ ok: true, assets });
});

app.get('/api/etherscan-assets', requireAuth, async (req, res) => {
  const authAddress = req.user?.address ?? null;
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' });

  const queryAddress = req.query.address ? String(req.query.address).trim() : authAddress;
  if (queryAddress.toLowerCase() !== authAddress.toLowerCase()) return res.status(403).json({ ok: false, error: 'Forbidden' });
  const chainId = Number(req.query.chainId ?? mainnet.id);

  const assets = await fetchEtherscanAssets(queryAddress, chainId);
  return res.json({ ok: true, assets });
});

app.get('/api/tokens', requireAuth, async (req, res) => {
  const authAddress = req.user?.address ?? null;
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' });

  const queryAddress = req.query.address ? String(req.query.address).trim() : authAddress;
  if (queryAddress.toLowerCase() !== authAddress.toLowerCase()) return res.status(403).json({ ok: false, error: 'Forbidden' });
  const chainId = Number(req.query.chainId ?? mainnet.id);

  const assets = await fetchMoralisAssets(queryAddress, chainId);
  return res.json({ ok: true, tokens: assets }); // Note: legacy response key 'tokens'
});

// NEW DEEP DISCOVERY ENDPOINT
app.get('/api/all-assets', requireAuth, async (req, res) => {
  const authAddress = req.user?.address ?? null;
  if (!authAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' });

  const queryAddress = req.query.address ? String(req.query.address).trim() : authAddress;
  if (queryAddress.toLowerCase() !== authAddress.toLowerCase()) return res.status(403).json({ ok: false, error: 'Forbidden' });
  const chainId = Number(req.query.chainId ?? mainnet.id);

  const cacheKey = `discovery:${chainId}:${queryAddress.toLowerCase()}`;
  
  try {
    // 1. Check Cache
    const cached = await getCachedData(cacheKey);
    if (cached) {
    // console.log(`[Discovery] Cache Hit for ${queryAddress}`);
      return res.json({ ok: true, assets: JSON.parse(cached), cached: true });
    }

    const results = await Promise.allSettled([
      fetchAlchemyAssets(queryAddress, chainId),
      fetchEtherscanAssets(queryAddress, chainId),
      fetchMoralisAssets(queryAddress, chainId),
    ]);

    const allTokens = [];
    results.forEach((res, i) => {
      const source = i === 0 ? 'Alchemy' : i === 1 ? 'Etherscan' : 'Moralis';
      if (res.status === 'fulfilled') {
      // console.log(`[Discovery] ${source} found ${res.value.length} tokens`);
        allTokens.push(...res.value);
      }
    });

    const mergedMap = new Map();
    for (const t of allTokens) {
      const addr = t.contractAddress?.toLowerCase();
      if (!addr) continue;
      if (!mergedMap.has(addr)) {
        mergedMap.set(addr, t);
      } else {
        const existing = mergedMap.get(addr);
        if (!existing.logo && t.logo) existing.logo = t.logo;
        const oldBal = parseFloat(existing.balance || '0');
        const newBal = parseFloat(t.balance || '0');
        if (newBal > oldBal) existing.balance = t.balance;
      }
    }

    // Ensure pinned tokens are included
    for (const pinned of PINNED_TOKEN_ADDRESSES) {
      const lower = pinned.toLowerCase();
      if (!mergedMap.has(lower)) {
        mergedMap.set(lower, {
          contractAddress: pinned,
          name: lower === '0xa6ec49e06c25f63292bac1abc1896451a0f4cfb7' ? 'CSCS Token' : 'CSCR Token',
          symbol: lower === '0xa6ec49e06c25f63292bac1abc1896451a0f4cfb7' ? 'CSCS' : 'CSCR',
          decimals: 18,
          balance: '0',
          logo: null,
          source: 'pinned'
        });
      }
    }

    const assets = Array.from(mergedMap.values());

    // Sort: pinned first, then alphabetical
    const pinnedSet = new Set(PINNED_TOKEN_ADDRESSES.map(a => a.toLowerCase()));
    assets.sort((a, b) => {
      const aPinned = pinnedSet.has(a.contractAddress?.toLowerCase());
      const bPinned = pinnedSet.has(b.contractAddress?.toLowerCase());
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });

    // 2. Cache Result (30 minute TTL for discovery)
    await setCachedData(cacheKey, JSON.stringify(assets), 1800);

    return res.json({ ok: true, assets });
  } catch (err) {
    console.error('Deep discovery failed:', err);
    return res.status(500).json({ ok: false, error: 'Deep discovery failed' });
  }
});

const MORALIS_CHAIN = {
  [mainnet.id]: 'eth',
  [sepolia.id]: 'sepolia',
}

async function fetchCoinGeckoPrice(address) {
  try {
    const CG_MAP = {
      '0xa6ec49e06c25f63292bac1abc1896451a0f4cfb7': 'ethereum', // CSCS
      '0x9c9580a8915d2797fb9e9651c93ae1559d8a498e': 'ethereum', // CSCR
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ethereum',
      'ethereum': 'ethereum',
      'bitcoin': 'bitcoin',
    };
    const cgId = CG_MAP[address.toLowerCase()] || null;
    if (!cgId) return null;

    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(cgUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      usdPrice: data[cgId]?.usd || null,
      usdPrice24hrPercentChange: data[cgId]?.usd_24h_change || null
    };
  } catch (e) {
    console.warn('[CoinGecko] Fallback failed:', e.message);
    return null;
  }
}



// CACHING HELPERS (Redis if available, else in-memory)
async function getCachedData(key) {
  if (!redis) return null
  try {
    return await redis.get(key)
  } catch (err) {
    return null
  }
}
async function setCachedData(key, value, ttlSeconds = 300) {
  if (!redis) return
  try {
    await redis.set(key, value, 'EX', ttlSeconds)
  } catch (err) {
    // fail silently
  }
}

// GET /api/token-price?address=0x...&chainId=1
app.get('/api/token-price', async (req, res) => {
  const address = (req.query.address || '').trim().toLowerCase()
  if (!address) return res.status(400).json({ ok: false, error: 'Address required' })
  
  const chainId = Number(req.query.chainId ?? mainnet.id)
  const cacheKey = `price:${chainId}:${address}`
  
  // Try Cache
  const cached = await getCachedData(cacheKey)
  if (cached) return res.json({ ok: true, price: JSON.parse(cached).price, change24h: JSON.parse(cached).change24h, cached: true })

  // Handle special native IDs or common symbols
  if (address === 'ethereum' || address === 'bitcoin') {
     const cgData = await fetchCoinGeckoPrice(address);
     if (cgData) {
       await setCachedData(cacheKey, JSON.stringify({ price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange }), 300)
       return res.json({ ok: true, price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange });
     }
     return res.status(502).json({ ok: false, error: 'Price fetch failed' });
  }

  if (!isAddress(address)) return res.status(400).json({ ok: false, error: 'Invalid address' })
  const moralisChain = getMoralisChain(chainId)

  try {
    const url = `${MORALIS_BASE_URL}/erc20/${address}/price?chain=${moralisChain}`
    const headers = { 'accept': 'application/json' };
    if (MORALIS_API_KEY.startsWith('eyJ')) headers['Authorization'] = `Bearer ${MORALIS_API_KEY}`;
    else headers['X-API-Key'] = MORALIS_API_KEY;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const cgData = await fetchCoinGeckoPrice(address);
      if (cgData) {
        await setCachedData(cacheKey, JSON.stringify({ price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange }), 300)
        return res.json({ ok: true, price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange });
      }
      // Cache failure for 1 minute to avoid slamming external APIs during outage/rate-limit
      await setCachedData(cacheKey, JSON.stringify({ price: null, change24h: null }), 60)
      return res.json({ ok: true, price: null, change24h: null });
    }
    const data = await response.json()
    const usd = data.usdPrice != null ? Number(data.usdPrice) : null
    const change = data.usdPrice24hrPercentChange != null ? Number(data.usdPrice24hrPercentChange) : (data['24hrPercentChange'] != null ? Number(data['24hrPercentChange']) : null)
    
    // Cache Result
    await setCachedData(cacheKey, JSON.stringify({ price: usd, change24h: change }), 300)
    
    return res.json({ ok: true, price: usd, change24h: change })
  } catch (err) {
    console.error('Token price fetch error:', err)
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

// GET /api/token-prices?addresses=0x1,0x2&chainId=1
app.get('/api/token-prices', async (req, res) => {
  const raw = req.query.addresses
  const addresses = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split(',') : [])
  const cleanAddresses = addresses.map(a => (a || '').trim().toLowerCase()).filter(a => a)
  if (cleanAddresses.length === 0) return res.status(400).json({ ok: false, error: 'Invalid or missing addresses' })

  const chainId = Number(req.query.chainId ?? mainnet.id)
  const moralisChain = getMoralisChain(chainId)
  
  // Batch processing with Promise.all for optimization
  const pricePromises = cleanAddresses.slice(0, 50).map(async (address) => {
    const cacheKey = `price:${chainId}:${address}`
    
    // 1. Check Cache First
    const cached = await getCachedData(cacheKey)
    if (cached) return { address, data: JSON.parse(cached) }

    // 2. Fetch if not cached
    try {
      let priceData = null
      if (address === 'ethereum' || address === 'bitcoin') {
        const cgData = await fetchCoinGeckoPrice(address);
        if (cgData) priceData = { price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange };
      } else if (isAddress(address)) {
        const url = `${MORALIS_BASE_URL}/erc20/${address}/price?chain=${moralisChain}`
        const headers = { 'accept': 'application/json' };
        if (MORALIS_API_KEY.startsWith('eyJ')) headers['Authorization'] = `Bearer ${MORALIS_API_KEY}`;
        else headers['X-API-Key'] = MORALIS_API_KEY;

        const response = await fetch(url, { headers })
        if (response.ok) {
          const data = await response.json()
          const change = data.usdPrice24hrPercentChange != null ? Number(data.usdPrice24hrPercentChange) : (data['24hrPercentChange'] != null ? Number(data['24hrPercentChange']) : null)
          priceData = {
            price: data.usdPrice != null ? Number(data.usdPrice) : null,
            change24h: change,
          }
        } else {
          const cgData = await fetchCoinGeckoPrice(address);
          if (cgData) priceData = { price: cgData.usdPrice, change24h: cgData.usdPrice24hrPercentChange };
        }
      }

      if (priceData) {
        await setCachedData(cacheKey, JSON.stringify(priceData), 300)
        return { address, data: priceData }
      } else {
        // Cache failure for 1 minute
        await setCachedData(cacheKey, JSON.stringify({ price: null, change24h: null }), 60)
      }
    } catch (e) {
      console.warn('Token price for', address, e.message)
    }
    return { address, data: null }
  })

  const resultsArr = await Promise.all(pricePromises)
  const prices = {}
  resultsArr.forEach(r => {
    if (r.data) prices[r.address] = r.data
  })

  return res.json({ ok: true, prices })
})

// ------------------------------------------------------------------
// 4. SESSION / USER ROUTES (used by frontend buttons)
// ------------------------------------------------------------------
app.get('/api/walletAddress', (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ ok: false, error: 'Not logged in' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const isWallet = typeof payload.sub === 'string' && payload.sub.startsWith('0x') && isAddress(payload.sub)
    return res.json({
      ok: true,
      address: isWallet ? payload.sub : null,
      provider: payload.provider ?? null,
      email: payload.email ?? null,
      name: payload.name ?? null,
    })
  } catch (err) {
    console.error('walletAddress: JWT verification failed:', err.message)
    return res.status(401).json({ ok: false, error: 'Invalid/expired token' })
  }
})

// GET /api/balance — native ETH balance for the authenticated wallet (used by dashboard)
app.get('/api/balance', requireAuth, async (req, res) => {
  const address = req.user?.address ?? null
  if (!address) return res.status(403).json({ ok: false, error: 'Wallet address required' })
  const chainId = Number(req.query.chainId ?? mainnet.id)
  if (!ALLOWED_CHAIN_IDS.has(chainId)) {
    return res.status(400).json({ ok: false, error: 'Unsupported chainId' })
  }
  try {
    const client = getPublicClient(chainId)
    const balance = await client.getBalance({ address })
    const balanceEth = formatEther(balance)
    return res.json({ ok: true, balance: balanceEth, chainId })
  } catch (err) {
    console.error('Balance fetch failed:', err.message)
    return res.status(500).json({ ok: false, error: 'Failed to fetch balance' })
  }
})

app.get('/api/private', requireAuth, (req, res) => {
  res.json({
    ok: true,
    address: req.user.address,
    provider: req.user.provider,
    email: req.user.email,
    name: req.user.name,
    secret: 'This is protected data only visible when logged in.',
  })
})

app.post('/api/logout', async (req, res) => {
  const isElectron = req.headers['x-electron-app'] === '1'
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1'
  const secureCookie = isLocalhost ? false : (isElectron || IS_PROD)
  const sameSite = isLocalhost ? 'lax' : (isElectron ? 'none' : 'lax')
  const tok = req.cookies?.token
  let logAddress = null
  try { if (tok) { const payload = jwt.verify(tok, JWT_SECRET); logAddress = payload.sub; } } catch(e) {}

  res.clearCookie('token', {
    path: '/',
    sameSite,
    secure: secureCookie,
  })

  // Automatic Logout Logging
  if (logAddress && ActivityLog && mongoReady) {
    try {
      await ActivityLog.create({
        type: 'disconnect',
        address: logAddress.toLowerCase(),
        ip: getClientIp(req),
        userAgent: req.get('user-agent') || 'unknown',
        timestampLocal: getManilaTime()
      })
    } catch (logErr) {}
  }

  res.json({ ok: true })
})

// USER PROFILE ENDPOINTS
// ------------------------------------------------------------------
// Schema for storing user profiles (optional MongoDB: we'll add if needed)
let UserProfile = null
if (process.env.MONGO_URI) {
  const UserProfileSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true, index: true, lowercase: true },
    displayName: { type: String, default: '' },
    email: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    settings: { type: Object, default: {} },
    updatedAt: { type: Date, default: Date.now },
    updatedAtLocal: { type: String, default: getManilaTime },
  })
  UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema)
}

// In-memory fallback for profiles (persisted to file when MongoDB is unavailable)
const PROFILE_STORE_PATH = join(__dirname, 'user-profiles.json')
let profileMemory = new Map()

async function loadProfilesFromFile() {
  try {
    const content = await readFile(PROFILE_STORE_PATH, 'utf8')
    const data = JSON.parse(content)
    profileMemory = new Map(Object.entries(data))
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to load profiles from file:', err.message)
    }
    profileMemory = new Map()
  }
}

async function saveProfilesToFile() {
  try {
    const data = Object.fromEntries(profileMemory)
    await writeFile(PROFILE_STORE_PATH, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Failed to save profiles to file:', err.message)
  }
}

// Initialize profiles on startup
loadProfilesFromFile().catch(err => console.error('Profile init error:', err))

// POST /api/user/profile — save user profile
app.post('/api/user/profile', requireAuth, async (req, res) => {
  const address = req.user?.address ?? null
  if (!address) return res.status(403).json({ ok: false, error: 'Wallet address required' })

  const { displayName, email, bio, avatarUrl, settings } = req.body ?? {}

  // Fetch existing to merge
  let existingProfile = {};
  if (typeof UserProfile !== 'undefined' && mongoReady) {
    try { existingProfile = await UserProfile.findOne({ address: address.toLowerCase() }).lean() || {}; } catch (e) {}
  } else {
    existingProfile = profileMemory.get(address.toLowerCase()) || {};
  }

  const profileData = {
    address: address.toLowerCase(),
    displayName: displayName !== undefined ? String(displayName).trim() : existingProfile.displayName || '',
    email: email !== undefined ? String(email).trim() : existingProfile.email || '',
    bio: bio !== undefined ? String(bio).trim() : existingProfile.bio || '',
    avatarUrl: avatarUrl !== undefined ? (avatarUrl ? String(avatarUrl).trim().slice(0, 5000000) : null) : existingProfile.avatarUrl || null,
    settings: settings !== undefined ? settings : existingProfile.settings || {},
    updatedAt: new Date(),
  }

  try {
    if (UserProfile && mongoReady) {
      await UserProfile.findOneAndUpdate(
        { address: address.toLowerCase() },
        { ...profileData, updatedAtLocal: getManilaTime() },
        { upsert: true, returnDocument: 'after' }
      )
    } else {
      profileMemory.set(address.toLowerCase(), profileData)
      await saveProfilesToFile()
    }
    return res.json({ ok: true, profile: profileData })
  } catch (err) {
    console.error('Failed to save profile:', err)
    return res.status(500).json({ ok: false, error: 'Failed to save profile' })
  }
})

// GET /api/user/profile — retrieve user profile
app.get('/api/user/profile', requireAuth, async (req, res) => {
  const address = req.user?.address ?? null
  if (!address) return res.status(403).json({ ok: false, error: 'Wallet address required' })

  try {
    let profile = null
    if (UserProfile && mongoReady) {
      profile = await UserProfile.findOne({ address: address.toLowerCase() }).lean()
    } else {
      profile = profileMemory.get(address.toLowerCase())
    }

    if (!profile) {
      // console.log('No profile found for address:', address)
      return res.json({ ok: true, profile: null })
    }

    // console.log('Profile found, sending response')
    return res.json({ ok: true, profile })
  } catch (err) {
    console.error('Failed to retrieve profile:', err)
    return res.status(500).json({ ok: false, error: 'Failed to retrieve profile' })
  }
})


// ------------------------------------------------------------------



const port = Number(process.env.PORT ?? 3002)

// Start server immediately; MongoDB connects in background so file fallback works without blocking startup
if (process.env.MONGO_URI) {
  console.log(`[server] Connecting to MongoDB... (URI length: ${process.env.MONGO_URI.length})`)
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  }).then(() => {
    mongoReady = true
    console.log('[server] ✅ Connected to MongoDB')
  }).catch((err) => {
    mongoReady = false
    console.error('[server] ❌ MongoDB connection error:', err.message)
    if (err.message.includes('authentication failed')) {
      console.error('[server] Hint: Check your username/password in .env. Ensure no special characters are unescaped.')
    }
  })
}
app.listen(port, () => {
  console.log(`Auth API listening on http://127.0.0.1:${port}`)
})