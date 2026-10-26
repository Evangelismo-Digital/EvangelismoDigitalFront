import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { GRANTED_CONSENT, REFUSED_CONSENT, noConsentState } from './consentState'

// These specs are about the banner itself: start without any stored choice.
test.use({ storageState: noConsentState })

interface AnalyticsCall {
  path: string
  query: string
  body: { events?: Array<Record<string, unknown>> } & Record<string, unknown>
}

/** Intercepts the same-origin /analytics proxy and lets this automated browser be tracked. */
const recordAnalytics = async (page: Page) => {
  const calls: AnalyticsCall[] = []
  await page.addInitScript(() => Object.assign(window, { __ANALYTICS_E2E__: true }))
  // Only the API path: a glob like **/analytics/** would also swallow Vite's /src/analytics/*.ts modules.
  await page.route((url) => url.pathname.startsWith('/analytics/'), async (route) => {
    const url = new URL(route.request().url())
    calls.push({ path: url.pathname, query: url.search, body: route.request().postDataJSON() ?? {} })
    await route.fulfill({ status: 204, headers: { 'Cache-Control': 'no-store' } })
  })
  // Keep third parties out of the test.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  return {
    calls,
    paths: () => calls.map((c) => c.path),
    events: () => calls.filter((c) => c.path === '/analytics/events').flatMap((c) => c.body.events ?? []),
  }
}

const banner = (page: Page) => page.getByRole('region', { name: 'Cookies neste site' })
const consentCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === 'ed_consent')
/** Synthetic page exit: closes the current view and flushes the queue, as leaving the site would. */
const leavePage = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('pagehide')))

test.describe('Cookie consent', () => {
  test('first visit: asks, sends nothing and stores nothing until a choice is made', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/')

    await expect(banner(page)).toBeVisible()
    await expect(banner(page).getByRole('button')).toHaveText(['Aceitar', 'Recusar'])
    await page.waitForTimeout(500)
    expect(analytics.paths()).toEqual([])
    expect((await page.context().cookies()).filter((c) => c.name.startsWith('ed_'))).toEqual([])
  })

  test('the banner never hides the end of the page: it can still be scrolled into view above it', async ({ page }) => {
    await recordAnalytics(page)
    await page.goto('/')
    await expect(banner(page)).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const bannerTop = (await banner(page).boundingBox())!.y
    const footerLinks = page.getByRole('contentinfo').getByRole('button', { name: 'Preferências de cookies' })
    const footerBottom = (await footerLinks.boundingBox())!

    expect(footerBottom.y + footerBottom.height).toBeLessThanOrEqual(bannerTop + 1)
  })

  test('"Aceitar": stores consent, opens the session, then sends the page view', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/?utm_source=instagram&utm_campaign=natal&cep=24020085')

    await banner(page).getByRole('button', { name: 'Aceitar' }).click()

    await expect(banner(page)).toBeHidden()
    expect((await consentCookie(page))?.value).toBe(GRANTED_CONSENT)
    await expect.poll(() => analytics.paths()).toContain('/analytics/session')
    const session = analytics.calls.find((c) => c.path === '/analytics/session')!
    expect(session.query).toBe('?utm_source=instagram&utm_campaign=natal')
    expect(session.body).toEqual({ landingPath: '/', referrer: null })

    await leavePage(page)
    await expect.poll(() => analytics.events().map((e) => e.eventType)).toEqual(['page_view', 'page_exit'])
    expect(analytics.events()[0]).toMatchObject({ path: '/' })
    expect(JSON.stringify(analytics.events())).not.toContain('24020085')
  })

  test('"Recusar": stores the refusal, sends nothing, and is not asked again', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/')

    await banner(page).getByRole('button', { name: 'Recusar' }).click()
    await page.reload()
    await leavePage(page)
    await page.waitForTimeout(500)

    await expect(banner(page)).toBeHidden()
    expect((await consentCookie(page))?.value).toBe(REFUSED_CONSENT)
    expect(analytics.paths()).toEqual([])
  })

  test('a returning visitor who accepted is not asked again, and each visit opens a session', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/')
    await banner(page).getByRole('button', { name: 'Aceitar' }).click()
    await expect.poll(() => analytics.paths().filter((p) => p === '/analytics/session')).toHaveLength(1)

    await page.reload()

    await expect(banner(page)).toBeHidden()
    await expect.poll(() => analytics.paths().filter((p) => p === '/analytics/session')).toHaveLength(2)
  })

  test('withdrawing from the footer revokes server-side and stops tracking', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/')
    await banner(page).getByRole('button', { name: 'Aceitar' }).click()
    await expect.poll(() => analytics.paths()).toContain('/analytics/session')

    await page.getByRole('contentinfo').getByRole('button', { name: 'Preferências de cookies' }).click()
    await expect(banner(page).getByRole('button', { name: 'Aceitar' })).toHaveAttribute('aria-pressed', 'true')
    await banner(page).getByRole('button', { name: 'Recusar' }).click()

    await expect.poll(() => analytics.paths()).toContain('/analytics/consent/revoke')
    await expect.poll(async () => (await consentCookie(page))?.value).toBe(REFUSED_CONSENT)
    const before = analytics.calls.length
    await leavePage(page)
    await page.waitForTimeout(500)
    expect(analytics.calls.length).toBe(before)
  })

  test('reading an article: view, depth milestones and the time actually spent', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto('/artigo/oMal')
    await banner(page).getByRole('button', { name: 'Aceitar' }).click()
    await expect(page.locator('[data-analytics-article]')).toBeVisible()

    for (let step = 0; step < 12; step++) {
      await page.mouse.wheel(0, 600)
      await page.waitForTimeout(150)
    }
    await leavePage(page)

    await expect.poll(() => analytics.events().some((e) => e.eventType === 'page_exit')).toBe(true)
    const article = { kind: 'article', slug: 'oMal' }
    const events = analytics.events()
    expect(events.find((e) => e.eventType === 'page_view')).toMatchObject({ path: '/artigo/oMal', payload: article })
    const milestones = events.filter((e) => e.eventType === 'scroll_depth').map((e) => e.scrollDepth)
    expect(milestones.slice(0, 2)).toEqual([25, 50])
    expect(new Set(milestones).size).toBe(milestones.length)
    const exit = events.find((e) => e.eventType === 'page_exit')!
    expect(exit).toMatchObject({ path: '/artigo/oMal', payload: article })
    expect(exit.durationMs as number).toBeGreaterThan(1000)
    expect(exit.scrollDepth as number).toBeGreaterThanOrEqual(50)
  })

  test('a browser sending Global Privacy Control is treated as "Recusar"', async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }))
    await page.goto('/')
    await page.waitForTimeout(500)

    await expect(banner(page)).toBeHidden()
    expect(analytics.paths()).toEqual([])
  })

  test('the banner and the privacy page have no WCAG A/AA violations', async ({ page }) => {
    await recordAnalytics(page)
    await page.goto('/privacidade')
    await expect(banner(page)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('main, section, footer, article')
      .analyze()

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
