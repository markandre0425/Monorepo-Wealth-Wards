import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { registerAlertsRoutes } from '../routes/alerts-routes.js'

function jsonFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'content-type': 'application/json',
    },
  })
}

test('registerAlertsRoutes mounts list endpoint and enforces auth context', async (t) => {
  const app = express()
  app.use(express.json())

  const AlertRule = {
    find() {
      return {
        sort() {
          return {
            lean: async () => [],
          }
        },
      }
    },
  }

  const Notification = {
    countDocuments: async () => 0,
  }

  function requireAuth(req, _res, next) {
    req.user = { sub: 'u1', address: '0x1111111111111111111111111111111111111111' }
    next()
  }

  registerAlertsRoutes({
    app,
    requireAuth,
    assertAlertsReady: () => true,
    getAuthContext: (req) => ({ userId: req.user.sub, walletAddress: req.user.address }),
    parseAlertRuleInput: () => ({ value: {} }),
    mapRule: (x) => x,
    mapNotification: (x) => x,
    encodeCursor: () => 'cursor',
    decodeCursor: () => null,
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    NOTIFICATION_STATUSES: ['UNREAD', 'READ', 'ARCHIVED'],
    AlertRule,
    Notification,
  })

  const server = app.listen(0)
  t.after(() => server.close())
  const port = server.address().port

  const rulesRes = await jsonFetch(`http://127.0.0.1:${port}/api/alerts/rules`)
  assert.equal(rulesRes.status, 200)
  const rulesBody = await rulesRes.json()
  assert.equal(rulesBody.ok, true)
  assert.deepEqual(rulesBody.rules, [])
})
