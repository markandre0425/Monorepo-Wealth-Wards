import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { registerProfileRoutes } from '../routes/profile-routes.js'
import { registerInternalRoutes } from '../routes/internal-routes.js'

function jsonFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'content-type': 'application/json',
    },
  })
}

test('registerProfileRoutes mounts endpoints', async (t) => {
  const app = express()
  app.use(express.json())

  const profileStore = {
    _map: new Map(),
    get(k) { return this._map.get(k) || null },
    async set(k, v) { this._map.set(k, v) },
  }

  function requireAuth(req, _res, next) {
    req.user = { address: '0x1111111111111111111111111111111111111111' }
    next()
  }

  registerProfileRoutes({
    app,
    requireAuth,
    UserProfile: null,
    mongoReady: false,
    profileStore,
    getManilaTime: () => 'manila',
  })

  const server = app.listen(0)
  t.after(() => server.close())
  const port = server.address().port

  const saveRes = await jsonFetch(`http://127.0.0.1:${port}/api/user/profile`, {
    method: 'POST',
    body: JSON.stringify({ displayName: 'Andre' }),
  })
  assert.equal(saveRes.status, 200)

  const getRes = await jsonFetch(`http://127.0.0.1:${port}/api/user/profile`)
  assert.equal(getRes.status, 200)
  const payload = await getRes.json()
  assert.equal(payload?.ok, true)
  assert.equal(payload?.profile?.displayName, 'Andre')
})

test('registerInternalRoutes mounts health and evaluator route', async (t) => {
  const app = express()
  app.use(express.json())

  let verifyHit = false
  const verifyInternalRequest = (_req, _res, next) => { verifyHit = true; next() }

  registerInternalRoutes({
    app,
    verifyInternalRequest,
    assertAlertsReady: (res) => {
      res.status(503).json({ ok: false, error: 'Alerts require MongoDB (MONGO_URI)' })
      return false
    },
    AlertRule: null,
    AlertEvent: null,
    Notification: null,
    evaluateRuleSignal: async () => ({ triggered: false }),
    alertsWorkerState: { lastRunAt: null, lastDurationMs: null, lastSummary: null },
    isProd: false,
  })

  const server = app.listen(0)
  t.after(() => server.close())
  const port = server.address().port

  const evalRes = await jsonFetch(`http://127.0.0.1:${port}/internal/alerts/evaluate-now`, { method: 'POST', body: '{}' })
  assert.equal(verifyHit, true)
  assert.equal(evalRes.status, 503)

  const healthRes = await jsonFetch(`http://127.0.0.1:${port}/internal/alerts/health`)
  assert.equal(healthRes.status, 200)

  const cspRes = await jsonFetch(`http://127.0.0.1:${port}/internal/csp-report`, { method: 'POST', body: '{}' })
  assert.equal(cspRes.status, 204)
})
