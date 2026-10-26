import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  consentCookieString,
  effectiveConsent,
  hasGlobalPrivacyControl,
  parseConsent,
  readConsent,
  readCookie,
  serializeConsent,
  subscribeConsent,
  writeConsent,
} from './consent'

const clearCookies = () => {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

afterEach(() => {
  clearCookies()
  vi.restoreAllMocks()
})

describe('consent format (mirrors the backend parser)', () => {
  it('uses the backend cookie name, version and twelve-month life', () => {
    expect(CONSENT_COOKIE).toBe('ed_consent')
    expect(CONSENT_VERSION).toBe('v1')
    expect(CONSENT_MAX_AGE_SECONDS).toBe(31_536_000)
  })

  it.each([
    [true, 'v1:analytics=1,marketing=0'],
    [false, 'v1:analytics=0,marketing=0'],
  ])('serializes analytics=%s as %s, never granting marketing', (analytics, value) => {
    expect(serializeConsent(analytics)).toBe(value)
  })

  it.each([
    ['v1:analytics=1,marketing=0', 'granted'],
    ['v1:analytics=1', 'granted'],
    ['v1:marketing=0, analytics=1 ', 'granted'],
    ['v1:analytics=1,analytics=0', 'granted'],
    ['v1:analytics=0,marketing=0', 'denied'],
    ['v1:analytics=true', 'denied'],
    ['v1:analytics', 'denied'],
    ['v1:', 'denied'],
    ['v1:marketing=1', 'denied'],
    ['v2:analytics=1', 'unset'],
    ['analytics=1', 'unset'],
    ['V1:analytics=1', 'unset'],
    ['', 'unset'],
  ] as const)('reads %j as %s', (raw, state) => {
    expect(parseConsent(raw)).toBe(state)
  })

  it.each([null, undefined])('reads a missing cookie (%j) as unset', (raw) => {
    expect(parseConsent(raw)).toBe('unset')
  })

  it('round-trips both choices', () => {
    expect(parseConsent(serializeConsent(true))).toBe('granted')
    expect(parseConsent(serializeConsent(false))).toBe('denied')
  })
})

describe('readCookie', () => {
  it.each([
    ['a=1; ed_consent=v1:analytics=1,marketing=0; b=2', 'v1:analytics=1,marketing=0'],
    ['ed_consent=v1%3Aanalytics%3D1', 'v1:analytics=1'],
    ['ed_consent=%E0%A4%A', '%E0%A4%A'],
    ['  ed_consent = x ', 'x'],
    ['xed_consent=1; ed_consentx=2', null],
    ['ed_consentx', null],
    ['ed_consent', null],
    ['', null],
  ])('reads %j as %j', (header, value) => {
    expect(readCookie(header, 'ed_consent')).toBe(value)
  })

  it('reads a one-letter cookie name', () => {
    expect(readCookie('a=1; b=2', 'a')).toBe('1')
    expect(readCookie('ab=1', 'a')).toBeNull()
  })
})

describe('the consent cookie in the browser', () => {
  it('is host-only, site-wide, Lax and Secure on HTTPS', () => {
    expect(consentCookieString(true, true)).toBe('ed_consent=v1:analytics=1,marketing=0; Max-Age=31536000; Path=/; SameSite=Lax; Secure')
    expect(consentCookieString(false, false)).toBe('ed_consent=v1:analytics=0,marketing=0; Max-Age=31536000; Path=/; SameSite=Lax')
  })

  it('writes the choice, reads it back and tells subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeConsent(listener)

    expect(readConsent()).toBe('unset')
    writeConsent(true)
    expect(readConsent()).toBe('granted')
    writeConsent(false)
    expect(readConsent()).toBe('denied')
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    writeConsent(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('writes Secure only when the page is served over HTTPS', () => {
    const cookie = vi.spyOn(document, 'cookie', 'set')

    writeConsent(true)
    expect(cookie).toHaveBeenLastCalledWith(expect.not.stringContaining('Secure'))

    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, protocol: 'https:' })
    writeConsent(true)
    expect(cookie).toHaveBeenLastCalledWith(expect.stringMatching(/; Secure$/))
  })

  it('re-reads on return to the tab, for a choice made in another tab, and stops listening when unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeConsent(listener)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('removes the document listener only when the last subscriber leaves', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const unsubscribeFirst = subscribeConsent(vi.fn())
    const unsubscribeSecond = subscribeConsent(vi.fn())

    unsubscribeFirst()
    expect(remove).not.toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    unsubscribeSecond()
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('keeps listening while another subscriber remains', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribeConsent(first)
    const unsubscribeSecond = subscribeConsent(second)

    unsubscribeFirst()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    unsubscribeSecond()
  })
})

describe('Global Privacy Control', () => {
  it.each([
    ['unset', true, 'denied'],
    ['unset', false, 'unset'],
    ['granted', true, 'granted'],
    ['denied', false, 'denied'],
  ] as const)('stored %s with GPC=%s acts as %s', (stored, gpc, effective) => {
    expect(effectiveConsent(stored, gpc)).toBe(effective)
  })

  it.each([
    [true, true],
    [false, false],
    [undefined, false],
    ['1', false],
  ])('reads navigator.globalPrivacyControl=%j as %s', (value, expected) => {
    vi.spyOn(window, 'navigator', 'get').mockReturnValue({ ...navigator, globalPrivacyControl: value } as Navigator)

    expect(hasGlobalPrivacyControl()).toBe(expected)
  })
})
