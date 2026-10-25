---
name: frontend-testing
description: >-
  Unit and component testing for this Vite + React 19 SPA with Vitest and React Testing
  Library. Use when writing or debugging component tests, testing react-router navigation,
  react-hook-form/Zod forms, TanStack Query mutations, async state, or resolving act() warnings.
---

# Frontend Testing (Vitest + React Testing Library)

## Stack & layout

- Runner: Vitest (`vitest.config.ts`, separate from `vite.config.ts` so the prerender plugin never loads in tests). Environment `jsdom`, MDX plugin enabled, `envPrefix: 'CONFIG_'`.
- Setup: `src/test/setup.ts` (jest-dom matchers + `cleanup`).
- Tests live next to the code: `src/**/*.test.ts(x)`. Import `describe/it/expect/vi` from `vitest` explicitly (no globals).
- Commands: `npm test` (single run), `npm run test:watch`, `npm run test:coverage`.

## Patterns

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

it('navigates when the card is clicked', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Artigos />} />
        <Route path="/artigo/:artigoId" element={<p>artigo</p>} />
      </Routes>
    </MemoryRouter>
  )
  await user.click(screen.getByRole('heading', { level: 2, name: 'Deus existe?' }))
  expect(screen.getByText('artigo')).toBeInTheDocument()
})
```

- Routing: wrap in `MemoryRouter` (`initialEntries` with `?section=...` for HomePage scroll logic). Never mock `react-router-dom` wholesale.
- TanStack Query (`useFormSubmission`): wrap in a fresh `QueryClientProvider` per test with `retry: false`.
- Network (`API_URL` endpoints, Web3Forms): stub `fetch` with `vi.spyOn(globalThis, 'fetch')` / `vi.stubGlobal`; restore in `afterEach`.
- Env: `vi.stubEnv('CONFIG_API_URL', 'http://api.test')`.
- Query priority: `getByRole` > `getByLabelText` > `getByText`. Copy is pt-BR — assert on the real Portuguese strings.
- Async: always `userEvent.setup()` and `await` every interaction; use `findBy*`/`waitFor` for state after effects (e.g. lazy MDX in `ArticlePage`).

## Done means

`npm test`, `npx tsc -b` and `npm run lint` all pass.
