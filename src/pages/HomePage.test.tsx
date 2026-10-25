import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

const page = (section?: string, client = new QueryClient()) => (
  <MemoryRouter>
    <QueryClientProvider client={client}>
      <HomePage section={section} />
    </QueryClientProvider>
  </MemoryRouter>
)

const renderHome = (section?: string) => render(page(section))

const scrolls = () => vi.mocked(Element.prototype.scrollIntoView).mock

beforeEach(() => {
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('HomePage section scrolling', () => {
  it.each([
    ['artigos', (c: HTMLElement) => c.querySelector('.section')],
    ['recursos', (c: HTMLElement) => c.querySelector('#recursosRef')],
    ['quem-somos', (c: HTMLElement) => c.querySelector('.quemSomos')],
    ['contato', (c: HTMLElement) => c.querySelector('#contatosRef')],
    ['encontre-uma-igreja', (c: HTMLElement) => c.querySelector('#encontre-uma-igreja')],
  ])('scrolls smoothly to "%s", which clears the fixed navbar', async (section, target) => {
    const { container } = renderHome(section)

    await waitFor(() => expect(scrolls().calls).toHaveLength(1))
    expect(scrolls().calls[0]).toEqual([{ behavior: 'smooth' }])
    const element = scrolls().contexts[0] as HTMLElement
    expect(element).toHaveClass('section')
    expect(element).toBe(target(container))
  })

  it('does not scroll without a section, or for an unknown one', async () => {
    renderHome()
    renderHome('nao-existe')

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(scrolls().calls).toHaveLength(0)
  })

  it('waits 100ms, and does not scroll after leaving the page', () => {
    vi.useFakeTimers()
    const { unmount } = renderHome('recursos')

    act(() => vi.advanceTimersByTime(99))
    unmount()
    act(() => vi.advanceTimersByTime(10))

    expect(scrolls().calls).toHaveLength(0)
  })

  it('does not scroll when the page is left while it waits for fonts and images', async () => {
    let fontsReady!: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
    const { unmount } = renderHome('contato')

    await new Promise((resolve) => setTimeout(resolve, 150))
    unmount()
    await act(async () => fontsReady())

    expect(scrolls().calls).toHaveLength(0)
    delete (document as { fonts?: unknown }).fonts
  })

  it('on a fresh load, waits for the page (fonts and images) before scrolling', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    let fontsReady!: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
    renderHome('encontre-uma-igreja')

    await new Promise((resolve) => setTimeout(resolve, 150))
    await act(async () => fontsReady())
    // Fonts are ready, but images may still be loading: no scroll before the load event.
    expect(scrolls().calls).toHaveLength(0)

    readyState.mockReturnValue('complete')
    await act(async () => { window.dispatchEvent(new Event('load')) })

    await waitFor(() => expect(scrolls().calls).toHaveLength(1))
    expect(scrolls().contexts[0]).toHaveAttribute('id', 'encontre-uma-igreja')
    delete (document as { fonts?: unknown }).fonts
  })

  it('also waits for fonts, once the page has loaded', async () => {
    let fontsReady!: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
    renderHome('recursos')

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(scrolls().calls).toHaveLength(0)

    await act(async () => fontsReady())
    await waitFor(() => expect(scrolls().calls).toHaveLength(1))
    delete (document as { fonts?: unknown }).fonts
  })

  it('scrolls only to the latest section when it changes while waiting', async () => {
    let fontsReady!: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
    const client = new QueryClient()
    const { rerender } = render(page('recursos', client))

    await new Promise((resolve) => setTimeout(resolve, 150))
    rerender(page('encontre-uma-igreja', client))
    await new Promise((resolve) => setTimeout(resolve, 150))
    await act(async () => fontsReady())

    await waitFor(() => expect(scrolls().calls).toHaveLength(1))
    expect(scrolls().contexts[0]).toHaveAttribute('id', 'encontre-uma-igreja')
    delete (document as { fonts?: unknown }).fonts
  })

  it.each(['wheel', 'touchmove', 'keydown'])('never yanks back someone who scrolls first (%s)', async (type) => {
    let fontsReady!: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
    renderHome('encontre-uma-igreja')

    await new Promise((resolve) => setTimeout(resolve, 150))
    window.dispatchEvent(new Event(type))
    await act(async () => fontsReady())
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(scrolls().calls).toHaveLength(0)
    delete (document as { fonts?: unknown }).fonts
  })

  it('stops listening for the person\'s scrolling once it leaves the page', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHome('recursos')

    unmount()

    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['wheel', 'touchmove', 'keydown']))
  })

  it('listens passively, so the page keeps scrolling smoothly', () => {
    const add = vi.spyOn(window, 'addEventListener')

    renderHome('recursos')

    for (const type of ['wheel', 'touchmove', 'keydown']) {
      expect(add).toHaveBeenCalledWith(type, expect.any(Function), { passive: true })
    }
  })
})
