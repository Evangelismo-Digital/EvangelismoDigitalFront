# Find Nearest Church: zero-map, list-only implementation plan

Status: **implemented** (Phases 0–6) on branch `feat/find-nearest-church-list`. See §8 for the decisions taken and the measured results. Target: the "Encontre uma igreja perto de você" section (`src/components/FindNearestChurch.tsx`), integrated with the backend in `~/EvangelismoDigitalBackend`.

## 1. Goal

Replace the embedded map with a **high-contrast list of the 5 nearest churches**. Each card opens the exact church coordinate in Google Maps through the official **Maps URLs (`api=1`)**. The target audience uses old phones on 2G/3G, so the section must:

- load **no map engine, tiles, web fonts or images**;
- render the result list in one pass from a payload of about 1 KB;
- hand map rendering to the phone's native Google Maps app (or Maps in the browser as a fallback).

## 2. Current state

### Frontend (this repo)

| Item | Today |
|---|---|
| Component | `src/components/FindNearestChurch.tsx` + `src/components/css/FindNearestChurch.module.css` |
| Request | `POST ${API_URL}/churches/find-nearest` with `{ email, cep }`; keeps only 2 results |
| Map | Google Maps JavaScript API (`google.maps.Map`, `AdvancedMarkerElement`, `mapId: 'DEMO_MAP_ID'`), typed by the `@types/google.maps` devDependency |
| Kill switch | `SHOW_STATIC_MAP = true` skips all of the above, shows a "em desenvolvimento" message on submit and renders a My Maps iframe (`mid=1xG-2y7rA7aH7oO115uYYH8S5oXACMsA`) |
| Validation | Zod: email required, CEP 8 digits |
| Conventions | helpers in `src/util/`, hooks in `src/hook/`, CSS Modules in `src/components/css/`, TanStack Query already used by `src/hook/useFormSubmission.tsx`, pt-BR copy, prerendered with Puppeteer (must be hydration-safe) |
| Error guard | `src/util/isErrorResponse.ts` checks the **old** backend shape (`requestURI`) |

### Backend (`~/EvangelismoDigitalBackend`)

NestJS module layout on **Fastify 5**, Prisma + PostGIS, Redis cache.

- **Route:** `GET /churches/nearest?cep=<cep>` (`src/modules/churches/churches.module.ts`, prefix `/churches` in `src/app.module.ts`), with rate-limit and deadline policies (`HTTP_RATE_LIMIT_POLICIES.churches.nearest`, `HTTP_DEADLINE_POLICIES.churches.nearest`).
- **CEP validation:** `src/common/dto/utils/cep.dto.ts`, regex `^\d{5}-?\d{3}$`.
- **Controller:** `src/modules/churches/controllers/find-nearest-churches.controller.ts`.
- **Success response (200):**

  ```ts
  {
    nearestChurchesInfo: PublicNearbyChurch[]   // up to 5 (CHURCH_CONSTANTS.KNN_LIMIT)
    totalFound: number
    precision: string                           // precision of the CEP → coordinate lookup
    coordinatesProviderName?: string
  }

  // src/modules/churches/presenters/projections/public-church.ts
  interface PublicNearbyChurch {
    publicId: string
    name: string
    address: string | null
    lat: number
    lon: number
    distanceKm: number
    distanceMeters: number
  }
  ```

- **Ranking:** KNN over PostGIS (5 candidates), then sorted ascending by **pedestrian route distance** (`RoutingProfile.PEDESTRIAN`, `calculate-church-route-distances.service.ts`). The distance is a walking route, not a straight line.
- **Caching:** the whole result is cached in Redis per CEP + profile (`find-nearest-churches.service.ts`).
- **Errors:** `HttpErrorMapper` replies `{ message, code }` with the mapped HTTP status (e.g. `InvalidCepError`, `NoNearbyChurchesFoundError`, `CepToLatLonError`).
- **CORS:** `origin: env.FRONTEND_URL` (`src/app.ts`).
- **Data model:** `Church { publicId, name, address, lat, lon, geog }`. There is **no `googlePlaceId`**.

## 3. Deviations from the source spec

The source spec was written before checking this repo and the backend. These adjustments apply:

| Spec says | This plan does | Why |
|---|---|---|
| `latitude` / `longitude` / `id` fields | Map `lat` / `lon` / `publicId` into the frontend `ChurchItem` | Real backend contract |
| `address` always a full string | Handle `address: null` with a fallback line | Backend type allows `null` |
| "distance" | Label it as walking distance ("a pé") | Backend ranks by pedestrian route |
| `query_place_id` / `destination_place_id` | Keep the hook in the URL builder, but **deferred** | No place ID stored; needs a backend change |
| Fastify on VPS serves `.br` / `.gz` bundles | **Dropped.** Frontend stays on Vercel; the VPS serves only the API | User decision; Vercel's CDN already serves Brotli/Gzip and the prerender pipeline keeps working |
| `src/utils/`, `ChurchListView.css` | `src/util/`, `src/components/css/ChurchListView.module.css` | Repo conventions |
| Email not mentioned | Form asks **CEP (required) + email (optional)**; the search sends only the CEP | User decision |
| Workbox cache in core | **Optional Phase 6**, comparing it with TanStack Query persistence | User decision |
| No map at all | Add a plain link to the existing **full church map** (My Maps) and a per-card **"Como chegar"** link | User decision |

## 4. Map technology assessment

Question: should we use the official Google Maps SDK, or a similar library, to build this feature?

| Option | API key / billing | Weight on the device | Native-app handoff | Verdict |
|---|---|---|---|---|
| **Google Maps URLs (`api=1`)** | No key, no quota, free | 0 KB JS, 0 tiles; just an `<a href>` | Yes: Android App Links / iOS Universal Links open the app; falls back to Maps on the web | **Chosen** |
| Maps JavaScript API (`@googlemaps/js-api-loader`, `@vis.gl/react-google-maps`) | Key + billing account; charged per map load beyond the free monthly tier | Large runtime script + vector/raster tiles per search; WebGL/canvas memory pressure on low-RAM Android | No (map renders inside the page) | Rejected for this flow |
| Maps Embed API (iframe) | Key required (Embed itself is free) | Full Maps web app inside an iframe (several hundred KB+) | Partial | Rejected |
| Google My Maps embed (today's iframe) | None | Same iframe cost as above | Partial | Replaced by a **link** to the same map (zero cost until tapped) |
| Maps Static API (image per church) | Key + billing per request beyond the free tier | One image per card | No | Rejected (possible later visual enhancement) |
| Places API (for `query_place_id`) | Key + billing | Server side only | n/a | **Deferred**: needs a `googlePlaceId` column + backfill in the backend |
| Leaflet / MapLibre GL + OSM / CARTO / Stadia tiles | Libraries free; tile servers have usage policies and quotas | ~40 KB (Leaflet) to ~280 KB (MapLibre) gzipped JS + tiles per search | No | Rejected by the zero-map goal |
| `geo:` / `comgooglemaps://` URI schemes | None | 0 KB | Unreliable: `geo:` fails on desktop browsers and iOS Safari; `comgooglemaps://` fails when the app is not installed | Rejected |

**Conclusion:** no map SDK dependency. Build the plain HTTPS URL by hand in a small, fully tested utility, and delete the dead Maps JavaScript API code and the `@types/google.maps` devDependency.

Google's "pricing" and "free tier" figures change. Re-check the [Google Maps Platform pricing page](https://mapsplatform.google.com/pricing/) before reopening any rejected option.

## 5. Phases

Every phase ends with the project's pre-push gate green: ESLint (`--max-warnings 0`) + `tsc -b`, Vitest, Playwright (desktop/tablet/mobile), and Stryker with zero unexplained survivors on changed lines. See `CLAUDE.md`.

### Phase 0: contract and open decisions

**Goal:** no assumptions left before coding.

- Confirm with the backend: `GET /churches/nearest?cep=`, the response shape in §2, and the status codes of each error (`InvalidCepError`, `NoNearbyChurchesFoundError`, `CepToLatLonError`, rate limit 429, deadline/timeout).
- Write the pt-BR message for each error status (copy carries business meaning, so it needs the user's approval).
- Confirm that `FRONTEND_URL` / CORS on the VPS allows `https://www.findhope.digital` and, if needed, Vercel preview URLs.
- **Decide the optional email's destination and consent text:** the existing forms endpoint (`POST /forms/submit-form` via `useFormSubmission`), Web3Forms, or a new backend endpoint. Also decide what the user is told about it (LGPD).
- Confirm the full-map link target: `https://www.google.com/maps/d/viewer?mid=1xG-2y7rA7aH7oO115uYYH8S5oXACMsA`.

**Done when:** every item above has a recorded answer.

### Phase 1: pure utilities

**New file:** `src/util/googleMapsUrl.ts` (+ `googleMapsUrl.test.ts`)

- `ChurchItem`: `{ id, name, address: string | null, latitude, longitude, distanceKm, distanceMeters, googlePlaceId? }`.
- `toChurchItem(PublicNearbyChurch)`: maps `publicId → id`, `lat → latitude`, `lon → longitude`.
- `buildGoogleMapsUrl(church, mode = 'exact-point')`:
  - `exact-point` → `https://www.google.com/maps/search/?api=1&query=LAT%2CLNG`
  - `directions` → `https://www.google.com/maps/dir/?api=1&destination=LAT%2CLNG` (no `origin`, so Maps routes from the device location)
  - coordinates via `toFixed(6)` (dot decimal), joined with `%2C`, no spaces;
  - appends `query_place_id` / `destination_place_id` only when `googlePlaceId` exists (dormant until the backend provides it);
  - rejects non-finite or out-of-range coordinates.
- `formatDistancePtBr(distanceKm)`:
  - one module-level `Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })`;
  - `< 1` → rounded meters (`450 m`); `≥ 1` → one decimal with a comma (`1,4 km`);
  - rejects `NaN`, `Infinity` and negatives;
  - edge cases tested: `0`, `0.9995` (rounds to `1000 m` → decide: show `1,0 km`), `1`, large values.
- `formatCoordinateHint(church)`: 4 decimals for the CTA's coordinate preview.

**Done when:** 100% branch coverage and Stryker reports no unexplained survivors on this file.

### Phase 2: data layer

**New file:** `src/hook/useNearestChurches.ts` (+ test)

- TanStack Query `useQuery` keyed by `['churches', 'nearest', normalizedCep]`, `enabled` only after a valid submit. This gives in-memory reuse of repeat CEPs within a session for free.
- `fetch(\`${API_URL}/churches/nearest?cep=${cep}\`, { signal })`: the request is aborted on unmount or a new search.
- Retry: none for 4xx, at most 1 for 5xx/network; respect 429 (no retry loop).
- Map the JSON to `ChurchItem[]` with `toChurchItem`, sliced to 5.
- **Error guard:** replace or extend `src/util/isErrorResponse.ts` with a guard for the backend's `{ message, code }` shape. Keep the old one only if `useFormSubmission` still receives the `requestURI` shape (check in Phase 0).
- Tests with a stubbed `fetch`: success, empty list, each error status, abort.

### Phase 3: `ChurchListView` component

**New files:** `src/components/ChurchListView.tsx`, `src/components/css/ChurchListView.module.css` (+ `ChurchListView.test.tsx`)

- Props: `{ userCep: string; churches: ChurchItem[] }`.
- Semantics:
  - `<section aria-labelledby>` with an `<h2>` and a CEP badge;
  - `<ol>` of up to 5 `<li>`;
  - each card has a main `<a href={exact-point} target="_blank" rel="noopener noreferrer">` and a secondary **"Como chegar"** `<a href={directions}>`.
  - Anchors cannot be nested, so the card is an `<article>` containing both links. The main link is "stretched" over the card with CSS (`::after` inset), and the "Como chegar" link sits above it in the stacking order.
  - Each main link has an `aria-label`: rank, name, formatted distance, address, action.
- Card anatomy:
  1. Meta row: rank (`#1`–`#5`), **"Mais próxima"** badge on `index === 0`, distance pill ("450 m a pé").
  2. Body: name (`<h3>`), full wrapping address with an inline SVG pin; if `address` is null, show a fallback line (copy to approve).
  3. Footer CTA (≥ 44 px touch height): **"Ver ponto exato no Google Maps"** + an external-link SVG + the 4-decimal coordinate hint (`tabular-nums`); then the **"Como chegar"** link.
- States: idle (hint text), loading (skeleton without animation-heavy CSS), empty ("nenhuma igreja encontrada", from `NoNearbyChurchesFoundError`), error (Phase 0 messages).
- Styling: system font stack, inline SVG only, no images or web fonts, `-webkit-tap-highlight-color: transparent`, `:active` and `:focus-visible` states. The spec's palette (`#2563eb` blue, `#15803d` / `#16a34a` greens, `#cbd5e1` borders) is checked against the site's existing colors and WCAG AA contrast before adoption.
- A **"Ver todas as igrejas no mapa"** link under the list opens the My Maps viewer in a new tab.

### Phase 4: integration and cleanup

**Edited:** `src/components/FindNearestChurch.tsx`, `src/components/css/FindNearestChurch.module.css`, `package.json`, `CLAUDE.md`

- Zod schema: `cep` required (accepts `00000-000` or 8 digits, normalized to digits); `email` optional (validated only if filled).
- `inputMode="numeric"` and `autoComplete="postal-code"` on the CEP field; `autoComplete="email"` on the email field.
- On submit: trigger `useNearestChurches(cep)`. If an email was typed, send it per the Phase 0 decision, without blocking or affecting the search result.
- Render `ChurchListView` in place of the map column. Layout becomes a single column on mobile; reconsider the two-column desktop layout.
- **Delete:** `SHOW_STATIC_MAP`, the `google.maps` effect, the refs, `ChurchLocation`, the iframe, the `POST /churches/find-nearest` call, and the `@types/google.maps` devDependency.
- Prerender safety: nothing fetches on mount; the prerendered HTML shows the idle form only.
- Update `CLAUDE.md` (the "Forms" and "Backend calls" paragraphs).

### Phase 5: E2E, accessibility and performance

- New `e2e/find-nearest-church.spec.ts`, mocking `**/churches/nearest*` with `page.route`, on all three projects. It checks:
  - the 5 cards appear in order, with "Mais próxima" on the first;
  - each `href` matches the expected `api=1` URL with 6-decimal coordinates; `target="_blank"` and `rel="noopener noreferrer"` are set;
  - "Como chegar" uses `dir/?api=1&destination=`;
  - empty, error and 429 states show the approved copy;
  - an invalid CEP shows the validation message and makes no request;
  - no horizontal overflow; full-page screenshots for review.
- Accessibility: axe audit of the section (contrast, names, focus order); keyboard-only pass.
- Performance: compare `vite build` output before and after (expect the section's JS to shrink); Lighthouse mobile run with throttled network.

### Phase 6 (optional): offline / repeat-search cache

A decision gate with the user before adding any dependency. Compare:

| Option | Adds | Covers | Concerns |
|---|---|---|---|
| TanStack Query persistence (`persistQueryClient` + `@tanstack/query-sync-storage-persister`) | Small; reuses Phase 2 | Repeat CEPs across visits (localStorage) | No offline app shell; storage size cap; invalidation via `maxAge` / `buster` |
| `vite-plugin-pwa` + Workbox `StaleWhileRevalidate` (50 CEPs / 7 days) | Service worker + build plugin | Repeat CEPs **and** an offline shell | SW lifecycle/update bugs; interaction with the prerendered pages and Vercel; stale church data after edits |

Criteria: bundle size, offline coverage needed, how quickly church edits must reach users (vs the backend's Redis TTL), and maintenance cost.

### Deferred (backend work, out of this plan's scope)

- Add a `googlePlaceId` column to `Church` and backfill it, so the dormant `query_place_id` / `destination_place_id` code paths activate and Maps shows the Place Details sheet.
- If stored addresses lack neighborhood/city/UF/CEP, enrich them on the backend; the frontend only displays them.

## 6. Risks and open questions

- **Email:** destination, consent copy and data retention (Phase 0; business/LGPD decision).
- **Error copy:** the pt-BR messages per status need the user's approval.
- **Null addresses:** what the card shows when `address` is `null`.
- **Distance wording:** the backend ranks by walking route; the label must not imply straight-line distance.
- **Coordinate quality:** exact-point pinning is only as good as the stored `lat`/`lon`; audit a sample of churches.
- **Rate limiting:** the 429 behavior and copy; the UI must not retry in a loop.
- **In-app browsers** (WhatsApp/Instagram WebViews): verify on a real device that `target="_blank"` links hand off to the Maps app.

## 7. References

- Google Maps URLs (`api=1`): https://developers.google.com/maps/documentation/urls/get-started
- Launching Google Maps navigation: https://developers.google.com/maps/documentation/navigation/connect/launch-navigation-app
- Why `geo:` URIs fail in browsers: https://dev.to/professortom/why-your-browser-wont-open-maps-with-a-geo-uri-and-a-workaround-ief
- `Intl.NumberFormat` (MDN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- TanStack Query persistence: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- Vite PWA / Workbox: https://vite-pwa-org.netlify.app/ and https://www.codemag.com/Article/2309071/Vite-and-Progressive-Web-Apps
- Backend files: `src/modules/churches/controllers/find-nearest-churches.controller.ts`, `src/modules/churches/services/find-nearest-churches.service.ts`, `src/modules/churches/presenters/projections/public-church.ts`, `src/common/messages/constants/churches/churches.ts`, `src/common/filters/http-error-mapper.ts`, `prisma/schema.prisma`

## 8. Implementation log

### Decisions recorded (Phase 0 and along the way)

| Topic | Decision |
|---|---|
| Optional email destination | Web3Forms (same channel as the contact form), subject `Busca de igreja - CEP 00000-000`, fields email + CEP + nearest church. Sent after the search; never blocks or changes the results. |
| Lead when the search fails | Still sent, with `igreja_mais_proxima: nenhuma encontrada`. |
| Consent text | "Opcional. Se informar, nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja." (linked to the field with `aria-describedby`). |
| Error copy | 404 `INVALID_CEP`/`COORDINATES_NOT_FOUND` and 400 → "Não encontramos esse CEP. Confira os números e tente de novo." · 404 `NO_NEARBY_CHURCHES_FOUND`/`EMPTY_CHURCH_LIST` or an empty list → "Ainda não temos igrejas cadastradas perto desse CEP." · 429 → "Muitas buscas seguidas. Aguarde um minuto e tente novamente." · 5xx, network, offline, unknown → "Não foi possível buscar agora. Verifique sua conexão e tente novamente." |
| Null address | "Endereço não informado — toque para ver no mapa." |
| Microcopy | "CEP", "Email (opcional)", "Buscar igrejas" / "Buscando...", idle "Digite seu CEP para ver as 5 igrejas mais próximas de você.", loading "Buscando as igrejas mais próximas...", "Tentar novamente", "Ver todas as igrejas no mapa". |
| Palette | Site orange. `#f05128` only for borders (3.55:1); every text on orange or white uses `#b93a17` (≥ 5.1:1). The search button and the section's error text moved to `#b93a17` to pass WCAG AA. |
| Phase 6 | TanStack Query persistence (no service worker). |

### What was built

| Phase | Files | Notes |
|---|---|---|
| 1 | `src/util/googleMapsUrl.ts` | `toChurchItem`, `buildGoogleMapsUrl` (`exact-point` / `directions`, throws on an unknown mode or invalid coordinates), `formatDistancePtBr`, `formatCoordinateHint`. |
| 2 | `src/util/nearestChurchesApi.ts`, `src/hook/useNearestChurches.ts`, `src/util/isErrorResponse.ts`, `src/interface/ErrorResponse.ts` | Zod-validated payload; malformed churches are dropped; sorted and capped at 5; status + `code` → `NearestChurchesError.kind`; one retry, only for `unavailable`; 5-minute `staleTime`. `ErrorResponse` now matches the backend's `{ message, code }`. |
| 3 | `src/components/ChurchListView.tsx`, `src/components/css/ChurchListView.module.css` | `<section aria-labelledby>` + `<ol>`; each card is an `<article>` whose map link is stretched over the card (`::after`), with "Como chegar" layered above it, so no anchors are nested. Inline SVG, system fonts, 44 px targets. |
| 4 | `src/components/FindNearestChurch.tsx`, `src/util/churchSearchSchema.ts`, `src/util/churchSearchLead.ts`, `src/util/web3forms.ts` | CEP mask, optional email, idle/loading/error/list states, full-map link. The Maps JS API code, `SHOW_STATIC_MAP`, the iframe, the `POST /churches/find-nearest` call and `@types/google.maps` are gone. The Web3Forms POST is shared with `useFormSubmission`. |
| 5 | `e2e/find-nearest-church.spec.ts`, `e2e/fixtures/churches.ts` | Mocked backend, Web3Forms and Google Maps, on desktop/tablet/mobile; includes popup checks for the stretched link vs "Como chegar", 44 px targets and axe (WCAG 2.1 A/AA). |
| 6 | `src/config/queryPersistence.ts`, `src/main.tsx` | `PersistQueryClientProvider` + sync `localStorage` persister: only successful `['churches', 'nearest', cep]` queries are saved, 7-day `maxAge` (= `gcTime`), buster `church-list-v1`; blocked storage turns persistence off. A saved result shows at once and refreshes in the background; a failed refresh keeps it on screen. Offline (TanStack pause) shows the "verifique sua conexão" message and loads on reconnect. |

### Tests

- Vitest: 202 tests (unit + component + integration with a real `QueryClient`, a stubbed `fetch` and a persisted cache shared between two "visits").
- Playwright: 51 tests (17 scenarios × 3 viewports, including the 12 existing screen tests).
- Stryker: every file changed by this work has zero surviving mutants. One equivalent mutant is marked with a `// Stryker disable` comment in `nearestChurchesApi.ts` (an unreadable body being `null` vs `undefined`).

### Measured results (mobile, simulated throttling, Lighthouse 12.8.2, `vite preview`)

| | Before (map iframe) | After (list) |
|---|---|---|
| Home total byte weight | 1,949 KiB | 1,101 KiB |
| My Maps iframe alone | 77 requests, ~1,091 KiB | removed (link only) |
| Main JS (gzip) | 153.6 kB | 162.2 kB (+8.6 kB: list, validation, query persistence) |
| Lighthouse performance | 73 | 72 (within run-to-run noise; LCP is an article card image) |
| Lighthouse best practices | 79 | 100 |
| Lighthouse accessibility | 91 | 90 (the church section now passes; the remaining failures are pre-existing elsewhere: Artigos title, MaisRecursos subtitle, contact form button contrast, unlabeled footer links) |

### Found but out of scope

- **Hydration mismatch on article pages** (React #418), present before this work: `ArticlePage` renders a spinner on its first client render while the prerendered HTML holds the full article.
- **Contrast failures outside this section**, listed in the table above.
- **Backend:** `googlePlaceId` for `query_place_id` (deferred, §5).

## 9. Real backend integration and redesign (2026-10-25)

### Backend contract change absorbed

The backend (commit `6f3bcfd`) added `mode=pedestrian|transport` to `GET /churches/nearest`, echoes `mode` in the response, caches per mode, and caps routed distance at 10 km walking / 150 km by transport. The frontend now:

- always sends `mode` (`src/util/travelMode.ts`); the query key is `['churches', 'nearest', cep, mode]` and the persisted-cache buster moved to `church-list-v2`;
- shows "a pé" / "de carro" on distances and passes `travelmode=walking|driving` to the "Como chegar" link;
- offers an "A pé" / "De carro" switch (walking by default). Changing it after a search repeats the search; a walking search with no church within 10 km shows "Nenhuma igreja a até 10 km a pé desse CEP." with a "Ver igrejas de carro" button;
- adds `como_vai` ("a pé" / "de carro") to the Web3Forms lead.

### Redesign ("route line")

A single centered column replaces the two-column bordered box: the mode switch, a large CEP field joined to "Buscar igrejas", and a quieter optional email. Results are drawn as a walking route: a line leaves "CEP 00000-000" and passes each church in distance order; the nearest stop is the one filled point, on a tinted panel. The idle state shows the start of the route instead of an empty panel. Link text is "Ver no Google Maps" (the link still pins the exact coordinate); the coordinate preview was removed. Arimo (already loaded by the site) is used throughout; the only motion is the line drawing once when results appear, disabled under `prefers-reduced-motion`.

### Tests against the real backend

| Suite | Command | What it proves |
|---|---|---|
| API contract | `npm run test:api` (`api-tests/`) | 21 tests: strict response schema for walking and transport (`totalFound` equals the churches returned), default mode, hyphenated CEP, per-mode cache, plausible coordinates, title-case names and the `Rua, nº - Bairro, Cidade - UF` address format for every returned church, walking routes from Niterói staying in Niterói, and the frontend's own `fetchNearestChurches` / parser / error mapping against live responses (INVALID_CEP for `00000000` and `99999999`, NO_NEARBY_CHURCHES_FOUND on foot and by car, 400 `VALIDATION_ERROR`, unreachable host). |
| Real E2E | `npm run test:e2e:real` (`e2e-real/`) | 33 tests (11 × desktop/tablet/mobile): every stop matches the live API (order, name, address, pt-BR distance, exact-point and directions links), the mode switch, Rio Centro by car, popup to the stored coordinate, two unknown CEPs, far CEP on foot (walking message → "Ver igrejas de carro") and by car, lead content (Web3Forms stubbed), reload with the backend unreachable, axe and horizontal overflow. |

Both are opt-in (they need Docker, the seeded database and real provider keys) and stay out of `npm test` and the pre-push gate.

### Backend issues found, fixed in backend commit `edb6ac5`

All seven issues the real-backend suites found were fixed in the backend (PR #12), and each fix is now pinned by `api-tests/` and `e2e-real/`:

| # | Issue found | Backend fix | Pinned by |
|---|---|---|---|
| 1 | Stadia answered 403 on every matrix request (a wasted ~250 ms attempt per search) | Stadia removed; the routing chain is Geoapify → OpenRouteService | — (internal) |
| 2 | Far CEP on foot (São Paulo, 01310-100) answered 503, hiding the walking → car fallback behind "verifique sua conexão" | Candidates beyond the mode's ceiling in straight line are dropped before routing → 404 `NO_NEARBY_CHURCHES_FOUND` | API test on foot and by car; real E2E clicks "Ver igrejas de carro" |
| 3 | `99999999` answered 503 after ~3 s | An address whose state contradicts the CEP's Correios range is treated as not found → 404 `INVALID_CEP` | API and real E2E for `00000000` and `99999999` |
| 4 | Walking routes crossed Guanabara Bay by ferry (Niterói → Catedral at 7.15 km on foot) | Geoapify walking matrices avoid ferries | API test: a walk from Niterói Centro returns only Niterói churches |
| 5 | `totalFound` counted KNN candidates | Counts the churches returned | Contract test: `totalFound === nearestChurchesInfo.length` |
| 6 | Validation 400s had no `code` | `code: "VALIDATION_ERROR"` | API tests for a malformed CEP and an unknown mode |
| 7 | Seed data: lowercase names, a stray "001, " prefix, mixed address formats | Title-case names, one `Rua, nº - Bairro, Cidade - UF` format | API test on every returned church |

The backend's nearest-churches Redis prefix moved to `v2`, so no response with the old meaning is served. The frontend needed no source change: the contract is the same, a 400 still maps to "cep-not-found" (now with a `code`), and the walking fallback already expected `NO_NEARBY_CHURCHES_FOUND`. Test fixtures (`src/test/churchFixtures.ts`, `e2e/fixtures/churches.ts`) now use the backend's address format and carry `mode` and `precision: "ROOFTOP"` like real responses. The persisted-cache buster (`church-list-v2`) was not bumped: this feature has not shipped, so no visitor holds results from the old backend.

## 10. Search card, every-search report and copy (2026-10-25)

Requested after testing locally:

- **Web3Forms on every search.** It did not fire locally because the frontend had no `.env`, so `CONFIG_WEB3FORMS_ACCESS_KEY` was empty. The rule also changed (user decision): every search is reported, not only those with an email. Submitting, switching "A pé" / "De carro" and "Ver igrejas de carro" each count as a search, and so does repeating one already on screen. The report goes out once the result is known (the nearest church, or "nenhuma encontrada"), and is read from the query the list shows rather than a fetch of its own. The old `fetchQuery` could call the backend a second time when an error arrived before the list subscribed. Without an email the `email` field (Web3Forms' reply-to) is left out and the message says "Email: não informado"; the email given with a submitted search is reused for its repeats by car or on foot.
- **Layout.** "Buscar igrejas" sits below the CEP and email fields. The form is a card in the contact form's style (2px `--primary2` outline, 25px radius), with an inline SVG illustration (a dotted route from a home marked by a pin to a church) beside it on desktop and above it below 992px. Line icons: walking and car on the switch, a pin in the CEP field, an envelope in the email field, a magnifier (or a spinner while searching) on the button.
- **Removed.** The "Ver todas as igrejas no mapa" link (`FULL_CHURCH_MAP_URL`, the placeholder My Maps map) and the idle route preview; the results area stays empty until the first search.
- **Copy (approved).** Small print under the title: "digite seu CEP para se conectar com nossa equipe de voluntários e com igrejas perto de você." The CEP field is described by "CEP é o código postal de 8 números do seu endereço, como 24230-100. Não sabe o seu? Consulte nos Correios.", linking to `https://buscacepinter.correios.com.br/app/endereco/index.php`.
- **Tests.** The mocked Playwright suite now starts its own dev server on port 5199 and never reuses a running one. It had silently reused a dev server pointed at the real backend.
- **Email required (user decision).** After the every-search rule, the email became mandatory: the label is "Email", both fields carry `aria-required`, an empty email shows "Digite seu email.", and the note under it reads "Nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja." Every report therefore carries the email as Web3Forms' reply-to.
- **Results in view.** Results used to render under the card, below the fold. They now take the illustration's place inside the card: beside the form on desktop, right under "Buscar igrejas" below 992px. Each search scrolls them into view twice: once while loading, and again once the list or error is shown, because near the end of the page a short loading line cannot reach the top yet. The scroll is smooth unless the person prefers reduced motion, and `scroll-margin-top: 80px` clears the fixed 57px navbar. "Tentar novamente" does not scroll, because its results are already in view. The live region stays rendered (empty before the first search) so its first update is announced.
- **Searching again after a failure** now asks the backend again (`invalidateQueries` on that one key). Before, it showed the old error without a request.

## 11. Directions start at the searched CEP (2026-10-25)

**Problem.** "Como chegar" sent only a `destination`, so Google Maps started the route at the device's own location: wherever the person happened to be, not the CEP they searched.

**Backend** (branch `feat/nearest-churches-origin`, uncommitted). `GET /churches/nearest` now returns `origin: { lat, lon }`, the coordinates the CEP resolved to: the same point every distance was measured from, for both modes. Errors carry no origin. The nearest-churches Redis prefix moved to `v3`, so week-old cached answers without `origin` are never served. Tests:
- unit: the use-case answers with the geocoded point, and routing started from that same point;
- acceptance: `features/nearest-churches-origin.feature`, with the HTTP contract carrying `origin` and an unknown CEP getting none;
- mutation: the use-case scored 100 % (24 killed).

**Frontend.**
- `parseNearestChurches` returns `{ origin, churches }`. `origin` is `null` when it is missing or invalid, and the churches are still listed.
- `buildGoogleMapsUrl(church, 'directions', travelMode, origin)` adds `&origin=LAT%2CLNG`.
- `PERSIST_BUSTER` is now `church-list-v3`, so results saved as a bare list (v2) are discarded.
- The API suite checks that the origin is identical on foot and by car, and that no church's route is shorter than the straight line from it.
- The real E2E suite checks that every "Como chegar" starts at the live origin.

**Scroll hardening found by the new tests.**
- A plain `/` no longer scrolls to "Artigos". After the "wait for load" change, that scroll could land late and pull back someone already scrolling.
- Any section scroll is dropped if the person scrolls first (wheel, touch or keyboard).
- The results scroll waits for the web fonts, so a search made right after the page opens is not thrown off when they swap in. This was a 4 % flake, now 0 in 180 runs.
