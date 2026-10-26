import { act, render, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AnalyticsRouteTracker from './AnalyticsRouteTracker'
import { AnalyticsConsentContext, type AnalyticsConsentValue } from './consentContext'
import type { ConsentView } from './useConsent'
import { flushAnalytics, track } from './analytics'

vi.mock('./analytics', () => ({ track: vi.fn(), flushAnalytics: vi.fn() }))

const tracked = () => vi.mocked(track).mock.calls.map(([event]) => event)
const ofType = (type: string) => tracked().filter((event) => event.eventType === type)

let now = 0

const consentValue = (consent: ConsentView): AnalyticsConsentValue => ({
  consent,
  preferencesOpen: false,
  openPreferences: vi.fn(),
  closePreferences: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(async () => {}),
})

const visit = (path: string, consent: ConsentView = 'granted') => {
  const router = createMemoryRouter(
    [{ path: '*', element: <AnalyticsConsentContext.Provider value={consentValue(consent)}><AnalyticsRouteTracker /></AnalyticsConsentContext.Provider> }],
    { initialEntries: [path] }
  )
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

/** The page view goes out on the next animation frame. */
const viewed = () => waitFor(() => expect(ofType('page_view').length).toBeGreaterThan(0))

const articleBody = (top: number, height: number) => {
  const article = document.createElement('article')
  article.setAttribute('data-analytics-article', '')
  article.getBoundingClientRect = () => ({ top, height }) as DOMRect
  document.body.appendChild(article)
  return article
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

const scroll = async () => {
  window.dispatchEvent(new Event('scroll'))
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

beforeEach(() => {
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
  document.title = 'Evangelismo Digital'
})

afterEach(() => {
  vi.mocked(track).mockClear()
  vi.mocked(flushAnalytics).mockClear()
  vi.restoreAllMocks()
  document.querySelectorAll('[data-analytics-article], a').forEach((el) => el.remove())
})

describe('without consent', () => {
  it.each(['unset', 'denied', 'unknown'] as const)('records nothing (%s)', async (consent) => {
    const { router, unmount } = visit('/', consent)
    await nextFrame()

    await act(() => router.navigate('/privacidade'))
    await nextFrame()
    window.dispatchEvent(new Event('pagehide'))
    unmount()

    expect(track).not.toHaveBeenCalled()
    expect(flushAnalytics).not.toHaveBeenCalled()
  })
})

describe('page views', () => {
  it('records the view with the page title, without the query string', async () => {
    visit('/?section=contato&utm_source=x')
    await viewed()

    expect(tracked()).toEqual([{ eventType: 'page_view', path: '/', title: 'Evangelismo Digital', payload: undefined }])
  })

  it('on navigation, closes the previous view before the next one, with the visible time', async () => {
    const { router } = visit('/')
    await viewed()

    now += 4500
    await act(() => router.navigate('/privacidade'))
    await waitFor(() => expect(ofType('page_view')).toHaveLength(2))

    expect(tracked().map((e) => [e.eventType, e.path])).toEqual([
      ['page_view', '/'],
      ['page_exit', '/'],
      ['page_view', '/privacidade'],
    ])
    expect(ofType('page_exit')[0]).toMatchObject({ durationMs: 4500, title: 'Evangelismo Digital' })
  })

  it('does not record a new view for a query-only change', async () => {
    const { router } = visit('/')
    await viewed()

    await act(() => router.navigate('/?section=recursos'))

    expect(tracked().map((e) => e.eventType)).toEqual(['page_view'])
  })

  it('does not count time the tab spent hidden', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { unmount } = visit('/')
    await viewed()

    now += 2000
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    now += 60_000
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    now += 1000
    unmount()

    expect(ofType('page_exit')[0].durationMs).toBe(3000)
  })

  it('closes the view and sends at once when the page is left, only once', async () => {
    const { unmount } = visit('/')
    await viewed()

    window.dispatchEvent(new Event('pagehide'))

    expect(ofType('page_exit')).toHaveLength(1)
    expect(flushAnalytics).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pagehide'))
    unmount()
    expect(ofType('page_exit')).toHaveLength(1)
  })

  it('records no exit for a view that never started (left within the same frame)', async () => {
    const { unmount } = visit('/')

    unmount()
    await nextFrame()
    await nextFrame()

    expect(track).not.toHaveBeenCalled()
  })

  it('stops listening after the view ends', async () => {
    const removeWin = vi.spyOn(window, 'removeEventListener')
    const removeDoc = vi.spyOn(document, 'removeEventListener')
    const { unmount } = visit('/')
    await viewed()
    unmount()
    vi.mocked(track).mockClear()

    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('scroll'))
    document.body.click()

    expect(track).not.toHaveBeenCalled()
    expect(flushAnalytics).not.toHaveBeenCalled()
    expect(removeWin.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['scroll', 'pagehide']))
    expect(removeDoc.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['visibilitychange', 'click']))
  })

  it('listens to scrolling passively, so reading never janks', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    visit('/')
    await viewed()

    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
  })

  it('starts the clock only when a page opened in a background tab is shown', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { unmount } = visit('/')
    await viewed()

    now += 30_000                     // still in the background
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    now += 2000
    unmount()

    expect(ofType('page_exit')[0].durationMs).toBe(2000)
  })
})

describe('articles', () => {
  it('tags every event with the article and measures depth against its body', async () => {
    const article = articleBody(400, 2000)
    const { unmount } = visit('/artigo/oMal')
    await viewed()

    article.getBoundingClientRect = () => ({ top: -900, height: 2000 }) as DOMRect   // 85% read
    await scroll()
    now += 120_000
    unmount()

    const payload = { kind: 'article', slug: 'oMal' }
    expect(ofType('page_view')[0]).toMatchObject({ path: '/artigo/oMal', payload })
    expect(ofType('scroll_depth').map((e) => e.scrollDepth)).toEqual([25, 50, 75])
    ofType('scroll_depth').forEach((e) => expect(e).toMatchObject({ path: '/artigo/oMal', payload }))
    expect(ofType('page_exit')[0]).toMatchObject({ durationMs: 120_000, scrollDepth: 85, payload })
  })

  it('reports a milestone once even when scrolling back and forth', async () => {
    const article = articleBody(0, 1000)
    visit('/artigo/oMal')
    await viewed()

    for (const top of [-300, 0, -300]) {
      article.getBoundingClientRect = () => ({ top, height: 1000 }) as DOMRect
      await scroll()
    }

    expect(ofType('scroll_depth').map((e) => e.scrollDepth)).toEqual([25, 50, 75, 100])
  })

  it('measures nothing until the article body has loaded (not even against the whole page)', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1000)
    const { unmount } = visit('/artigo/oMal')
    await viewed()
    await scroll()
    unmount()

    expect(ofType('scroll_depth')).toEqual([])
    expect(ofType('page_exit')[0].scrollDepth).toBe(0)
  })

  it('does not send milestones for pages that are not articles', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1000)
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(200)
    const { unmount } = visit('/')
    await viewed()
    await scroll()
    unmount()

    expect(ofType('scroll_depth')).toEqual([])
    expect(ofType('page_exit')[0].scrollDepth).toBe(100)
  })

  it('throttles scroll measurements to one per frame, and keeps measuring in later frames', async () => {
    const article = articleBody(800, 1000)
    let measured = 0
    let top = 800
    article.getBoundingClientRect = () => {
      measured++
      return { top, height: 1000 } as DOMRect
    }
    visit('/artigo/oMal')
    await viewed()
    measured = 0

    top = 500                         // 30% read
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    await nextFrame()
    expect(measured).toBe(1)

    top = 200                         // 60% read, in a later frame
    await scroll()
    expect(measured).toBe(2)
    expect(ofType('scroll_depth').map((e) => e.scrollDepth)).toEqual([25, 50])
  })

  it('measures as soon as the article is shown, without waiting for a scroll', async () => {
    articleBody(0, 600)               // a short article, fully on screen
    visit('/artigo/oMal')
    await viewed()

    expect(ofType('scroll_depth').map((e) => e.scrollDepth)).toEqual([25, 50, 75, 100])
  })

  it('ignores scrolling before the view is recorded', () => {
    articleBody(0, 600)
    visit('/artigo/oMal')

    window.dispatchEvent(new Event('scroll'))

    expect(track).not.toHaveBeenCalled()
  })

  it('takes a last depth reading when the view ends', async () => {
    const article = articleBody(800, 1000)
    const { unmount } = visit('/artigo/oMal')
    await viewed()

    article.getBoundingClientRect = () => ({ top: 100, height: 1000 }) as DOMRect   // 70%, no scroll event
    unmount()

    expect(ofType('page_exit')[0].scrollDepth).toBe(70)
  })
})

describe('outbound links', () => {
  const link = (href: string, kind?: string) => {
    const a = document.createElement('a')
    a.href = href
    if (kind) a.dataset.analytics = kind
    a.innerHTML = '<span>texto</span>'
    a.addEventListener('click', (event) => event.preventDefault())
    document.body.appendChild(a)
    return a
  }

  it('records the destination host and the link kind, never the full URL', async () => {
    visit('/')
    await viewed()

    link('https://www.google.com/maps/dir/?api=1&origin=-22.9%2C-43.1&destination=x', 'maps-directions').querySelector('span')!.click()

    expect(ofType('outbound_click')).toEqual([
      { eventType: 'outbound_click', path: '/', payload: { host: 'www.google.com', kind: 'maps-directions' } },
    ])
  })

  it('calls an untagged external link "link"', async () => {
    visit('/')
    await viewed()

    link('http://example.org/x').click()

    expect(ofType('outbound_click')[0].payload).toEqual({ host: 'example.org', kind: 'link' })
  })

  it.each([
    ['a link on this site', () => link(`${window.location.origin}/artigo/oMal`).click()],
    ['a mailto link', () => link('mailto:contato@example.org').click()],
    ['a click outside any link', () => document.body.click()],
  ])('ignores %s', async (_label, click) => {
    visit('/')
    await viewed()

    click()

    expect(ofType('outbound_click')).toEqual([])
  })
})
