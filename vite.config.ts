import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import prerender from '@prerenderer/rollup-plugin'
import chromium from '@sparticuz/chromium'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Automatically discover article routes
const articlesDir = path.resolve(__dirname, './src/articleContent/articlesData')
const articleFiles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
const articleRoutes = articleFiles.map(file => `/artigo/${file.replace('.mdx', '')}`)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ 
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      providerImportSource: '@mdx-js/react'
      }) 
    },
    react(),
    prerender({
      routes: ['/', ...articleRoutes],
      renderer: '@prerenderer/renderer-puppeteer',
      rendererOptions: {
        renderAfterTime: 5000,
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
  build: {
    outDir: 'dist'
  }
})