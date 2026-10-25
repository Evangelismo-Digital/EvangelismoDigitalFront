import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomePageWrapper from './HomePageWrapper'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

const visit = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <HomePageWrapper />
      </QueryClientProvider>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HomePageWrapper', () => {
  it('scrolls to the section named in the address', async () => {
    visit('/?section=encontre-uma-igreja')

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1))
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toHaveAttribute('id', 'encontre-uma-igreja')
  })

  it.each(['/', '/?section='])('opens %s at the top, without scrolling anywhere', async (url) => {
    visit(url)

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls again when the menu switches to another section', async () => {
    const router = createMemoryRouter([{ path: '/', element: <HomePageWrapper /> }], { initialEntries: ['/?section=recursos'] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1))

    await act(() => router.navigate('/?section=encontre-uma-igreja'))

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2))
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[1]).toHaveAttribute('id', 'encontre-uma-igreja')
  })
})
