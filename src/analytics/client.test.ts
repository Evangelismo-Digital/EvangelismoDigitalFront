import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { ANALYTICS_BASE_PATH, revokeConsent, sendEvents, startSession, utmQuery } from './client'

let fetchMock: MockInstance<typeof fetch>

const call = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index]
  return { url: String(url), init: init!, body: JSON.parse(String(init?.body)) }
}

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('utmQuery', () => {
  it('keeps only the five campaign parameters, in a fixed order', () => {
    expect(utmQuery('?cep=24020085&utm_campaign=natal&utm_source=instagram&utm_medium=social&utm_term=fe&utm_content=reels&x=1'))
      .toBe('?utm_source=instagram&utm_medium=social&utm_campaign=natal&utm_term=fe&utm_content=reels')
  })

  it.each(['', '?', '?section=contato', '?utm_source='])('is empty when there is no campaign (%j)', (search) => {
    expect(utmQuery(search)).toBe('')
  })

  it('encodes values', () => {
    expect(utmQuery('?utm_campaign=p%C3%A1scoa 2026')).toBe('?utm_campaign=p%C3%A1scoa+2026')
  })
})

describe('requests', () => {
  it('opens the session same-origin, with the landing path, referrer and campaign', async () => {
    const ok = await startSession({ landingPath: '/artigo/oMal', referrer: 'https://google.com/', search: '?utm_source=google' })

    expect(ok).toBe(true)
    expect(ANALYTICS_BASE_PATH).toBe('/analytics')
    expect(call().url).toBe('/analytics/session?utm_source=google')
    expect(call().init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      keepalive: false,
      headers: { 'Content-Type': 'application/json' },
    })
    expect(call().body).toEqual({ landingPath: '/artigo/oMal', referrer: 'https://google.com/' })
  })

  it('sends a missing referrer as null', async () => {
    await startSession({ landingPath: '/', referrer: '', search: '' })

    expect(call().url).toBe('/analytics/session')
    expect(call().body).toEqual({ landingPath: '/', referrer: null })
  })

  it.each([true, false])('sends events as JSON with keepalive=%s', async (keepalive) => {
    const events = [{ eventType: 'page_view' as const, path: '/' }]

    await sendEvents(events, keepalive)

    expect(call().url).toBe('/analytics/events')
    expect(call().init).toMatchObject({ keepalive, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    expect(call().body).toEqual({ events })
  })

  it('revokes with keepalive, so it survives the page closing', async () => {
    await revokeConsent()

    expect(call().url).toBe('/analytics/consent/revoke')
    expect(call().init).toMatchObject({ method: 'POST', keepalive: true })
    expect(call().body).toEqual({})
  })

  it('reports a refused request as not sent', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    expect(await sendEvents([{ eventType: 'page_view', path: '/' }], false)).toBe(false)
  })

  it('never throws when the network fails (an ad blocker, offline)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(revokeConsent()).resolves.toBe(false)
  })
})
