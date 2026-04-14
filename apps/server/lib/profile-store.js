import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

export function createProfileStore({ baseDir, storagePath }) {
  const resolvedPath = storagePath || process.env.PROFILE_STORE_PATH || join(baseDir, '.runtime', 'user-profiles.json')

  let profileMemory = new Map()

  async function load() {
    try {
      const content = await readFile(resolvedPath, 'utf8')
      const data = JSON.parse(content)
      profileMemory = new Map(Object.entries(data))
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to load profiles from file:', err.message)
      }
      profileMemory = new Map()
    }
  }

  async function save() {
    try {
      const data = Object.fromEntries(profileMemory)
      await writeFile(resolvedPath, JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('Failed to save profiles to file:', err.message)
    }
  }

  function get(address) {
    return profileMemory.get(String(address).toLowerCase()) || null
  }

  async function set(address, profileData) {
    profileMemory.set(String(address).toLowerCase(), profileData)
    await save()
  }

  return {
    path: resolvedPath,
    load,
    save,
    get,
    set,
  }
}
