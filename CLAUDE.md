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
npm test                   # Vitest unit/component tests (src/**/*.test.ts(x))
npm run test:e2e           # Playwright E2E over desktop/tablet/mobile (starts dev server, backend mocked)
npm run test:api           # opt-in: API contract tests against a running backend (API_BASE_URL, default http://localhost:3333)
npm run test:e2e:real      # opt-in: Playwright against the running backend (starts its own dev server on 5173 for the backend's CORS: stop any other one first)
npm run test:mutation      # Stryker over all of src (informational; the gate scopes it)
npm run prepush            # the pre-push gate (see below)
```

**Tests** — Vitest + React Testing Library, configured in `vitest.config.ts` (kept separate from `vite.config.ts` so the prerender plugin never loads; jsdom, setup in `src/test/setup.ts`). Playwright specs live in `e2e/`, configured in `playwright.config.ts` (Chromium projects `desktop`/`tablet`/`mobile`; its own dev server on port 5199 with fake `CONFIG_*` values, never reused), type-checked via `tsconfig.test.json`. Mock backend and Web3Forms requests in E2E. The opt-in real-backend suites (`api-tests/`, `e2e-real/`) need `EvangelismoDigitalBackend` running locally (`docker compose up -d`, `npm run db:seed`, `npm run dev`); they derive expectations from live API responses and still stub Web3Forms so no real lead is sent. Project skills for both are in `.agents/skills` (linked into `.claude/skills`).

**Pre-push gate** — this project's gate is ESLint + Vitest + Playwright + Stryker (not ruff/pytest/mutmut). `scripts/prepush.sh [base]` runs, in order and with these scopes:
1. **lint** — `eslint . --max-warnings 0` over the whole repo, then `tsc -b`.
2. **unit** — `vitest run`, the full suite (`src/**/*.test.ts(x)`, `scripts/**/*.test.ts`).
3. **e2e** — `playwright test`, all specs on `desktop`, `tablet` and `mobile`.
4. **mutation** — `scripts/mutation-gate.ts` runs Stryker only on the `src` lines added or changed in `base...HEAD` (tests, `src/test/`, `*.d.ts` and `main.tsx` excluded; skipped when no source line changed). It fails on any `Survived` or `NoCoverage` mutant: kill it with a test, or mark a proven equivalent with `// Stryker disable next-line <Mutator>: <reason>`.

`base` defaults to the merge-base with `origin/main`. A local, unversioned `.git/hooks/pre-push` calls the script with the pushed range and refuses to run with uncommitted tracked changes or when the pushed ref is not `HEAD`. After fixing a failed step, re-run just that step with `PREPUSH_ONLY=lint|unit|e2e|mutation npm run prepush`; `PREPUSH_DRYRUN=1` prints the mutation scope. Never bypass with `--no-verify` without the user's say-so. Stryker sandboxes skip `.claude`/`.agents` (`ignorePatterns`) because the skill symlinks break its copy step.

`.npmrc` sets `save-exact=true`, so `npm install <pkg>` pins exact versions. `.env` holds `CONFIG_API_URL` (backend base URL) and `CONFIG_WEB3FORMS_ACCESS_KEY`. `vite.config.ts` sets `envPrefix: 'CONFIG_'` (not the default `VITE_`); both values are public in the bundle. `.env` is not committed.

## Architecture

**Routing** — `src/routes/router.tsx` (`createBrowserRouter`) has two routes under `Layout` (NavBar + container + Footer): `/` → `HomePageWrapper`, `/artigo/:artigoId` → `ArticlePage`. The home page is a single scrolling page; the NavBar links to `/?section=artigos|recursos|quem-somos|contato|encontre-uma-igreja` (list `NAV_SECTIONS` in `NavBar.tsx`; tapping one folds the mobile menu back), and `HomePageWrapper` reads that query param and passes it to `HomePage`, which scrolls the matching ref into view once fonts and images have loaded. Each target carries `styles.section` (`scroll-margin-top`) so its heading clears the fixed 57px navbar.

**Prerendering / hydration** — `vite.config.ts` runs `@prerenderer/rollup-plugin` with Puppeteer at build time over `/` plus one route per `.mdx` file in `src/articleContent/articlesData`. It also defers every non-JSON-LD `<script>` in the output. `src/main.tsx` therefore branches: if `#root` already has children it calls `hydrateRoot`, otherwise `createRoot`. Anything rendered must be hydration-safe and must finish within the 5s `renderAfterTime` window. On Vercel the renderer uses `@sparticuz/chromium`; locally it uses the bundled Puppeteer with `--no-sandbox`.

**Articles are MDX** — article bodies live in `src/articleContent/articlesData/<slug>.mdx` with YAML frontmatter (`title`, `slug`, `datePublished`, `dateModified`, `author`, `imgMainCoverPage`, `imgArticle`, `imgAlt`, `description`), processed by `@mdx-js/rollup` with `remark-frontmatter` + `remark-mdx-frontmatter`. `ArticlePage` loads them lazily via `import.meta.glob('../articleContent/articlesData/*.mdx')` keyed on the URL slug — so the route param *is* the filename. A missing file renders the "Página não encontrada" branch.

The parallel `<slug>.ts` files exporting the `Article` interface (`src/interface/Articles.ts`) are legacy: nothing in `src/` imports them. Only `scripts/generate-sitemap.ts` still reads them, and it only emits a sitemap entry for articles whose `.ts` module has a `dateModified`.

**Adding an article** touches four places:
1. `articlesData/<slug>.mdx` — the content and frontmatter (drives rendering, SEO, and the prerender route list).
2. `articlesData/<slug>.ts` — needed only so the sitemap picks the URL up (`dateModified` is required).
3. `src/articleContent/ArticlesIndex.ts` — the home-page card listing (`id` must equal the slug); `src/components/Artigos.tsx` paginates this at 3 per page.
4. `src/config/callToActionContent.ts` — keyed by slug, with a `default` fallback via `getCallToActionContent`.

**SEO** — `src/components/SEO.tsx` is a render-nothing component that imperatively writes `document.title`, meta/OG/Twitter tags, the canonical link and a JSON-LD `<script id="jsonld-seo">` in an effect, and removes the elements it created on unmount so SPA navigation doesn't leak tags. `index.html` carries the static fallback copy of those tags. Base URL and defaults are hardcoded in both `SEO.tsx` and `scripts/generate-sitemap.ts`.

**Backend calls** — `src/config/api.ts` exports `API_URL` (`CONFIG_API_URL`) and `WEB3FORMS_ACCESS_KEY`. The backend (`~/EvangelismoDigitalBackend`, NestJS layout on Fastify) is called only by `GET /churches/nearest?cep=&mode=pedestrian|transport` in `src/util/nearestChurchesApi.ts`, which validates the payload with Zod and maps HTTP status + backend `code` to the approved pt-BR messages (`NEAREST_CHURCHES_MESSAGES`). Backend errors are `{ message, code }` (`ErrorResponse`, guarded by `src/util/isErrorResponse.ts`). Both forms post to Web3Forms through `src/util/web3forms.ts`: the contact form via `useFormSubmission`, and every church search via `src/util/churchSearchLead.ts` (email, CEP, travel mode and nearest church, sent once the result is known).

**Forms** — `FormContato.tsx` holds the shared react-hook-form + Zod form and the success/error modals; `FormContatoHome` and `FormContatoArticle` are thin wrappers around it. `FindNearestChurch` uses `src/util/churchSearchSchema.ts` (travel mode, CEP required and masked, email required) and renders `ChurchListView`. It is a card like the contact form: the inline illustration `ChurchRouteIllustration` beside the form (above it below 992px), line icons from `FindNearestChurchIcons.tsx`, a CEP explanation linking to the Correios lookup, and "Buscar igrejas" below both fields; after a search the results replace the illustration (beside the form, or under the button below 992px) and are scrolled into view, clear of the fixed navbar. The travel mode (`src/util/travelMode.ts`: "A pé" default / "De carro") is a radio switch; changing it after a search repeats it, and an empty walking search offers "Ver igrejas de carro". The list is drawn as a route from the CEP through each church and is zero-map: no Maps SDK, each card is an `<a>` to a Google Maps URL (`api=1`) built by `src/util/googleMapsUrl.ts`, plus a "Como chegar" directions link that starts at the backend's `origin` (the point the CEP resolved to; without it Google Maps would start at the device's own location). Results come from `useNearestChurches` (TanStack Query keyed by CEP; `nearestChurchesQueryOptions` lets the lead sender share that cache entry). `main.tsx` uses `PersistQueryClientProvider` (`src/config/queryPersistence.ts`): only successful nearest-church queries are saved to `localStorage` for 7 days; bump `PERSIST_BUSTER` when the cached shape changes (now `church-list-v3`: `{ origin, churches }`). Design and phases: `docs/find-nearest-church-list-plan.md`.

**Styling** — Bootstrap 5 (CSS + JS bundle imported in `main.tsx`) for layout/utility classes, plus per-component CSS Modules in `src/components/css/` and `src/pages/css/`. Images are `.webp` in `public/`, referenced by root-relative path.
