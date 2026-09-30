# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Portuguese-language (pt-BR) evangelism site published at `https://www.findhope.digital`. React 19 + TypeScript + Vite SPA, deployed on Vercel (`vercel.json` sets `cleanUrls`). All user-facing copy is in Portuguese; keep it that way.

## Commands

```bash
npm run dev                # Vite dev server
npm run build              # runs prebuild (sitemap) -> tsc -b -> vite build (includes prerender)
npm run generate:sitemap   # regenerate public/sitemap.xml via tsx
npm run lint               # eslint .
npm run preview            # serve dist/
```

There is no test setup in this repo — no test runner, no test files.

`.npmrc` sets `save-exact=true`, so `npm install <pkg>` pins exact versions. `.env` holds `VITE_API_URL` (backend base URL) and is not committed.

## Architecture

**Routing** — `src/routes/router.tsx` (`createBrowserRouter`) has two routes under `Layout` (NavBar + container + Footer): `/` → `HomePageWrapper`, `/artigo/:artigoId` → `ArticlePage`. The home page is a single scrolling page; the NavBar links to `/?section=artigos|quem-somos|contato`, and `HomePageWrapper` reads that query param and passes it to `HomePage`, which scrolls the matching ref into view.

**Prerendering / hydration** — `vite.config.ts` runs `@prerenderer/rollup-plugin` with Puppeteer at build time over `/` plus one route per `.mdx` file in `src/articleContent/articlesData`. It also defers every non-JSON-LD `<script>` in the output. `src/main.tsx` therefore branches: if `#root` already has children it calls `hydrateRoot`, otherwise `createRoot`. Anything rendered must be hydration-safe and must finish within the 5s `renderAfterTime` window. On Vercel the renderer uses `@sparticuz/chromium`; locally it uses the bundled Puppeteer with `--no-sandbox`.

**Articles are MDX** — article bodies live in `src/articleContent/articlesData/<slug>.mdx` with YAML frontmatter (`title`, `slug`, `datePublished`, `dateModified`, `author`, `imgMainCoverPage`, `imgArticle`, `imgAlt`, `description`), processed by `@mdx-js/rollup` with `remark-frontmatter` + `remark-mdx-frontmatter`. `ArticlePage` loads them lazily via `import.meta.glob('../articleContent/articlesData/*.mdx')` keyed on the URL slug — so the route param *is* the filename. A missing file renders the "Página não encontrada" branch.

The parallel `<slug>.ts` files exporting the `Article` interface (`src/interface/Articles.ts`) are legacy: nothing in `src/` imports them. Only `scripts/generate-sitemap.ts` still reads them, and it only emits a sitemap entry for articles whose `.ts` module has a `dateModified`.

**Adding an article** touches four places:
1. `articlesData/<slug>.mdx` — the content and frontmatter (drives rendering, SEO, and the prerender route list).
2. `articlesData/<slug>.ts` — needed only so the sitemap picks the URL up (`dateModified` is required).
3. `src/articleContent/ArticlesIndex.ts` — the home-page card listing (`id` must equal the slug); `src/components/Artigos.tsx` paginates this at 3 per page.
4. `src/config/callToActionContent.ts` — keyed by slug, with a `default` fallback via `getCallToActionContent`.

**SEO** — `src/components/SEO.tsx` is a render-nothing component that imperatively writes `document.title`, meta/OG/Twitter tags, the canonical link and a JSON-LD `<script id="jsonld-seo">` in an effect, and removes the elements it created on unmount so SPA navigation doesn't leak tags. `index.html` carries the static fallback copy of those tags. Base URL and defaults are hardcoded in both `SEO.tsx` and `scripts/generate-sitemap.ts`.

**Backend calls** — `src/config/api.ts` exports `API_URL` from `import.meta.env.VITE_API_URL`. Two endpoints are used: `POST /forms/submit-form` (via the TanStack Query mutation in `src/hook/useFormSubmission.tsx`) and `POST /churches/find-nearest` (in `FindNearestChurch.tsx`). Backend errors matching the `ErrorResponse` shape are detected by `src/util/isErrorResponse.ts`.

**Forms** — `FormContato.tsx` holds the shared react-hook-form + Zod form and the success/error modals; `FormContatoHome` and `FormContatoArticle` are thin wrappers around it. `FindNearestChurch` has its own Zod schema (email + 8-digit CEP) and a `SHOW_STATIC_MAP` constant that short-circuits the Google Maps integration until the backend is ready.

**Styling** — Bootstrap 5 (CSS + JS bundle imported in `main.tsx`) for layout/utility classes, plus per-component CSS Modules in `src/components/css/` and `src/pages/css/`. Images are `.webp` in `public/`, referenced by root-relative path.
