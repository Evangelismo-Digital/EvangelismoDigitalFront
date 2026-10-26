import { afterEach, describe, expect, it, vi } from 'vitest'
import { churchSearchEvent, contactFormName, contactFormStartEvent, contactFormSubmitEvent } from './events'
import { isAutomatedBrowser, isPrerendering } from './environment'

describe('churchSearchEvent', () => {
  it('reports churches found, with how many and the travel mode', () => {
    expect(churchSearchEvent('/', 'transport', 5, false)).toEqual({
      eventType: 'search',
      path: '/',
      payload: { mode: 'transport', outcome: 'found', resultCount: 5 },
    })
  })

  it('tells "no church nearby" apart from a failure', () => {
    expect(churchSearchEvent('/', 'pedestrian', null, true).payload).toEqual({ mode: 'pedestrian', outcome: 'none', resultCount: 0 })
    expect(churchSearchEvent('/', 'pedestrian', null, false).payload).toEqual({ mode: 'pedestrian', outcome: 'error', resultCount: 0 })
  })

  it('never carries anything typed in the form', () => {
    expect(Object.keys(churchSearchEvent('/', 'pedestrian', 2, false).payload!).sort()).toEqual(['mode', 'outcome', 'resultCount'])
  })
})

describe('contact form events', () => {
  it.each([
    ['/artigo/oMal', 'contato-artigo'],
    ['/', 'contato-home'],
    ['/artigo', 'contato-home'],
  ])('names the form on %s %s', (path, name) => {
    expect(contactFormName(path)).toBe(name)
  })

  it('records the start and the outcome, never the fields', () => {
    expect(contactFormStartEvent('/')).toEqual({ eventType: 'form_start', path: '/', payload: { form: 'contato-home' } })
    expect(contactFormSubmitEvent('/artigo/oMal', true)).toEqual({
      eventType: 'form_submit',
      path: '/artigo/oMal',
      payload: { form: 'contato-artigo', result: 'success' },
    })
    expect(contactFormSubmitEvent('/', false).payload).toEqual({ form: 'contato-home', result: 'error' })
  })
})

describe('environment', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Object.assign(window, { __PRERENDER_INJECTED: undefined, __ANALYTICS_E2E__: undefined })
  })

  it('detects the prerender only by the flag vite.config.ts injects', () => {
    expect(isPrerendering()).toBe(false)
    Object.assign(window, { __PRERENDER_INJECTED: { prerendering: false } })
    expect(isPrerendering()).toBe(false)
    Object.assign(window, { __PRERENDER_INJECTED: { prerendering: true } })
    expect(isPrerendering()).toBe(true)
  })

  it.each([
    [true, undefined, true],
    [true, true, false],
    [false, undefined, false],
    [undefined, undefined, false],
  ])('webdriver=%s with the E2E opt-in %s is automated: %s', (webdriver, optIn, automated) => {
    vi.spyOn(window, 'navigator', 'get').mockReturnValue({ ...navigator, webdriver } as Navigator)
    Object.assign(window, { __ANALYTICS_E2E__: optIn })

    expect(isAutomatedBrowser()).toBe(automated)
  })
})
