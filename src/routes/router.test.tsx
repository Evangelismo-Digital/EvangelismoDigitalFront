import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { routes } from './router'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

describe('routes', () => {
  it('serves the privacy policy at /privacidade, inside the site layout with the cookie banner', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/privacidade'] })} />
      </QueryClientProvider>
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument()
    expect(within(screen.getByRole('contentinfo')).getByRole('button', { name: 'Preferências de cookies' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cookies neste site' })).toBeInTheDocument()
    // The page column's spacing comes from a class, not an inline style (React's dev hydration check).
    const column = screen.getByRole('heading', { level: 1, name: 'Política de privacidade' }).closest('.content')
    expect(column).toHaveClass('container', 'content')
    expect(column).not.toHaveAttribute('style')
  })
})
