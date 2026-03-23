import { defineConfig } from 'vite'
import path from 'path'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, 'public')

// Plugin to resolve figma:asset imports to placeholder data URIs
const figmaAssetPlugin = {
  name: 'figma-asset-resolver',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id.startsWith('figma:asset/')) {
      // Return a normalized, absolute module ID
      return { id: `\0${id}`, external: false }
    }
  },
  load(id: string) {
    if (id.startsWith('\0figma:asset/')) {
      // Return a placeholder gray image as a data URI
      const placeholderDataUri = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23cccccc%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'
      return `export default "${placeholderDataUri}"`
    }
  },
}

// When embedded in landing: BASE_URL=/dashboard/ (web) or BASE_URL=./ (Electron).
// In dev (serve): use /dashboard/ so app is at http://localhost:3001/dashboard/
export default defineConfig(({ command }) => ({
  base: process.env.BASE_URL ?? (command === 'serve' ? '/dashboard/' : './'),
  envDir: '../../',
  plugins: [
    figmaAssetPlugin,
    react(),
    tailwindcss(),
    // Serve public/avatar under base path so /dashboard/avatar/*.jpg work in dev (run first)
    {
      name: 'serve-avatar-under-base',
      configureServer(server) {
        const base = process.env.BASE_URL || '/dashboard/'
        
        // Redirect root / to /dashboard/ for convenience
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '') {
            const redirectTarget = base.endsWith('/') ? base : base + '/'
            res.writeHead(302, { Location: redirectTarget })
            res.end()
            return
          }
          next()
        })

        const prefix = base + '/avatar/'
        const handle = async (req: any, res: any, next: () => void) => {
          const url = req.url?.split('?')[0]
          if (!url?.startsWith(prefix)) return next()
          const name = url.slice(prefix.length)
          if (!/^avatar\d+\.jpg$/.test(name)) return next()
          const filePath = path.join(publicDir, 'avatar', name)
          try {
            await stat(filePath)
            res.setHeader('Content-Type', 'image/jpeg')
            createReadStream(filePath).pipe(res)
          } catch {
            next()
          }
        }
        server.middlewares.stack.unshift({ route: '', handle })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    port: 5174,
    proxy: {
      '/api/coingecko': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
      },
      '/api/': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
}))
