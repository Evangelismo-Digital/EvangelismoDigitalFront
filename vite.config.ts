import { defineConfig, loadEnv, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import prerender from '@prerenderer/rollup-plugin'
import chromium from '@sparticuz/chromium'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { analyticsProxy } from './scripts/analytics-proxy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Automatically discover article routes
const articlesDir = path.resolve(__dirname, './src/articleContent/articlesData')
const articleFiles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
const articleRoutes = articleFiles.map(file => `/artigo/${file.replace('.mdx', '')}`)

// https://vite.dev/config/
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  // '' loads every variable for use here, in the config only; envPrefix below still limits what the bundle sees.
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = analyticsProxy(env)

  return {
  plugins: [
    { enforce: 'pre', ...mdx({ 
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      providerImportSource: '@mdx-js/react'
      }) 
    },
    react(),
    prerender({
      routes: ['/', '/privacidade', ...articleRoutes],
      renderer: '@prerenderer/renderer-puppeteer',
      rendererOptions: {
        renderAfterTime: 5000,
        // Read by the app as window.__PRERENDER_INJECTED: no consent banner or analytics in static HTML.
        inject: { prerendering: true },
        maxConcurrentRoutes: 1,
        headless: true,
        executablePath: process.env.VERCEL 
          ? await chromium.executablePath()
          : undefined,
        args: process.env.VERCEL
          ? chromium.args
          : [
              '--no-sandbox', 
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu'
            ],
        puppeteerLaunchOptions: {
          timeout: 60000
        }
      },
      postProcess(renderedRoute) {
        renderedRoute.html = renderedRoute.html.replace(
          /<script(?![^>]*type="application\/ld\+json")([^>]*)>/gi,
          '<script$1 defer>'
        )
      }
    })
  ],
  envPrefix: 'CONFIG_',
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: 'dist'
  }
  }
})
