# Cookie consent and first-party analytics: implementation plan

> **Status:** implemented on branch `feat/cookie-consent-analytics` (2026-10-25), except the Phase 8 checks on a Vercel preview and the legal review of `/privacidade` · **Written:** 2026-10-25
> **Backend reference:** `~/EvangelismoDigitalBackend/docs/analytics-cookie-architecture.md` (backend branch `main`, `505dfd8`)
> **Scope:** this frontend (React 19 + Vite SPA, prerendered with Puppeteer, hosted on Vercel). No backend change is required.

## 1. Goal and summary

The backend already implements a complete, privacy-minded analytics subsystem:
- signed first-party cookies that identify a visitor and a visit;
- a consent cookie that gates every write;
- ingestion routes under `/analytics`;
- IP truncation, retention sweeps, and revocation with data erasure.

What is missing is the frontend half of the contract. That means:
- a consent banner;
- a same-origin proxy that injects the backend's shared secret;
- a small client that opens a session and sends events in batches;
- trackers for page views, reading time (with the emphasis on articles), the church search, outbound links and the contact form.

The backend doc describes that contract for **Next.js**. This plan re-maps it to a Vite SPA:
- a `vercel.json` route replaces the Next rewrite and header;
- a client-only consent read replaces Server Components;
- a prerender-safe banner replaces the server-rendered one.

The plan uses **no new runtime dependency**.

**Decisions already made (2026-10-25):**

| Topic | Decision |
|---|---|
| Proxy | `vercel.json` route with a request-header transform (no code). A Vercel Function proxy is the fallback if the preview check fails (§6 Phase 1). |
| Banner | "Aceitar" / "Recusar", equally prominent, for the **analytics** category only (`marketing` is always `0`; the site has no marketing). A footer link "Preferências de cookies" reopens it. |
| Library | Our own small typed consent module plus a React banner. No consent-manager library and no Zustand (§5). |
| What is tracked, after consent only | Page views and reading time, with the **emphasis on articles and time spent reading them**; the church search (never the CEP or email); outbound clicks; contact form start and submit. |

## 2. What the backend already does

The backend doc's file paths (`src/http/...`, `src/use-cases/...`) predate the NestJS module reorganisation. The real files are below; [§10](#10-corrections-for-the-backend-doc) lists the stale references.

### 2.1 Cookies: `src/common/plugins/cookies/options.ts`

| Cookie | Production / staging name | Dev / test name | Life | `HttpOnly` | `Secure` | `SameSite` | Signed | Written by |
|---|---|---|---|---|---|---|---|---|
| Visitor | `__Host-ed_vid` | `ed_vid` | 395 days | yes | yes* | `Lax` | yes | API (`/session`) |
| Session | `__Host-ed_sid` | `ed_sid` | 30 min, sliding | yes | yes* | `Lax` | yes | API (`/session`, `/events`) |
| Consent | `ed_consent` | `ed_consent` | 365 days | **no** | yes* | `Lax` | no | **Frontend** (the API only reads it and clears it on revoke) |

\* `Secure` is off only when `NODE_ENV` is `development` or `test` (`isPlainHttpEnv`). The `__Host-` prefix needs HTTPS, so it is only used where `Secure` is on (`hostPrefixed()`). Every cookie has `Path=/` and **no `Domain`**.

Signing uses `COOKIE_SECRET` and, during rotation, `COOKIE_SECRET_PREVIOUS` (`cookie-secrets.ts`, registered in `src/app.ts`). The frontend never sees or handles these values.

### 2.2 Consent format: `src/common/plugins/cookies/consent.ts`

- Format: `v1:analytics=1,marketing=0`. `CONSENT_VERSION = 'v1'`.
- **Granted** only if the value starts with `v1:` and contains the exact token `analytics=1`.
  - Absent, malformed, another version, `analytics=0`, `analytics=true`, or a bare `analytics` all read as **denied**.
- Only `analytics` gates anything. `marketing` is parsed but unused.
- Bumping `CONSENT_VERSION` invalidates every stored choice, so everyone is asked again.

### 2.3 Routes: `src/modules/analytics/analytics.module.ts`

All ingestion routes run `verifyAnalyticsProxy` (`src/common/guards/verify-analytics-proxy.guard.ts`).
- The header `x-analytics-proxy` must equal `ANALYTICS_PROXY_SECRET`, compared via SHA-256 + `timingSafeEqual`.
- A missing, repeated or wrong header gets a loud **401**, not a silent 204.
- CORS (`src/app.ts`) does not allow that header, so a browser cannot send it cross-origin. **It must be added server-side, by the proxy.**

| Route | Guard | Rate limit (per IP) | Body | Without consent | With consent |
|---|---|---|---|---|---|
| `POST /analytics/session` | proxy | 5 / min | `{ rotate?: boolean, landingPath?: string ≤2048, referrer?: string ≤2048 }` | 204, **no cookies** | Creates the visitor id if missing; reuses the session id unless `rotate`. Sets both cookies. 204. |
| `POST /analytics/events` | proxy | 60 / min | `{ events: Event[1..50] }`, **body ≤ 16 KiB, JSON** | silent 204 | Writes the events and re-sets the session cookie (slides the 30 min). 204. |
| `POST /analytics/consent/revoke` | proxy | 5 / min (shares `session`) | none | Clears all three cookies **first**, then erases that visitor's data. 204. | (same) |
| `POST /analytics/identify`, `DELETE /analytics/me` | proxy + JWT | 5 / min | none | Out of scope: this site has no login. | |

Captured context (`src/modules/analytics/controllers/session-context.ts`):
- **IP:** `request.ip`, truncated to /24 (IPv4) or /48 (IPv6) before storage (`helpers/truncate-ip.ts`).
- **Device:** `user-agent`, reduced to browser, OS and device; the raw string is not stored.
- **Language:** the first tag of `accept-language`.
- **UTM:** `utm_source|medium|campaign|term|content`, taken **from the query string of the POST URL**.
- `trustProxy: true` means `request.ip` is the **left-most `X-Forwarded-For` entry**. The proxy must pass the visitor's real IP, or every visitor shares one rate-limit bucket and the truncated IP becomes Vercel's.

Event schema (`src/modules/analytics/dto/track-event.dto.ts`):

```ts
eventType: 'page_view' | 'page_exit' | 'click' | 'form_start' | 'form_submit'
         | 'scroll_depth' | 'search' | 'outbound_click'
path: string (1..2048)          // required
title?: string (≤512)
referrer?: string (≤2048)
durationMs?: int 0..86_400_000
scrollDepth?: int 0..100
payload?: Record<string ≤512, string ≤512 | number | boolean | null>   // ≤ 20 keys
// no `occurredAt`: the server stamps the time; extra keys are silently dropped
```

Every ingestion response carries `Cache-Control: no-store`. The body parser accepts **JSON only**: a `text/plain` beacon would fail validation (§5).

### 2.4 Configuration

- **Backend:**
  - `ANALYTICS_PROXY_SECRET`: at least 32 chars. `.env.example` says it "must be identical here and in the frontend".
  - `COOKIE_SECRET`, `COOKIE_SECRET_PREVIOUS`.
  - `FRONTEND_URL`, the CORS origin. It does not matter here, because analytics calls are same-origin through the proxy.
  - `NODE_ENV`, which picks the cookie names.
- **Frontend:** new server-side variables, §6 Phase 0.

## 3. Next.js → Vite SPA mapping

| Backend doc §8 assumes (Next.js) | This SPA does |
|---|---|
| A Next rewrite of `/analytics/*` to the API that injects `x-analytics-proxy` | A `vercel.json` **route** to `${ANALYTICS_API_URL}/analytics/$1`, plus a `request.headers` **transform** that sets the header from `$ANALYTICS_PROXY_SECRET`, expanded by Vercel at request time. In dev, the Vite dev-server proxy does the same. |
| Server Components read `ed_consent` through `cookies()` | No server render at request time. Consent is read **on the client after hydration**. The Puppeteer prerender never renders the banner, so the static HTML is identical for everyone. |
| The banner writes `ed_consent` | Same, through `document.cookie`, in the exact `v1:` format. |
| Call `POST /session` at the start of navigation | Once per page load when consent is granted, and immediately after "Aceitar". The SPA's route changes are page views, not new sessions. |
| `credentials` same-origin | `fetch('/analytics/...', { credentials: 'same-origin' })`, a relative URL on the site's own origin. No CORS and no `include`. |

## 4. Architecture

```
Browser (https://www.findhope.digital)
  │  POST /analytics/session?utm_source=…   Cookie: ed_consent=v1:analytics=1,marketing=0
  ▼
Vercel CDN: vercel.json route "/analytics/(.*)"
  │  dest = ${ANALYTICS_API_URL}/analytics/$1
  │  transform: delete x-analytics-proxy (from client), set x-analytics-proxy = $ANALYTICS_PROXY_SECRET
  │  forwards Cookie, User-Agent, Accept-Language, X-Forwarded-For
  ▼
Backend API (Fastify): verifyAnalyticsProxy → consent check → write → 204
  │  Set-Cookie: __Host-ed_vid=…; Path=/; HttpOnly; Secure; SameSite=Lax   (no Domain)
  ▼
Vercel passes the response back → the browser stores the cookies as host-only cookies of www.findhope.digital
```

Why this works:
- **First-party.** The browser only ever talks to `www.findhope.digital`. Cookies set on that response belong to that host, and `SameSite=Lax` is enough. No third-party cookies, no `SameSite=None`, and no CHIPS.
- **`__Host-` is satisfied.** The response is HTTPS, the cookie is `Secure` and `Path=/`, and it has no `Domain`. The browser binds it to exactly `www.findhope.digital`. That blocks cookie fixation from a sibling subdomain, which is the backend's reason for the prefix.
- **The secret never reaches the client.** It lives only in the Vercel project's environment and the backend's. The route expands `$ANALYTICS_PROXY_SECRET` at the edge.
- **One canonical host.** Host-only cookies set on `www.findhope.digital` are not sent to `findhope.digital`, so the apex must redirect to `www`, as it does today with `canonical` = `www`. Vercel preview URLs (`*.vercel.app`) get their own separate cookies, which is fine.

## 5. Libraries, frameworks and best practices

### 5.1 Chosen

| Need | Choice | Why |
|---|---|---|
| Reading and writing `ed_consent` | **Own module** over `document.cookie` (`src/analytics/consent.ts`) | The backend dictates the exact format and the strict parse rules. A generic library would still need a wrapper. About 60 lines, fully unit-tested for parity with the backend parser. |
| Sharing consent state (banner, footer, trackers) | React **`useSyncExternalStore`** over the cookie, with a tiny subscribe/notify | One value (`unset` / `granted` / `denied`). Concurrent-safe, and its `getServerSnapshot` keeps prerender and hydration consistent. No store library needed. |
| Same-origin proxy | **`vercel.json` `routes` + `transforms`** (prod), **Vite `server.proxy` / `preview.proxy`** (dev) | No code. The secret stays server-side. |
| Sending events | **`fetch` with `keepalive: true`**, JSON body | Survives page unload, keeps the `Content-Type: application/json` header, and sends cookies same-origin. `navigator.sendBeacon` is the last-resort fallback, and only with `new Blob([json], { type: 'application/json' })`, never a plain string, which arrives as `text/plain` and fails validation. |
| Page views | **React Router `useLocation`** in a tracker mounted in `Layout` | The SPA's navigations don't reload the page. |
| Reading time | **Page Visibility API** (`visibilitychange`) | Counts only the time the tab is visible. A backgrounded article does not count as read. |
| Reading depth | **Passive, rAF-throttled `scroll` listener** measuring against the article body | Accurate "how far did they read", without jank. |
| Unit and component tests | Vitest + React Testing Library (existing) | Same stack, with fake timers for the queue and clocks. |
| E2E | Playwright (existing): mocked suite plus the real-backend suite | Same conventions as `e2e/` and `e2e-real/`. |

### 5.2 Considered and rejected

| Option | Why not |
|---|---|
| **vanilla-cookieconsent** and other consent managers | They store their own cookie (`cc_cookie`, JSON). We would have to mirror every change into `ed_consent`, keeping two sources of truth in sync. About 20 KB, plus styling the site doesn't need. |
| **js-cookie** / **universal-cookie** | A wrapper for one cookie and two functions. `document.cookie` is enough, and the parse rules have to be ours anyway. |
| **CookieStore API** | Not available in every target browser. `document.cookie` works everywhere. |
| **Zustand** (considered and rejected, 2026-10-25) | Its `persist` middleware writes JSON to `localStorage`, but the backend reads consent **only from the `ed_consent` cookie** in its `v1:` format. A custom cookie adapter would duplicate the consent module. The only shared state is one value. TanStack Query already manages the church-search `localStorage`, and the event queue is deliberately not saved to storage. Revisit if the app gains broad shared client state, such as a login or user preferences. |
| **Google Analytics / Vercel Web Analytics / Plausible** | Third-party processing, a second consent surface, and they duplicate a backend that already exists. |
| **`SameSite=None` + CHIPS cross-site cookies** | Not needed: the proxy keeps everything first-party. The backend never built it either. |
| **Vercel Routing Middleware** (`middleware.ts`, `@vercel/functions`) | Works, but it is code on every matched request. Static `routes` + `transforms` do the same job at the CDN. It remains an option if the transform proves insufficient. |

### 5.3 Best practices this plan follows

- **Nothing before consent.**
  - No `/analytics` request and no `ed_vid` / `ed_sid` before "Aceitar". The backend enforces this too.
  - The only thing written before a choice is nothing at all. `ed_consent` is written only when the person chooses.
- **Rejecting is as easy as accepting.** Two buttons of equal size, colour weight and position, with no pre-ticked choices and no dark patterns. Dismissing without choosing records nothing, and the banner returns on the next page load.
- **A choice can be changed at any time.** The footer link "Preferências de cookies" is always available. Changing to "Recusar" revokes server-side, erasing that visitor's data.
- **Global Privacy Control.** Recommended: treat `navigator.globalPrivacyControl === true` as "Recusar" without showing the banner. *To confirm with the product owner (Phase 0).*
- **Data minimisation in events.**
  - Never the CEP, the email, form field values or query strings.
  - Paths only (`location.pathname`), titles from the page, and coarse outcome flags.
- **No secret on the client.** No `CONFIG_` prefix on proxy variables, plus a test that the built `dist/` doesn't contain the secret.
- **Prerender- and hydration-safe.** The banner and trackers never run during the Puppeteer build, and nothing consent-dependent is in the static HTML.
- **Fail silent for the visitor.** Analytics errors never break a page or show messages; ad blockers that block `/analytics` must not affect the site.
- **Accessible banner.**
  - A labelled, non-modal `region` with no focus trap, so it doesn't steal focus or block content.
  - 44 px targets and WCAG AA contrast.
  - Visible focus and works at 390 px.
  - Respects `prefers-reduced-motion`.

## 6. Phases

Each phase lists its files, tasks, definition of done, and tests. The pre-push check (ESLint + Vitest + Playwright + Stryker on changed lines) applies to every phase.

### Phase 0: prerequisites and decisions

**Prerequisites and decisions:**
- [ ] **Vercel environment variables** (Project → Settings → Environment Variables), for *Production* and *Preview*. Neither is prefixed with `CONFIG_`, so neither reaches the bundle.
  - `ANALYTICS_API_URL`: the backend's public base URL, e.g. `https://api.…`. Production and preview may point at different backends.
  - `ANALYTICS_PROXY_SECRET`: **the same value** as the backend's `ANALYTICS_PROXY_SECRET` for that environment. Mark it *Sensitive*.
- [ ] **Backend environment:**
  - deployed with `NODE_ENV=production` (staging: `staging`), so the cookies are `__Host-` + `Secure`;
  - `COOKIE_SECRET` set.
- [ ] **Privacy policy content** (product owner / legal). The page `/privacidade` must state:
  - the controller and contact;
  - the purposes (understanding which content is read, to improve it);
  - the cookie table (§2.1);
  - retention: visitor 395 days without return, events and sessions 425 days;
  - IP truncation;
  - LGPD rights;
  - how to change or revoke (footer link);
  - the existing functional storage (§7).
- [ ] **Banner copy approval.** Draft below, pt-BR.
- [ ] **GPC handling** (§5.3): confirm or drop.

**Draft copy (pending approval):**

> **Cookies neste site**
> Usamos cookies próprios para entender quais páginas e artigos são lidos, e por quanto tempo, para melhorar o conteúdo. Eles só são ativados se você aceitar. Você pode mudar sua escolha a qualquer momento em "Preferências de cookies", no rodapé. [Política de privacidade]
>
> [Aceitar] [Recusar]

Footer link: **"Preferências de cookies"**.

### Phase 1: same-origin proxy

**Files:** `vercel.json`, `vite.config.ts`, `.env.example`, `CLAUDE.md`.

1. **Production (`vercel.json`).** Add a `routes` entry before the static fallthrough, and keep `cleanUrls`. Sketch:
   ```json
   {
     "cleanUrls": true,
     "routes": [
       {
         "src": "/analytics/(.*)",
         "methods": ["POST", "OPTIONS"],
         "dest": "${ANALYTICS_API_URL}/analytics/$1",
         "env": ["ANALYTICS_API_URL"],
         "transforms": [
           { "type": "request.headers", "op": "delete", "target": { "key": "x-analytics-proxy" } },
           {
             "type": "request.headers", "op": "set",
             "target": { "key": "x-analytics-proxy" },
             "args": "$ANALYTICS_PROXY_SECRET",
             "env": ["ANALYTICS_PROXY_SECRET"]
           }
         ]
       }
     ]
   }
   ```
   - The `delete` comes first, so a client-supplied header can never take the place of ours.
   - The query string (UTM) must be preserved. Verify that the destination keeps it, and append `?$query`-style capture if it doesn't.
2. **Local dev and preview (`vite.config.ts`).**
   - Read the non-public variables with `loadEnv(mode, process.cwd(), '')`. The empty prefix applies **only inside the config**; `envPrefix: 'CONFIG_'` still controls what is exposed.
   - Add the proxy:
     ```ts
     const proxy = {
       '/analytics': {
         target: env.ANALYTICS_API_URL,          // http://localhost:3333 locally
         changeOrigin: true,
         xfwd: true,                              // X-Forwarded-For = the real client
         headers: { 'x-analytics-proxy': env.ANALYTICS_PROXY_SECRET },
       },
     }
     server: { proxy }, preview: { proxy }
     ```
   - The local backend runs with `NODE_ENV=development`, so cookies are `ed_vid` / `ed_sid` without `Secure`, which works on `http://localhost:5173`.
3. **`.env.example`:** document `ANALYTICS_API_URL` and `ANALYTICS_PROXY_SECRET`, marked *server-only, never prefix with CONFIG_*.
4. **Fallback** (only if Phase 8 shows the route drops `Set-Cookie` or the client IP): `api/analytics/[...path].ts`, a Vercel Function that:
   - forwards method, body, query, `Cookie`, `User-Agent`, `Accept-Language`;
   - sets `X-Forwarded-For` from `ipAddress(request)` (`@vercel/functions`) and adds the secret header;
   - returns the upstream status;
   - copies **every** `Set-Cookie`, using `response.headers.getSetCookie()`, because a plain `get()` joins them and breaks the attributes;
   - copies `Cache-Control`.
   The route then points to `/api/analytics/$1` instead of the external origin.

**Done when:**
- `curl -X POST localhost:5173/analytics/session -H 'Cookie: ed_consent=v1:analytics=1,marketing=0' -H 'Content-Type: application/json' -d '{}' -i` returns 204 with two `Set-Cookie` headers;
- the same call without the consent cookie returns 204 with none.

**Tests:**
- Vitest: a config test that the dev proxy injects the header and `xfwd`.
- Build test: `dist/**` contains neither the secret nor `ANALYTICS_PROXY_SECRET`.

### Phase 2: consent module

**New files:** `src/analytics/consent.ts`, `src/analytics/useConsent.ts`.

```ts
export const CONSENT_COOKIE = 'ed_consent'
export const CONSENT_VERSION = 'v1'
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 365
export type ConsentState = 'unset' | 'granted' | 'denied'

serializeConsent({ analytics }): string        // 'v1:analytics=1,marketing=0' | 'v1:analytics=0,marketing=0'
parseConsent(raw: string | undefined): ConsentState
  // undefined/absent → 'unset'; mirrors the backend for everything else:
  // must start with 'v1:'; granted only with the exact token 'analytics=1';
  // any other present value (other version, malformed, =0, =true) → 'denied'
readConsent(): ConsentState                     // from document.cookie
writeConsent(analytics: boolean): void          // Max-Age, Path=/, SameSite=Lax, Secure when https:
subscribeConsent(listener) / notify             // same-tab updates; plus a 'visibilitychange' re-read for other tabs
```

- **Unset versus denied.** The backend treats both as denied. The UI needs the difference: unset shows the banner, denied doesn't. A refusal is therefore **stored** as `v1:analytics=0,marketing=0`.
- **Another version** (e.g. `v0:…` after a bump) reads as `unset`, not `denied`, so the banner asks again. This is the purpose of `CONSENT_VERSION`.
- **`useConsent()`** = `useSyncExternalStore(subscribeConsent, readConsent, () => 'unknown')`. The server and prerender snapshot is `'unknown'`, so nothing consent-dependent renders in static HTML.

**Tests (Vitest):**
- Parser parity with every backend case: absent, empty, `v1:analytics=1`, `v1:analytics=1,marketing=0`, `v1:analytics=0`, `v1:analytics=true`, `v1:analytics`, `v2:analytics=1`, whitespace around tokens, repeated keys.
- The serialised value round-trips.
- Cookie attributes: `Secure` only on https.
- Subscribe and notify.

### Phase 3: banner, preferences and privacy page

**New files:**
- `src/components/CookieConsentBanner.tsx` + CSS module;
- `src/analytics/ConsentContext.tsx`, which exposes `openPreferences()`;
- `src/pages/PrivacyPage.tsx` + route `/privacidade`.

**Edited files:** `src/routes/Layout.tsx`, `src/routes/router.tsx`, `src/components/Footer.tsx`, `vite.config.ts`, `scripts/generate-sitemap.ts`.

- **Never during the prerender.**
  - `vite.config.ts` → `rendererOptions.inject = { prerendering: true }`, which exposes `window.__PRERENDER_INJECTED` while Puppeteer renders.
  - The banner renders only when `mounted && !window.__PRERENDER_INJECTED?.prerendering && consent === 'unset'`. `mounted` is set in `useEffect`, so the first client render matches the prerendered HTML and hydration stays clean.
- **Layout and behaviour.**
  - A fixed bottom `section` with `role="region"` and `aria-labelledby` on its heading. It doesn't cover the navbar and stays above the footer on mobile.
  - Two equal buttons of at least 44 px, using the site palette from `FindNearestChurch.module.css` (`#b93a17` for text and buttons, AA).
  - No focus trap, and no auto-focus that would steal the reader's place.
- **The buttons:**
  - "Aceitar": `writeConsent(true)`, then the analytics client starts (Phase 4).
  - "Recusar": `writeConsent(false)`. If the previous state was `granted`, run Phase 6 revocation first.
- **Footer.** "Preferências de cookies" calls `openPreferences()`, which reopens the banner showing the current choice, e.g. "Sua escolha atual: aceito".
- **`/privacidade`.**
  - Renders the approved content.
  - Added to the prerender routes and the sitemap.
  - Linked from the banner and the footer.

**Tests:**
- Component: hidden while `unknown`; shown for `unset`; hidden after a choice; footer reopens it; the buttons write the right cookie.
- Hydration test: rendering with `hydrateRoot` over the prerendered markup produces no mismatch.
- E2E: the banner is absent from every `dist/**/*.html`; axe shows no A/AA violations; no horizontal overflow at 390 px.

### Phase 4: analytics client and queue

**New files:** `src/analytics/client.ts`, `src/analytics/queue.ts`, `src/analytics/AnalyticsProvider.tsx`.

- **`startSession()`:**
  - `POST /analytics/session` + the UTM params copied from `location.search`, only the five `utm_*` keys;
  - body `{ landingPath: location.pathname, referrer: document.referrer || null }`;
  - `credentials: 'same-origin'`.
  - Called **once per page load** when consent is `granted`, and immediately after "Aceitar".
  - The promise is memoised, and the queue awaits it so the first `/events` already carries the cookies.
- **Queue:**
  - `track(event)` pushes `{ eventType, path, title?, durationMs?, scrollDepth?, payload? }`.
  - Flushes every **10 s**, on `visibilitychange` → hidden, and on `pagehide`.
  - Batches of **≤ 50 events**, each serialised body **< 15 KiB** (a safety margin under the 16 KiB limit). Oversized batches are split.
  - Transport: `fetch(…, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' })`.
  - A failed send is retried once on the next flush, then dropped. No `localStorage` persistence.
- **Consent gate:** `track()` is a no-op unless consent is `granted`. On revoke the queue is cleared.
- **Rate limits** (per IP): `/session` ≤ 1 per load, well under 5/min. Batching keeps `/events` well under 60/min even for a fast reader.
- **Bots and test runs:**
  - skip when `navigator.webdriver` is true, unless `window.__ANALYTICS_E2E__` is set by the Playwright fixtures;
  - skip during the prerender (Phase 3 flag).

**Tests (Vitest, fake timers):**
- no network before consent;
- session before events;
- UTM copy, only `utm_*`;
- the 10 s flush;
- the hidden/pagehide flush uses `keepalive`;
- batches split at 50 events and by size;
- failure is retried once, then dropped;
- revoke clears the queue.

### Phase 5: trackers

**New files:** `src/analytics/trackers/useRouteTracking.ts`, `readingTracker.ts`, `outboundLinks.ts`, plus small hooks inside existing components.

1. **Page views (all routes)**, through `AnalyticsRouteTracker` in `Layout`, keyed by `location.pathname`:
   - on enter: `page_view { path, title }`. The title is read after the SEO component's effect sets `document.title`, on the next animation frame.
   - on leave (route change, tab hidden for good, or `pagehide`): `page_exit { path, durationMs, scrollDepth }`.
     - `durationMs` counts **visible time only**: the clock pauses on `visibilitychange` hidden and resumes on visible.
     - `scrollDepth` is the maximum percentage reached.
   - `?section=` navigation within `/` is not a new page view; only the path counts.
2. **Articles (`/artigo/:slug`), the main focus:**
   - Depth is measured against the **article body element**, not the whole page: `(viewport bottom − article top) / article height`, clamped to 0–100. The footer and the church section below the article do not inflate it.
   - `scroll_depth { path, scrollDepth: 25 | 50 | 75 | 100 }` fires once per milestone per view. This is the reading funnel.
   - `page_exit` carries `durationMs` (active reading time) and the final `scrollDepth`.
   - Every article event has `payload: { kind: 'article', slug }`.
   - Together these answer the backend model's question: who entered, who came back, which articles they opened, how far they read, and for how long.
3. **Church search** (`FindNearestChurch`): `search { path, payload: { mode: 'pedestrian' | 'transport', outcome: 'found' | 'none' | 'error', resultCount } }`.
   - Recorded once the result is known; this reuses the existing `resultKnown` logic.
   - **Never the CEP or the email.**
4. **Outbound links:**
   - One delegated `click` listener on `document` for `<a>` elements whose origin differs from `location.origin`.
   - Sends `outbound_click { path, payload: { host, kind } }`.
   - `kind` comes from a `data-analytics` attribute added to the links: `maps-point` ("Ver no Google Maps"), `maps-directions` ("Como chegar"), `correios`, and `social` (footer).
   - Sent through the queue, which flushes with `keepalive` on `pagehide`, so a click that leaves the tab still arrives.
5. **Contact form** (`FormContato`):
   - `form_start { path, payload: { form: 'contato-home' | 'contato-artigo' } }` on the first input, once per view;
   - `form_submit { …, payload: { form, result: 'success' | 'error' } }` from `useFormSubmission`'s outcome;
   - no field values.

**Tests:**
- Vitest: the visible-time clock, with fake timers and a mocked `document.visibilityState`.
- Vitest: article depth against a sized element; milestones fire once each; route change emits `page_exit` before the next `page_view`.
- Vitest: `search` payload has no CEP; outbound host and kind; form events.
- Mocked E2E: a scripted article read (scroll + wait) produces `page_view`, milestones and `page_exit` with `durationMs > 0`.

### Phase 6: revocation

- Choosing "Recusar" while the state is `granted`:
  1. stop the queue;
  2. `POST /analytics/consent/revoke` with `keepalive`. The backend clears `ed_vid`, `ed_sid` and `ed_consent` **before** erasing that visitor's data.
  3. `writeConsent(false)`, so the refusal is remembered.
- If the revoke call fails, the client still ends up denied and never tracks. The banner offers to try again later; the server-side data then expires through retention.

**Tests:**
- Component: the revoke call, the cookies afterwards, and no further events.
- Mocked E2E: footer → Recusar → revoke request seen, and no more `/analytics/events`.

### Phase 7: verification suites

- **Mocked Playwright** (`e2e/cookie-consent.spec.ts`, `/analytics/**` routed), on desktop, tablet and mobile:
  - no `/analytics` request and no `ed_*` cookie before a choice;
  - Aceitar → `/session` then `/events`, with `ed_consent=v1:analytics=1,marketing=0`;
  - Recusar → no request, and `ed_consent=v1:analytics=0,marketing=0`;
  - reload keeps the choice and doesn't show the banner;
  - footer reopens it;
  - revoke flow;
  - article reading events;
  - the banner is not in `dist` HTML;
  - axe and overflow checks.
- **Real backend** (`e2e-real/`, through the Vite dev proxy to the local API):
  - after Aceitar, the browser holds `ed_vid` and `ed_sid` as **HttpOnly** cookies (via `context.cookies()`);
  - `/events` returns 204;
  - after revoke all three are gone;
  - with a wrong secret in the proxy the API answers 401, which proves the guard is active.
- **Stryker** on every new `src/analytics/**` file and every changed component line.

### Phase 8: preview and production rollout

On a Vercel **preview** deployment, with the preview env vars pointing at a staging or production-like backend:

- [ ] `POST /analytics/session` with consent returns **204** and `Set-Cookie: __Host-ed_vid=…; Path=/; HttpOnly; Secure; SameSite=Lax`, with no `Domain`. The browser stores them under the preview host.
- [ ] No **401**, which proves the transform injected the secret.
- [ ] The backend's stored `ipAddress` for that session is the visitor's truncated IP, **not** a Vercel edge IP. This proves `X-Forwarded-For` passes. Check with the admin `GET /analytics/visitors/:id`.
- [ ] Two different networks don't share the `/session` rate limit.
- [ ] Responses keep `Cache-Control: no-store`, and nothing is cached by Vercel.
- [ ] UTM parameters reach the backend (`firstUtmSource` on the visitor).
- If any box fails: switch to the Phase 1 fallback Function and repeat.

Then deploy to production, repeat the checklist on `www.findhope.digital`, and update `CLAUDE.md`: architecture, env vars, tests.

## 7. Privacy notes beyond the analytics cookies

- **Existing functional storage.** The church-search results are saved in `localStorage` (`evangelismo-digital-query-cache`, 7 days; `src/config/queryPersistence.ts`). They are strictly functional (no identifier, never sent anywhere) and need no consent, but the privacy policy should disclose them.
- **Google Fonts.** `index.html` loads Arimo from `fonts.googleapis.com`, which sends every visitor's IP to Google before any choice. Recommended: self-host it, e.g. `@fontsource-variable/arimo`, and remove the preconnects. This is a separate small change.
- **Web3Forms.** The church-search notification includes the email the person typed, with the purpose stated next to the field. That is a separate, explicit act, not covered by the analytics consent.
- **No cross-site tracking.** No third-party scripts are added by this plan.

## 8. Risks and open questions

| Risk | Mitigation |
|---|---|
| The `vercel.json` route drops `Set-Cookie` or doesn't forward the client IP | Phase 8 checklist; the Phase 1 fallback Function forwards both explicitly. |
| The secret differs between frontend and backend, or isn't rotated together | The backend answers 401 (loud). Rotate by setting the new value in both projects, then redeploying both. Document the procedure next to the env vars. |
| The prerender captures the banner, causing a hydration mismatch | The `__PRERENDER_INJECTED` flag + the `mounted` gate + an E2E test that greps `dist/**/*.html`. |
| An ad blocker blocks `/analytics` | Analytics fail silently. The site is unaffected. First-party paths are blocked less often. |
| Bots and E2E runs inflate counts | `navigator.webdriver` skip, with an explicit override for our own E2E tests. |
| Host-only cookies across apex and `www` | Keep the apex → `www` redirect. Preview hosts get separate cookies by design. |
| `CONSENT_VERSION` bump | Everyone is asked again, by design; the frontend constant must change together with the backend's. |
| GPC handling | Pending product-owner confirmation (Phase 0). |

## 9. References

- Backend:
  - `docs/analytics-cookie-architecture.md`
  - `src/common/plugins/cookies/{options,consent,cookie-secrets}.ts`
  - `src/common/guards/verify-analytics-proxy.guard.ts`
  - `src/modules/analytics/analytics.module.ts`
  - `src/modules/analytics/controllers/{start-session,track-event,revoke-consent}.controller.ts`
  - `src/modules/analytics/controllers/session-context.ts`
  - `src/modules/analytics/dto/track-event.dto.ts`
  - `src/modules/analytics/helpers/truncate-ip.ts`
  - `src/common/plugins/policies/rate-limit.ts`
  - `src/app.ts` (CORS, `trustProxy`, cookie plugin)
  - `src/modules/analytics/controllers/analytics.e2e.spec.ts` (example requests)
- Vercel:
  - [vercel.json `routes`, `transforms` and env expansion](https://vercel.com/docs/project-configuration/vercel-json)
  - [Rewrites to external origins](https://vercel.com/docs/routing/rewrites)
  - [Routing Middleware](https://vercel.com/docs/routing-middleware)
  - [JS reference (`@vercel/functions`)](https://vercel.com/docs/routing-middleware/js-reference)
- Vite: `server.proxy` / `preview.proxy`, `loadEnv`.
- `@prerenderer/renderer-puppeteer` options `inject` / `injectProperty` (`node_modules/@prerenderer/renderer-puppeteer/types/Options.d.ts`).
- MDN: `Set-Cookie` (`__Host-` prefix, `SameSite`), `fetch` `keepalive`, `navigator.sendBeacon`, Page Visibility API, `navigator.globalPrivacyControl`.
- LGPD (Lei 13.709/2018) and the ANPD guidance on cookies (*Guia orientativo: cookies e proteção de dados pessoais*).

## 10. Corrections for the backend doc

To fix in `EvangelismoDigitalBackend/docs/analytics-cookie-architecture.md` (not done here):

- **Stale paths:**

  | Doc says | Code lives in |
  |---|---|
  | `src/http/cookies/*` | `src/common/plugins/cookies/*` |
  | `src/http/middlewares/verify-analytics-proxy.middleware.ts` | `src/common/guards/verify-analytics-proxy.guard.ts` |
  | `src/http/plugins/analytics-identity.plugin.ts` | `src/modules/analytics/plugins/analytics-identity.plugin.ts` |
  | `analytics.routes.ts` | `src/modules/analytics/analytics.module.ts` |
  | `src/use-cases/analytics/` | `src/modules/analytics/...` |

- **Next.js wording:** §2 and §8, and code comments in `options.ts` and `consent.ts` ("Server Components read it through `cookies()`").
  - The frontend is a Vite SPA.
  - §8 should describe the `vercel.json` route + transform proxy and the client-side consent read.

## 11. Implementation log (2026-10-25)

**Phase 0.**
- The banner copy was approved as drafted.
- GPC counts as "Recusar". A stored choice still wins, so a GPC visitor can opt in from the footer.
- `/privacidade` is a **draft** written from the real behaviour, pending legal review.
- **Still to do outside the code:** set `ANALYTICS_API_URL` and `ANALYTICS_PROXY_SECRET` in the Vercel project (Production and Preview).

**Phase 1.**
- `vercel.json` `routes` + `transforms` (delete, then set `x-analytics-proxy`).
- `scripts/analytics-proxy.ts` provides the dev/preview proxy (`xfwd`, secret header), wired into `vite.config.ts`. The config is now an async function so `loadEnv` can read the server-only variables.
- Verified locally through the dev proxy:
  - with consent, `POST /analytics/session` returns 204 with `ed_vid` (`Max-Age=34128000`) and `ed_sid` (`1800`), both `HttpOnly; SameSite=Lax`;
  - without consent, 204 and no cookies;
  - straight to the API without the secret, 401.
- After `npm run build`, `dist/` contains neither the secret nor its variable name.

**Phases 2–6:** as planned (`src/analytics/*`, `CookieConsentBanner`, `Footer`, `PrivacyPage`, trackers in `FindNearestChurch`, `FormContato` and `ChurchListView`). Deviations and findings:
- **The banner reserves its own height** (`body` `padding-bottom`, kept current by `ResizeObserver`) while open. On phones a fixed banner otherwise covered the end of the page, including the church-search button, with no way to scroll it into view.
- **The refusal is written after the revoke call resolves.** The backend's response clears `ed_consent` too, and writing it first would have turned "Recusar" into "unset", so the banner would come back.
- **One `page_exit` per view.** It is sent on route change, unmount or `pagehide`, never on every tab switch: the backend lists each event that has a `durationMs` as a separate "page read".
- **Accessibility fixes found by the new axe run** (the earlier audit only covered the church section):
  - the footer's social icons had no accessible name;
  - the privacy table's horizontal scroller is now focusable.
- **React #418 on every prerendered page**, which predated this work (`main` had it too), is fixed (2026-10-25). The prerender is a client render, and hydration rejected three things:
  - `useId` values differ between the client render and hydration, so FindNearestChurch, ChurchListView and the banner now use fixed ids;
  - adjacent JSX text nodes are merged in the saved HTML, so each run is now written as one string;
  - articles appeared only after an async import, so they are now imported eagerly (about 11 KB in total).

  Inline styles in Layout, NavBar and QuemSomos also moved to CSS modules, because they triggered React's dev-only attribute warning. `src/routes/hydration.test.tsx` replays prerender + hydration for all five routes. A browser check of the built `dist/` (production and development React) shows no hydration error on any page.

**Phase 7.**
- Vitest: 152 tests in `src/analytics`, plus banner, privacy page, form, route and search tests.
- Playwright:
  - mocked `e2e/cookie-consent.spec.ts`, 27 tests over 3 viewports;
  - real-backend `e2e-real/cookie-consent.real.spec.ts`, 12 tests: HttpOnly cookies from the API, 204 events, revoke clearing the cookies, 401 without the secret. It uses a distinct `X-Forwarded-For` per test, as the backend's own e2e does, because `/session` allows 5 per minute per IP.
- The existing suites start with a stored refusal (`e2e/consentState.ts`).
- Stryker on every changed line: 100 %, with the equivalent mutants simplified away or marked.

**Phase 8 (open):** run the checklist in §6 Phase 8 on a Vercel preview. In particular, confirm that `Set-Cookie` and the client IP pass through the route, and that a client-sent `X-Forwarded-For` cannot spoof the IP: Vercel should overwrite it. If not, switch to the fallback Function.
