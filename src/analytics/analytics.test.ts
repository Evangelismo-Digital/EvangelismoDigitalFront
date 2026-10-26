import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  canTrack,
  cleanEvent,
  flushAnalytics,
  isAnalyticsRunning,
  startAnalytics,
  stopAnalytics,
  track,
  withdrawAnalytics,
} from './analytics'
import { FLUSH_INTERVAL_MS } from './queue'

let fetchMock: MockInstance<typeof fetch>

const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init!, body: JSON.parse(String(init?.body)) }))
const eventCalls = () => calls().filter((c) => c.url === '/analytics/events')
const setFlags = (flags: Record<string, unknown>) => Object.assign(window, flags)
/** Lets the session request (a mocked fetch) settle, which is what releases the queue. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
  window.history.replaceState(null, '', '/artigo/oMal?utm_source=instagram&cep=24020085')
})

afterEach(() => {
  stopAnalytics()
  vi.restoreAllMocks()
  vi.useRealTimers()
  setFlags({ __PRERENDER_INJECTED: undefined, __ANALYTICS_E2E__: undefined })
})

describe('starting', () => {
  it('opens one session for the page load, from the landing page and its campaign only', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.google.com/')

    startAnalytics()
    startAnalytics()

    expect(isAnalyticsRunning()).toBe(true)
    expect(calls()).toHaveLength(1)
    expect(calls()[0].url).toBe('/analytics/session?utm_source=instagram')
    expect(calls()[0].body).toEqual({ landingPath: '/artigo/oMal', referrer: 'https://www.google.com/' })
  })

  it('never runs while the build prerenders the page', () => {
    setFlags({ __PRERENDER_INJECTED: { prerendering: true } })

    startAnalytics()

    expect(canTrack()).toBe(false)
    expect(isAnalyticsRunning()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never runs in an automated browser, unless our E2E suite opts in', () => {
    vi.spyOn(window, 'navigator', 'get').mockReturnValue({ ...navigator, webdriver: true } as Navigator)
    expect(canTrack()).toBe(false)

    setFlags({ __ANALYTICS_E2E__: true })
    expect(canTrack()).toBe(true)
  })
})

describe('tracking', () => {
  it('does nothing before analytics has started (no consent)', async () => {
    vi.useFakeTimers()

    track({ eventType: 'page_view', path: '/' })
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 2)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends tracked events in a batch after the session', async () => {
    vi.useFakeTimers()
    startAnalytics()

    track({ eventType: 'page_view', path: '/', title: 'Início' })
    track({ eventType: 'page_exit', path: '/', durationMs: 1500, scrollDepth: 40 })
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS)

    expect(eventCalls()).toHaveLength(1)
    expect(eventCalls()[0].body.events).toEqual([
      { eventType: 'page_view', path: '/', title: 'Início' },
      { eventType: 'page_exit', path: '/', durationMs: 1500, scrollDepth: 40 },
    ])
  })

  it.each([
    ['visibilitychange', () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    }],
    ['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
    ['flushAnalytics()', () => flushAnalytics()],
  ])('flushes with keepalive on %s', async (_label, leave) => {
    startAnalytics()
    await settle()
    track({ eventType: 'page_view', path: '/' })

    leave()
    await vi.waitFor(() => expect(eventCalls()).toHaveLength(1))

    expect(eventCalls()[0].init.keepalive).toBe(true)
  })

  it('does not flush when the tab becomes visible again', async () => {
    startAnalytics()
    await settle()
    track({ eventType: 'page_view', path: '/' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(eventCalls()).toHaveLength(0)
  })
})

describe('stopping', () => {
  it('drops unsent events and stops listening', async () => {
    startAnalytics()
    await settle()
    track({ eventType: 'page_view', path: '/' })

    stopAnalytics()
    window.dispatchEvent(new Event('pagehide'))
    track({ eventType: 'page_view', path: '/' })
    flushAnalytics()
    await settle()

    expect(isAnalyticsRunning()).toBe(false)
    expect(eventCalls()).toHaveLength(0)
  })

  it('removes both page-leave listeners', () => {
    const removeDoc = vi.spyOn(document, 'removeEventListener')
    const removeWin = vi.spyOn(window, 'removeEventListener')
    startAnalytics()

    stopAnalytics()

    expect(removeDoc.mock.calls.map(([type]) => type)).toContain('visibilitychange')
    expect(removeWin.mock.calls.map(([type]) => type)).toContain('pagehide')
  })

  it('withdraws: stops, then asks the backend to clear the cookies and erase the data', async () => {
    startAnalytics()
    track({ eventType: 'page_view', path: '/' })

    await withdrawAnalytics()

    expect(isAnalyticsRunning()).toBe(false)
    expect(calls().map((c) => c.url)).toEqual(['/analytics/session', '/analytics/consent/revoke'].map((u, i) => (i === 0 ? `${u}?utm_source=instagram` : u)))
  })

  it('can start again after stopping (a new choice in the same visit)', () => {
    startAnalytics()
    stopAnalytics()
    startAnalytics()

    expect(calls().filter((c) => c.url.startsWith('/analytics/session'))).toHaveLength(2)
  })
})

describe('cleanEvent fits events to the backend schema', () => {
  it('keeps a valid event unchanged', () => {
    const event = { eventType: 'page_exit' as const, path: '/a', title: 't', referrer: 'r', durationMs: 10, scrollDepth: 50, payload: { a: 1 } }

    expect(cleanEvent(event)).toEqual(event)
  })

  it('clips long text and falls back to "/" for an empty path', () => {
    const cleaned = cleanEvent({ eventType: 'page_view', path: '', title: 't'.repeat(600), referrer: 'r'.repeat(3000) })

    expect(cleaned.path).toBe('/')
    expect(cleaned.title).toHaveLength(512)
    expect(cleaned.referrer).toHaveLength(2048)
    expect(cleanEvent({ eventType: 'page_view', path: 'p'.repeat(3000) }).path).toHaveLength(2048)
    expect(cleanEvent({ eventType: 'page_view', path: 'p'.repeat(2048) }).path).toHaveLength(2048)
  })

  it.each([
    [-5, 0], [12.6, 13], [90_000_000, 86_400_000], [86_400_000, 86_400_000], [0, 0],
  ])('clamps durationMs %s to %s', (input, output) => {
    expect(cleanEvent({ eventType: 'page_exit', path: '/', durationMs: input }).durationMs).toBe(output)
  })

  it.each([[-1, 0], [33.4, 33], [140, 100], [100, 100], [0, 0]])('clamps scrollDepth %s to %s', (input, output) => {
    expect(cleanEvent({ eventType: 'scroll_depth', path: '/', scrollDepth: input }).scrollDepth).toBe(output)
  })

  it('keeps at most 20 payload keys and clips text values and keys to 512', () => {
    const payload = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, i]))
    const cleaned = cleanEvent({ eventType: 'click', path: '/', payload: { ...payload } })

    expect(Object.keys(cleaned.payload!)).toHaveLength(20)

    const long = cleanEvent({ eventType: 'click', path: '/', payload: { ['k'.repeat(600)]: 'v'.repeat(600), n: 5, b: true, z: null } })
    expect(Object.keys(long.payload!)[0]).toHaveLength(512)
    expect(Object.values(long.payload!)).toEqual(['v'.repeat(512), 5, true, null])
  })

  it('omits optional fields that were not given', () => {
    expect(cleanEvent({ eventType: 'page_view', path: '/' })).toEqual({ eventType: 'page_view', path: '/' })
  })
})
