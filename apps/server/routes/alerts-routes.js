export function registerAlertsRoutes({
  app,
  requireAuth,
  assertAlertsReady,
  getAuthContext,
  parseAlertRuleInput,
  mapRule,
  mapNotification,
  encodeCursor,
  decodeCursor,
  mongoose,
  NOTIFICATION_STATUSES,
  AlertRule,
  Notification,
}) {
  app.get('/api/alerts/rules', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    try {
      const rules = await AlertRule.find({ userId, walletAddress: walletAddress.toLowerCase() }).sort({ createdAt: -1 }).lean()
      return res.json({ ok: true, rules: rules.map(mapRule) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to list alert rules' })
    }
  })

  app.post('/api/alerts/rules', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    const validation = parseAlertRuleInput(req.body)
    if (validation.error) return res.status(400).json({ ok: false, error: validation.error })
    try {
      const activeCount = await AlertRule.countDocuments({ userId, walletAddress: walletAddress.toLowerCase(), isEnabled: true })
      if (activeCount >= 20) return res.status(429).json({ ok: false, error: 'Active alert rule limit reached (20)' })
      const doc = await AlertRule.create({ userId, walletAddress: walletAddress.toLowerCase(), isEnabled: true, ...validation.value })
      return res.status(201).json({ ok: true, rule: mapRule(doc.toObject()) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to create alert rule' })
    }
  })

  app.patch('/api/alerts/rules/:id', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ ok: false, error: 'Rule not found' })

    const updates = {}
    if (req.body.ruleType || req.body.target || req.body.condition || req.body.cooldownMinutes != null || req.body.isEnabled != null) {
      const merged = {
        ruleType: req.body.ruleType,
        target: req.body.target,
        condition: req.body.condition,
        cooldownMinutes: req.body.cooldownMinutes,
        isEnabled: req.body.isEnabled,
      }
      const hasCore = merged.ruleType || merged.target || merged.condition
      if (hasCore) {
        const validation = parseAlertRuleInput({
          ruleType: merged.ruleType,
          target: merged.target,
          condition: merged.condition,
          cooldownMinutes: merged.cooldownMinutes,
          isEnabled: merged.isEnabled,
        })
        if (validation.error) return res.status(400).json({ ok: false, error: validation.error })
        Object.assign(updates, validation.value)
      } else {
        if (merged.cooldownMinutes != null) {
          const cooldown = Number(merged.cooldownMinutes)
          if (!Number.isFinite(cooldown) || cooldown <= 0) return res.status(400).json({ ok: false, error: 'Invalid cooldownMinutes' })
          updates.cooldownMinutes = cooldown
        }
        if (merged.isEnabled != null) updates.isEnabled = Boolean(merged.isEnabled)
      }
    }

    try {
      const doc = await AlertRule.findOneAndUpdate(
        { _id: req.params.id, userId, walletAddress: walletAddress.toLowerCase() },
        { $set: updates },
        { new: true }
      ).lean()
      if (!doc) return res.status(404).json({ ok: false, error: 'Rule not found' })
      return res.json({ ok: true, rule: mapRule(doc) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to update alert rule' })
    }
  })

  app.post('/api/alerts/rules/:id/toggle', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ ok: false, error: 'Rule not found' })
    const isEnabled = Boolean(req.body?.isEnabled)
    try {
      const doc = await AlertRule.findOneAndUpdate(
        { _id: req.params.id, userId, walletAddress: walletAddress.toLowerCase() },
        { $set: { isEnabled } },
        { new: true }
      ).lean()
      if (!doc) return res.status(404).json({ ok: false, error: 'Rule not found' })
      return res.json({ ok: true, rule: mapRule(doc) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to toggle alert rule' })
    }
  })

  app.delete('/api/alerts/rules/:id', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ ok: false, error: 'Rule not found' })
    try {
      const deleted = await AlertRule.findOneAndDelete({ _id: req.params.id, userId, walletAddress: walletAddress.toLowerCase() }).lean()
      if (!deleted) return res.status(404).json({ ok: false, error: 'Rule not found' })
      return res.json({ ok: true })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to delete alert rule' })
    }
  })

  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    try {
      const count = await Notification.countDocuments({ userId, walletAddress: walletAddress.toLowerCase(), status: 'UNREAD' })
      return res.json({ ok: true, count })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to fetch unread count' })
    }
  })

  app.get('/api/notifications', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    const status = req.query.status ? String(req.query.status) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null
    const query = { userId, walletAddress: walletAddress.toLowerCase() }
    if (status && NOTIFICATION_STATUSES.includes(status)) query.status = status
    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
      ]
    }
    try {
      const docs = await Notification.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).lean()
      const nextCursor = docs.length === limit ? encodeCursor(docs[docs.length - 1]) : null
      return res.json({ ok: true, items: docs.map(mapNotification), nextCursor })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to list notifications' })
    }
  })

  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ ok: false, error: 'Notification not found' })
    try {
      const doc = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId, walletAddress: walletAddress.toLowerCase() },
        { $set: { status: 'READ', readAt: new Date() } },
        { new: true }
      ).lean()
      if (!doc) return res.status(404).json({ ok: false, error: 'Notification not found' })
      return res.json({ ok: true, item: mapNotification(doc) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to mark notification read' })
    }
  })

  app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    try {
      const result = await Notification.updateMany(
        { userId, walletAddress: walletAddress.toLowerCase(), status: 'UNREAD' },
        { $set: { status: 'READ', readAt: new Date() } }
      )
      return res.json({ ok: true, updated: result.modifiedCount ?? 0 })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to mark all notifications read' })
    }
  })

  app.post('/api/notifications/:id/archive', requireAuth, async (req, res) => {
    if (!assertAlertsReady(res)) return
    const { userId, walletAddress } = getAuthContext(req)
    if (!userId || !walletAddress) return res.status(403).json({ ok: false, error: 'Wallet address required' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ ok: false, error: 'Notification not found' })
    try {
      const doc = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId, walletAddress: walletAddress.toLowerCase() },
        { $set: { status: 'ARCHIVED' } },
        { new: true }
      ).lean()
      if (!doc) return res.status(404).json({ ok: false, error: 'Notification not found' })
      return res.json({ ok: true, item: mapNotification(doc) })
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to archive notification' })
    }
  })
}
