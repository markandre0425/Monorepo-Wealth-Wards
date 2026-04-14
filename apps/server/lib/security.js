import net from 'node:net'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function normalizeOrigin(origin) {
  if (!origin) return origin
  return origin.endsWith('/') ? origin.slice(0, -1) : origin
}

export function parseCsvOrigins(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
}

export function isPrivateOrLoopbackIp(ip) {
  if (!ip || ip === 'unknown') return false
  const normalized = String(ip).trim().toLowerCase()

  if (normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true // fe80::/10

  if (net.isIP(normalized) !== 4) return false

  const parts = normalized.split('.').map(Number)
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT + common Tailscale ranges
  return false
}

export function createCsrfOriginGuard({
  isProd,
  allowNullOrigin,
  disableCheck,
  corsAllowlist,
  unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
}) {
  return function csrfOriginGuard(req, res, next) {
    if (disableCheck) return next()
    if (!unsafeMethods.has(req.method)) return next()

    const hasSessionCookie = Boolean(req.cookies?.token)
    if (!hasSessionCookie) return next()

    const originHeader = req.get('origin')
    if (originHeader === 'null') {
      if (allowNullOrigin) return next()
      return res.status(403).json({ ok: false, error: 'Invalid origin' })
    }

    let sourceOrigin = null
    if (originHeader) {
      sourceOrigin = normalizeOrigin(originHeader)
    } else {
      const refererHeader = req.get('referer')
      if (refererHeader) {
        try {
          sourceOrigin = new URL(refererHeader).origin
        } catch {
          sourceOrigin = null
        }
      }
    }

    if (!sourceOrigin) {
      if (!isProd) return next()
      return res.status(403).json({ ok: false, error: 'Missing origin' })
    }

    if (corsAllowlist.has(sourceOrigin)) return next()
    return res.status(403).json({ ok: false, error: 'Invalid origin' })
  }
}

export function computeInternalHmac({ secret, timestamp, method, path, contentSha256 = '' }) {
  const payload = `${timestamp}.${String(method || '').toUpperCase()}.${path}.${contentSha256}`
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeHexEqual(a, b) {
  try {
    const aBuf = Buffer.from(String(a || ''), 'hex')
    const bBuf = Buffer.from(String(b || ''), 'hex')
    if (aBuf.length === 0 || bBuf.length === 0) return false
    if (aBuf.length !== bBuf.length) return false
    return timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

export function createInternalRequestVerifier({
  staticKey,
  hmacSecret,
  ttlMs = 5 * 60 * 1000,
  replayCache = new Map(),
  now = () => Date.now(),
}) {
  return function verifyInternalRequest(req, res, next) {
    const providedStaticKey = req.get('x-internal-key')
    if (staticKey && providedStaticKey && providedStaticKey === staticKey) return next()

    if (!hmacSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const tsHeader = req.get('x-internal-timestamp')
    const sigHeader = req.get('x-internal-signature')
    const timestamp = Number(tsHeader)
    if (!Number.isFinite(timestamp)) return res.status(401).json({ ok: false, error: 'Unauthorized' })

    const ageMs = Math.abs(now() - timestamp)
    if (ageMs > ttlMs) return res.status(401).json({ ok: false, error: 'Stale request' })

    const contentSha256 = req.get('x-internal-content-sha256') || ''
    const expected = computeInternalHmac({
      secret: hmacSecret,
      timestamp,
      method: req.method,
      path: req.path,
      contentSha256,
    })

    if (!safeHexEqual(sigHeader, expected)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const replayKey = `${timestamp}:${sigHeader}`
    const expiresAt = now() + ttlMs

    for (const [k, exp] of replayCache.entries()) {
      if (exp <= now()) replayCache.delete(k)
    }

    if (replayCache.has(replayKey)) {
      return res.status(409).json({ ok: false, error: 'Replay detected' })
    }

    replayCache.set(replayKey, expiresAt)
    return next()
  }
}
