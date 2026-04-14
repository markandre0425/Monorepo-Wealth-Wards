import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseCsvOrigins,
  normalizeOrigin,
  isPrivateOrLoopbackIp,
  createCsrfOriginGuard,
  createInternalRequestVerifier,
  computeInternalHmac,
} from '../lib/security.js'

function createReq({
  method = 'POST',
  origin,
  referer,
  cookies,
  path = '/internal/alerts/evaluate-now',
  headers = {},
} = {}) {
  const merged = {
    ...(origin != null ? { origin } : {}),
    ...(referer != null ? { referer } : {}),
    ...headers,
  }
  return {
    method,
    path,
    cookies: cookies || {},
    get(name) {
      return merged[String(name).toLowerCase()]
    },
  }
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    ended: false,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
}

test('parseCsvOrigins + normalizeOrigin', () => {
  const out = parseCsvOrigins(' https://a.com/,http://localhost:3000 ,,https://b.com/ ')
  assert.deepEqual(out, ['https://a.com', 'http://localhost:3000', 'https://b.com'])
  assert.equal(normalizeOrigin('https://x.com/'), 'https://x.com')
})

test('isPrivateOrLoopbackIp coverage', () => {
  assert.equal(isPrivateOrLoopbackIp('127.0.0.1'), true)
  assert.equal(isPrivateOrLoopbackIp('10.2.3.4'), true)
  assert.equal(isPrivateOrLoopbackIp('172.16.0.1'), true)
  assert.equal(isPrivateOrLoopbackIp('192.168.1.2'), true)
  assert.equal(isPrivateOrLoopbackIp('100.100.10.10'), true)
  assert.equal(isPrivateOrLoopbackIp('8.8.8.8'), false)
})

test('csrf guard allows safe method', () => {
  let nextCalled = false
  const guard = createCsrfOriginGuard({
    isProd: true,
    allowNullOrigin: false,
    disableCheck: false,
    corsAllowlist: new Set(['https://app.example.com']),
  })
  const req = createReq({ method: 'GET', cookies: { token: 'x' } })
  const res = createRes()
  guard(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

test('csrf guard blocks prod missing origin for cookie auth', () => {
  let nextCalled = false
  const guard = createCsrfOriginGuard({
    isProd: true,
    allowNullOrigin: false,
    disableCheck: false,
    corsAllowlist: new Set(['https://app.example.com']),
  })
  const req = createReq({ method: 'POST', cookies: { token: 'x' } })
  const res = createRes()
  guard(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
})

test('csrf guard allows allowed origin', () => {
  let nextCalled = false
  const guard = createCsrfOriginGuard({
    isProd: true,
    allowNullOrigin: false,
    disableCheck: false,
    corsAllowlist: new Set(['https://app.example.com']),
  })
  const req = createReq({ method: 'POST', origin: 'https://app.example.com', cookies: { token: 'x' } })
  const res = createRes()
  guard(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

test('internal verifier accepts static key', () => {
  let nextCalled = false
  const verifier = createInternalRequestVerifier({
    staticKey: 'abc',
    hmacSecret: '',
  })
  const req = createReq({ headers: { 'x-internal-key': 'abc' } })
  const res = createRes()
  verifier(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

test('internal verifier validates hmac + blocks replay', () => {
  const now = Date.now()
  let nowTick = now
  const verifier = createInternalRequestVerifier({
    staticKey: '',
    hmacSecret: 'supersecret',
    now: () => nowTick,
  })

  const sig = computeInternalHmac({
    secret: 'supersecret',
    timestamp: now,
    method: 'POST',
    path: '/internal/alerts/evaluate-now',
    contentSha256: '',
  })

  const req1 = createReq({
    method: 'POST',
    path: '/internal/alerts/evaluate-now',
    headers: {
      'x-internal-timestamp': String(now),
      'x-internal-signature': sig,
    },
  })
  const res1 = createRes()
  let next1 = false
  verifier(req1, res1, () => { next1 = true })
  assert.equal(next1, true)

  const req2 = createReq({
    method: 'POST',
    path: '/internal/alerts/evaluate-now',
    headers: {
      'x-internal-timestamp': String(now),
      'x-internal-signature': sig,
    },
  })
  const res2 = createRes()
  let next2 = false
  verifier(req2, res2, () => { next2 = true })
  assert.equal(next2, false)
  assert.equal(res2.statusCode, 409)

  nowTick = now + 10 * 60 * 1000
  const req3 = createReq({
    method: 'POST',
    path: '/internal/alerts/evaluate-now',
    headers: {
      'x-internal-timestamp': String(now),
      'x-internal-signature': sig,
    },
  })
  const res3 = createRes()
  let next3 = false
  verifier(req3, res3, () => { next3 = true })
  assert.equal(next3, false)
  assert.equal(res3.statusCode, 401)
})
