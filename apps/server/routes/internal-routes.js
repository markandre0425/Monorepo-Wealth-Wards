export function registerInternalRoutes({
  app,
  verifyInternalRequest,
  assertAlertsReady,
  AlertRule,
  AlertEvent,
  Notification,
  evaluateRuleSignal,
  alertsWorkerState,
  isProd,
}) {
  app.post('/internal/alerts/evaluate-now', verifyInternalRequest, async (req, res) => {
    if (!assertAlertsReady(res)) return

    const startedAt = Date.now()
    let evaluatedRules = 0
    let triggered = 0
    let createdNotifications = 0

    try {
      const rules = await AlertRule.find({ isEnabled: true }).lean()
      evaluatedRules = rules.length

      for (const rule of rules) {
        const now = Date.now()
        const cooldownMs = Math.max(Number(rule.cooldownMinutes || 60), 1) * 60 * 1000
        const lastTriggeredAt = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : null
        if (lastTriggeredAt && now - lastTriggeredAt < cooldownMs) continue

        const signal = await evaluateRuleSignal(rule)
        if (!signal?.triggered) continue
        triggered += 1

        const timeBucket = Math.floor(now / cooldownMs)
        const dedupeKey = `trigger:${rule._id}:${timeBucket}`
        const existing = await AlertEvent.findOne({ dedupeKey }).lean()
        if (existing) continue

        await AlertEvent.create({
          alertRuleId: rule._id,
          dedupeKey,
          evaluatedAt: new Date(),
          payload: {
            kind: 'ALERT_TRIGGER',
            ruleType: rule.ruleType,
            metadata: signal.metadata ?? {},
          },
        })

        await Notification.create({
          userId: rule.userId,
          walletAddress: rule.walletAddress,
          alertRuleId: rule._id,
          type: 'ALERT_TRIGGERED',
          severity: signal.severity || 'WARNING',
          title: signal.title || 'Alert triggered',
          message: signal.message || 'Your alert rule was triggered.',
          metadata: signal.metadata ?? {},
          status: 'UNREAD',
        })

        await AlertRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: new Date() } })
        createdNotifications += 1
      }

      const durationMs = Date.now() - startedAt
      alertsWorkerState.lastRunAt = new Date().toISOString()
      alertsWorkerState.lastDurationMs = durationMs
      alertsWorkerState.lastSummary = { evaluatedRules, triggered, createdNotifications }

      return res.json({ ok: true, evaluatedRules, triggered, createdNotifications, durationMs })
    } catch (err) {
      const durationMs = Date.now() - startedAt
      alertsWorkerState.lastRunAt = new Date().toISOString()
      alertsWorkerState.lastDurationMs = durationMs
      alertsWorkerState.lastSummary = { evaluatedRules, triggered, createdNotifications, error: err?.message || 'unknown' }
      return res.status(500).json({ ok: false, error: 'Failed to evaluate alerts' })
    }
  })

  app.post('/internal/csp-report', (req, res) => {
    if (!isProd || process.env.LOG_CSP_REPORTS === 'true') {
      console.warn('[csp-report]', JSON.stringify(req.body || {}))
    }
    return res.status(204).end()
  })

  app.get('/internal/alerts/health', (_req, res) => {
    return res.json({
      ok: true,
      worker: 'healthy',
      lastRunAt: alertsWorkerState.lastRunAt,
      lastDurationMs: alertsWorkerState.lastDurationMs,
      lastSummary: alertsWorkerState.lastSummary,
    })
  })
}
