import { expect, test, type Page } from '@playwright/test'
import { REAL_API_URL } from '../playwright.real.config'
import { GRANTED_CONSENT, REFUSED_CONSENT, noConsentState } from '../e2e/consentState'

// Through the dev server's /analytics proxy (secret from .env) to the running backend.
test.use({ storageState: noConsentState })

const banner = (page: Page) => page.getByRole('region', { name: 'Cookies neste site' })
const cookie = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name)

/** Tracks this automated browser (the app skips bots otherwise) and records the API's answers. */
/**
 * A distinct benchmark-range IP per test (as the backend's own e2e suite does): /session allows 5 per
 * minute per IP, and the proxy forwards this left-most X-Forwarded-For entry as the visitor's address.
 */
const visitorIp = () => `198.18.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`

const prepare = async (page: Page) => {
  const statuses: Array<[string, number]> = []
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': visitorIp() })
  await page.addInitScript(() => Object.assign(window, { __ANALYTICS_E2E__: true }))
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (path.startsWith('/analytics/')) statuses.push([path, response.status()])
  })
  await page.route('https://api.web3forms.com/**', (route) => route.fulfill({ status: 200, body: '{"success":true}' }))
  return statuses
}

test.describe('Cookie consent — real backend', () => {
  test('nothing is set before a choice; "Aceitar" gets HttpOnly visitor and session cookies from the API', async ({ page }) => {
    const statuses = await prepare(page)
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    expect(await cookie(page, 'ed_vid')).toBeUndefined()

    await banner(page).getByRole('button', { name: 'Aceitar' }).click()

    await expect.poll(() => statuses).toContainEqual(['/analytics/session', 204])
    expect((await cookie(page, 'ed_consent'))?.value).toBe(GRANTED_CONSENT)
    for (const name of ['ed_vid', 'ed_sid']) {
      const set = await cookie(page, name)
      expect(set, `${name} set by the backend`).toBeDefined()
      expect(set).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', domain: 'localhost' })
      // Signed by the backend: "<id>.<signature>", never readable by the page.
      expect(set!.value).toMatch(/\..+/)
    }
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/ed_vid|ed_sid/)
  })

  test('events are accepted (204) and slide the session cookie', async ({ page }) => {
    const statuses = await prepare(page)
    await page.goto('/artigo/oMal')
    await banner(page).getByRole('button', { name: 'Aceitar' }).click()
    await expect.poll(() => statuses).toContainEqual(['/analytics/session', 204])
    await page.mouse.wheel(0, 2000)
    await page.waitForTimeout(500)

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))

    await expect.poll(() => statuses).toContainEqual(['/analytics/events', 204])
    expect(statuses.filter(([, status]) => status === 401)).toEqual([])
  })

  test('withdrawing from the footer makes the backend clear the tracking cookies', async ({ page }) => {
    const statuses = await prepare(page)
    await page.goto('/')
    await banner(page).getByRole('button', { name: 'Aceitar' }).click()
    await expect.poll(async () => cookie(page, 'ed_vid')).toBeDefined()

    await page.getByRole('contentinfo').getByRole('button', { name: 'Preferências de cookies' }).click()
    await banner(page).getByRole('button', { name: 'Recusar' }).click()

    await expect.poll(() => statuses).toContainEqual(['/analytics/consent/revoke', 204])
    await expect.poll(async () => (await cookie(page, 'ed_consent'))?.value).toBe(REFUSED_CONSENT)
    expect(await cookie(page, 'ed_vid')).toBeUndefined()
    expect(await cookie(page, 'ed_sid')).toBeUndefined()
  })

  test('without consent the API sets nothing, and without the proxy secret it refuses (401)', async ({ request }) => {
    const proxied = await request.post('/analytics/session', { data: {}, headers: { 'X-Forwarded-For': visitorIp() } })
    expect(proxied.status()).toBe(204)
    expect(proxied.headers()['set-cookie']).toBeUndefined()

    const direct = await request.post(`${REAL_API_URL}/analytics/session`, { data: {} })
    expect(direct.status()).toBe(401)
  })
})
