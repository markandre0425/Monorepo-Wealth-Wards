export function registerProfileRoutes({
  app,
  requireAuth,
  UserProfile,
  mongoReady,
  profileStore,
  getManilaTime,
}) {
  const isMongoReady = typeof mongoReady === 'function' ? mongoReady : () => Boolean(mongoReady)
  app.post('/api/user/profile', requireAuth, async (req, res) => {
    const address = req.user?.address ?? null
    if (!address) return res.status(403).json({ ok: false, error: 'Wallet address required' })

    const { displayName, email, bio, avatarUrl, settings } = req.body ?? {}

    let existingProfile = {}
    if (typeof UserProfile !== 'undefined' && isMongoReady()) {
      try {
        existingProfile = await UserProfile.findOne({ address: address.toLowerCase() }).lean() || {}
      } catch {}
      // Fallback read to file store if Mongo has no document (prevents split-brain)
      if (!existingProfile || Object.keys(existingProfile).length === 0) {
        existingProfile = profileStore.get(address.toLowerCase()) || {}
      }
    } else {
      existingProfile = profileStore.get(address.toLowerCase()) || {}
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
      if (UserProfile && isMongoReady()) {
        await UserProfile.findOneAndUpdate(
          { address: address.toLowerCase() },
          { ...profileData, updatedAtLocal: getManilaTime() },
          { upsert: true, returnDocument: 'after' }
        )
        // Keep file store in sync as a warm backup for future fallback reads.
        await profileStore.set(address.toLowerCase(), profileData)
      } else {
        await profileStore.set(address.toLowerCase(), profileData)
      }
      return res.json({ ok: true, profile: profileData })
    } catch (err) {
      console.error('Failed to save profile:', err)
      return res.status(500).json({ ok: false, error: 'Failed to save profile' })
    }
  })

  app.get('/api/user/profile', requireAuth, async (req, res) => {
    const address = req.user?.address ?? null
    if (!address) return res.status(403).json({ ok: false, error: 'Wallet address required' })

    try {
      let profile = null
      if (UserProfile && isMongoReady()) {
        profile = await UserProfile.findOne({ address: address.toLowerCase() }).lean()
        // Fallback read to file store if Mongo has no profile yet for this wallet.
        if (!profile) {
          profile = profileStore.get(address.toLowerCase())
        }
      } else {
        profile = profileStore.get(address.toLowerCase())
      }

      if (!profile) {
        return res.json({ ok: true, profile: null })
      }

      return res.json({ ok: true, profile })
    } catch (err) {
      console.error('Failed to retrieve profile:', err)
      return res.status(500).json({ ok: false, error: 'Failed to retrieve profile' })
    }
  })
}
