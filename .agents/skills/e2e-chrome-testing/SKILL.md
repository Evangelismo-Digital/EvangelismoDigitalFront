---
name: e2e-chrome-testing
description: >-
  Playwright + Chromium end-to-end testing runbook for this Vite SPA. Use when writing,
  running, or debugging E2E tests, user journeys across routes, mobile/tablet viewport
  emulation, network mocking of the backend and Web3Forms, or prerender/hydration checks.
---

# End-to-End Testing (Playwright + Chromium)

## Setup

- Config: `playwright.config.ts`; specs in `e2e/*.spec.ts`; types via `tsconfig.test.json`.
- Projects: `desktop` (1280x800), `tablet` (768x1024 touch), `mobile` (Pixel 7). All Chromium.
- `webServer` starts `npm run dev` on port 5173 (reused locally if already running).
- Artifacts: `test-results/` (screenshots, traces), `playwright-report/` (HTML). Both gitignored.
- First time on WSL/Linux: `npx playwright install chromium` and `sudo npx playwright install-deps chromium`.

## Routes under test

- `/` — home (Artigos, Quem somos, Contato, FindNearestChurch). Nav links use `/?section=artigos|quem-somos|contato` and scroll to the section.
- `/artigo/:slug` — MDX article (`deusExiste`, `caminhos`, `oMal`); unknown slug shows "Página não encontrada".

## Pattern

```ts
import { expect, test } from '@playwright/test'

test('contact form submits', async ({ page }) => {
  await page.route('**/forms/submit-form', route => route.fulfill({ status: 200, json: {} }))
  await page.route('https://api.web3forms.com/**', route => route.fulfill({ status: 200, json: { success: true } }))
  await page.goto('/?section=contato')
  // fill by label, submit by role, assert on the success modal text
})
```

- Always mock `POST /forms/submit-form`, `POST /churches/find-nearest` and Web3Forms — never hit real services.
- Mobile nav is a Bootstrap collapse: click the toggler (`aria-label="Toggle navigation"`) before clicking nav links.
- To check prerender/hydration, run against the production build: `npm run build && npx playwright test --config` with `webServer.command` set to `npm run preview` (port 4173).

## Commands

- `npm run test:e2e` — all projects
- `npx playwright test e2e/screens.spec.ts --project=mobile`
- `npm run test:e2e:ui` / `npx playwright test --headed --debug`
- `npx playwright show-report`
