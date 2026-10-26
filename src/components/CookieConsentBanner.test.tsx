import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import CookieConsentBanner from './CookieConsentBanner'
import Footer from './Footer'
import AnalyticsConsentProvider from '../analytics/AnalyticsConsentProvider'
import { isAnalyticsRunning, stopAnalytics } from '../analytics/analytics'
import { readCookie } from '../analytics/consent'

let fetchMock: MockInstance<typeof fetch>

const tree = () => (
  <MemoryRouter>
    <AnalyticsConsentProvider>
      <CookieConsentBanner />
      <Footer />
    </AnalyticsConsentProvider>
  </MemoryRouter>
)

const renderBanner = () => ({ user: userEvent.setup(), ...render(tree()) })
const banner = () => screen.queryByRole('region', { name: 'Cookies neste site' })
const consentCookie = () => readCookie(document.cookie, 'ed_consent')
const requested = () => fetchMock.mock.calls.map(([url]) => String(url))
const setConsent = (value: string) => { document.cookie = `ed_consent=${value}; Path=/` }

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
})

afterEach(() => {
  stopAnalytics()
  document.cookie = 'ed_consent=; Max-Age=0; Path=/'
  vi.restoreAllMocks()
  Object.assign(window, { __PRERENDER_INJECTED: undefined })
})

describe('first visit', () => {
  it('asks with the approved text, a privacy link and two equal choices, sending nothing yet', () => {
    renderBanner()

    const region = banner()!
    expect(within(region).getByRole('heading', { level: 2, name: 'Cookies neste site' })).toBeInTheDocument()
    expect(within(region).getByRole('heading').nextElementSibling!.textContent).toBe(
      'Usamos cookies próprios para entender quais páginas e artigos são lidos, e por quanto tempo, para melhorar o conteúdo. ' +
      'Eles só são ativados se você aceitar. Você pode mudar sua escolha a qualquer momento em “Preferências de cookies”, no rodapé. ' +
      'Política de privacidade'
    )
    expect(within(region).getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade')
    const buttons = within(region).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Aceitar', 'Recusar'])
    buttons.forEach((button) => {
      expect(button).toHaveClass('button')
      expect(button).not.toHaveAttribute('aria-pressed')
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(consentCookie()).toBeNull()
  })

  it('"Aceitar" stores the consent and opens the analytics session', async () => {
    const { user } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Aceitar' }))

    expect(consentCookie()).toBe('v1:analytics=1,marketing=0')
    expect(banner()).not.toBeInTheDocument()
    await waitFor(() => expect(requested()).toEqual(['/analytics/session']))
  })

  it('"Recusar" stores the refusal and sends nothing', async () => {
    const { user } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    expect(consentCookie()).toBe('v1:analytics=0,marketing=0')
    expect(banner()).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('returning visitor', () => {
  it('is not asked again after accepting, and analytics starts on its own', async () => {
    setConsent('v1:analytics=1,marketing=0')
    renderBanner()

    expect(banner()).not.toBeInTheDocument()
    await waitFor(() => expect(requested()).toEqual(['/analytics/session']))
  })

  it('is not asked again after refusing', () => {
    setConsent('v1:analytics=0,marketing=0')
    renderBanner()

    expect(banner()).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is asked again when the consent version changed', () => {
    setConsent('v0:analytics=1')
    renderBanner()

    expect(banner()).toBeInTheDocument()
  })
})

describe('changing the choice from the footer', () => {
  it('reopens with the current choice marked, and Esc closes it unchanged', async () => {
    setConsent('v1:analytics=1,marketing=0')
    const { user } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    expect(screen.getByRole('button', { name: 'Aceitar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('{Escape}')
    expect(banner()).not.toBeInTheDocument()
    expect(consentCookie()).toBe('v1:analytics=1,marketing=0')
  })

  it('withdrawing revokes server-side first, then remembers the refusal', async () => {
    setConsent('v1:analytics=1,marketing=0')
    let finishRevoke!: (response: Response) => void
    fetchMock.mockImplementation(async (url) =>
      String(url) === '/analytics/consent/revoke'
        ? new Promise<Response>((resolve) => { finishRevoke = resolve })
        : new Response(null, { status: 204 })
    )
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    await waitFor(() => expect(requested()).toContain('/analytics/consent/revoke'))
    // The backend's answer clears ed_consent; the refusal is written only after it.
    expect(consentCookie()).toBe('v1:analytics=1,marketing=0')
    await act(async () => finishRevoke(new Response(null, { status: 204 })))
    expect(consentCookie()).toBe('v1:analytics=0,marketing=0')
    expect(banner()).not.toBeInTheDocument()
  })

  it('still remembers the refusal when the revoke request fails', async () => {
    setConsent('v1:analytics=1,marketing=0')
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === '/analytics/consent/revoke') throw new TypeError('offline')
      return new Response(null, { status: 204 })
    })
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    await waitFor(() => expect(consentCookie()).toBe('v1:analytics=0,marketing=0'))
  })

  it('opting in after refusing starts analytics', async () => {
    setConsent('v1:analytics=0,marketing=0')
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Aceitar' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Aceitar' }))

    expect(consentCookie()).toBe('v1:analytics=1,marketing=0')
    await waitFor(() => expect(requested()).toEqual(['/analytics/session']))
  })

  it('refusing again when already refused does not call the backend', async () => {
    setConsent('v1:analytics=0,marketing=0')
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(consentCookie()).toBe('v1:analytics=0,marketing=0')
  })

  it('withdraws even when the consent was given earlier in the same visit', async () => {
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    await waitFor(() => expect(requested()).toContain('/analytics/consent/revoke'))
    await waitFor(() => expect(consentCookie()).toBe('v1:analytics=0,marketing=0'))
  })

  it('stops analytics when the consent is withdrawn in another tab', async () => {
    setConsent('v1:analytics=1,marketing=0')
    renderBanner()
    await waitFor(() => expect(isAnalyticsRunning()).toBe(true))

    setConsent('v1:analytics=0,marketing=0')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })

    expect(isAnalyticsRunning()).toBe(false)
  })

  it('opened from the footer before any choice, it marks neither button', async () => {
    const { user } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    expect(banner()).toBeInTheDocument()
    within(banner()!).getAllByRole('button').forEach((button) => expect(button).not.toHaveAttribute('aria-pressed'))
  })

  it('only Esc closes it, not other keys', async () => {
    setConsent('v1:analytics=1,marketing=0')
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.keyboard('{Enter}a')

    expect(banner()).toBeInTheDocument()
  })

  it('Esc does not dismiss the first-visit question', async () => {
    const { user } = renderBanner()

    await user.keyboard('{Escape}')

    expect(banner()).toBeInTheDocument()
  })

  it('stops listening for Esc once closed', async () => {
    setConsent('v1:analytics=1,marketing=0')
    const remove = vi.spyOn(document, 'removeEventListener')
    const { user } = renderBanner()
    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    await user.keyboard('{Escape}')

    expect(remove.mock.calls.map(([type]) => type)).toContain('keydown')
  })
})

describe('Global Privacy Control', () => {
  const withGpc = () => vi.spyOn(window, 'navigator', 'get').mockReturnValue({ ...navigator, globalPrivacyControl: true } as Navigator)

  it('counts as "Recusar": no banner and no analytics', () => {
    withGpc()
    renderBanner()

    expect(banner()).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still lets the visitor opt in explicitly from the footer', async () => {
    withGpc()
    const { user } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))

    expect(consentCookie()).toBe('v1:analytics=1,marketing=0')
    await waitFor(() => expect(requested()).toEqual(['/analytics/session']))
  })
})

describe('room at the bottom of the page', () => {
  it('reserves the banner\'s height while it is open, and gives it back once a choice is made', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(172)
    const { user } = renderBanner()

    expect(document.body.style.paddingBottom).toBe('172px')
    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    expect(document.body.style.paddingBottom).toBe('')
  })

  it('reserves it too when reopened from the footer', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120)
    setConsent('v1:analytics=0,marketing=0')
    const { user } = renderBanner()
    expect(document.body.style.paddingBottom).toBe('')

    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    expect(document.body.style.paddingBottom).toBe('120px')
  })

  it('follows the banner\'s size as it changes (text wrapping, rotation)', async () => {
    let height = 150
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height)
    const observers: Array<{ callback: () => void; disconnect: ReturnType<typeof vi.fn>; observe: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('ResizeObserver', class {
      callback: () => void
      observe = vi.fn()
      disconnect = vi.fn()
      constructor(callback: () => void) { this.callback = callback; observers.push(this) }
    })
    try {
      const { user } = renderBanner()
      expect(observers).toHaveLength(1)
      expect(observers[0].observe).toHaveBeenCalledWith(banner())

      height = 210
      act(() => observers[0].callback())
      expect(document.body.style.paddingBottom).toBe('210px')

      await user.click(screen.getByRole('button', { name: 'Aceitar' }))
      expect(observers[0].disconnect).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('static HTML', () => {
  it('is never part of the server/prerender render', () => {
    expect(renderToString(tree())).not.toContain('Cookies neste site')
  })

  it('stays hidden while the build prerenders the page', () => {
    Object.assign(window, { __PRERENDER_INJECTED: { prerendering: true } })

    renderBanner()

    expect(banner()).not.toBeInTheDocument()
  })
})

describe('footer', () => {
  it('links to the privacy policy and reopens the choice', () => {
    renderBanner()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade')
    expect(within(footer).getByRole('button', { name: 'Preferências de cookies' })).toHaveAttribute('type', 'button')
  })
})
