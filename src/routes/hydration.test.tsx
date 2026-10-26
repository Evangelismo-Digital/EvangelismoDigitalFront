// The static pages are made by the Puppeteer prerender, which runs the app as a CLIENT render
// (createRoot) and saves the DOM. Visitors then HYDRATE that HTML (hydrateRoot, main.tsx). Anything that
// renders differently between the two (React's client vs server useId format, adjacent text nodes that the
// saved HTML merges, content loaded after the first render) throws React error #418 and makes React
// discard the page and render it again. This test replays both steps for every prerendered route.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'
import { stopAnalytics } from '../analytics/analytics'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

const app = (path: string) => (
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
  </QueryClientProvider>
)

/** Step 1, as the build does: client-render with the prerender flag set and keep the resulting HTML. */
async function prerender(path: string): Promise<string> {
  Object.assign(window, { __PRERENDER_INJECTED: { prerendering: true } })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(app(path)))
  // The real prerender waits 5 s, so an article that loads after the first render is in its HTML.
  if (path.startsWith('/artigo/')) {
    await waitFor(() => expect(container.querySelector('[data-analytics-article]')).not.toBeNull())
  }
  const html = container.innerHTML
  act(() => root.unmount())
  container.remove()
  Object.assign(window, { __PRERENDER_INJECTED: undefined })
  return html
}

/** Step 2, as a visitor's browser does: hydrate that HTML, collecting every mismatch React reports. */
async function hydrate(path: string, html: string): Promise<unknown[]> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const errors: unknown[] = []
  const root = await act(async () =>
    hydrateRoot(container, app(path), { onRecoverableError: (error) => errors.push(error) })
  )
  act(() => root.unmount())
  container.remove()
  return errors
}

afterEach(() => {
  stopAnalytics()
  vi.restoreAllMocks()
})

describe('prerendered pages hydrate without a mismatch (React #418)', () => {
  it.each(['/', '/privacidade', '/artigo/oMal', '/artigo/deusExiste', '/artigo/caminhos'])('%s', async (path) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const html = await prerender(path)
    expect(html.length).toBeGreaterThan(500)

    const errors = await hydrate(path, html)

    expect(errors.map((error) => String((error as Error).message ?? error).split('\n')[0])).toEqual([])
  })
})
