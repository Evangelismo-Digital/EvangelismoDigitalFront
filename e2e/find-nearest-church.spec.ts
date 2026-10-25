import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { E2E_API_URL, E2E_WEB3FORMS_KEY } from '../playwright.config'
import { churches, nearestResponse } from './fixtures/churches'
import { tapThrough } from './tapThrough'

const NEAREST_URL = `${E2E_API_URL}/churches/nearest?cep=24020085&mode=pedestrian`

type Handler = (route: Route) => Promise<void> | void

const json = (body: unknown, status = 200): Parameters<Route['fulfill']>[0] => ({
  status,
  contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
})

/** Mocks the backend, Web3Forms and Google Maps; returns the request logs. */
const mockNetwork = async (page: Page, nearest: Handler = (route) => route.fulfill(json(nearestResponse()))) => {
  const backendUrls: string[] = []
  const leads: Record<string, string>[] = []

  await page.route(`${E2E_API_URL}/**`, async (route) => {
    backendUrls.push(route.request().url())
    await nearest(route)
  })
  await page.route('https://api.web3forms.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
    }
    leads.push(route.request().postDataJSON())
    return route.fulfill(json({ success: true, message: 'ok' }))
  })
  await page.context().route('https://www.google.com/maps/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google Maps (stub)</title>' })
  )

  return { backendUrls, leads }
}

const section = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { level: 1, name: 'Encontre uma igreja perto de você' }) })

const cards = (page: Page) => page.getByRole('region', { name: 'Igrejas mais próximas' }).getByRole('listitem')

const search = async (page: Page, cep: string, email = 'maria@email.com') => {
  const root = section(page)
  await root.getByLabel('CEP').fill(cep)
  await root.getByLabel('Email').fill(email)
  await root.getByRole('button', { name: 'Buscar igrejas' }).click()
}

const expectNoHorizontalOverflow = async (page: Page) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test.describe('Find nearest church', () => {
  test('starts with the invitation and the form, with no map engine, iframe, map link or backend call', async ({ page }, testInfo) => {
    const mapsScripts: string[] = []
    page.on('request', (request) => {
      if (/maps\.googleapis\.com|maps\.gstatic\.com|google\.com\/maps/.test(request.url())) mapsScripts.push(request.url())
    })
    const { backendUrls } = await mockNetwork(page)

    await page.goto('/')
    await section(page).scrollIntoViewIfNeeded()

    await expect(section(page).getByText('digite seu CEP para se conectar com nossa equipe de voluntários e com igrejas perto de você.')).toBeVisible()
    await expect(section(page).getByText(/^CEP é o código postal de 8 números/)).toBeVisible()
    await expect(section(page).getByRole('link', { name: 'Consulte nos Correios (abre em nova aba)' }))
      .toHaveAttribute('href', 'https://buscacepinter.correios.com.br/app/endereco/index.php')
    await expect(section(page).getByRole('link', { name: /Ver todas as igrejas no mapa/ })).toHaveCount(0)
    await expect(section(page).locator('iframe')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Igrejas mais próximas' })).toHaveCount(0)

    // The button comes after both fields.
    const cepBox = await section(page).getByLabel('CEP').boundingBox()
    const emailBox = await section(page).getByLabel('Email').boundingBox()
    const buttonBox = await section(page).getByRole('button', { name: 'Buscar igrejas' }).boundingBox()
    expect(emailBox!.y).toBeGreaterThan(cepBox!.y + cepBox!.height)
    expect(buttonBox!.y).toBeGreaterThan(emailBox!.y + emailBox!.height)

    expect(backendUrls).toEqual([])
    expect(mapsScripts).toEqual([])
    await expectNoHorizontalOverflow(page)
    await section(page).screenshot({ path: testInfo.outputPath('church-search-form.png') })
  })

  test('masks the CEP while typing', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')

    const cep = section(page).getByLabel('CEP')
    await cep.pressSequentially('24020085')

    await expect(cep).toHaveValue('24020-085')
  })

  test('validates the CEP without calling the backend', async ({ page }) => {
    const { backendUrls } = await mockNetwork(page)
    await page.goto('/')

    await search(page, '2402')

    await expect(section(page).getByRole('alert')).toHaveText('CEP deve ter 8 dígitos.')
    expect(backendUrls).toEqual([])
  })

  test('lists the five nearest churches with exact-point and directions links', async ({ page }, testInfo) => {
    const { backendUrls, leads } = await mockNetwork(page)
    await page.goto('/')

    await search(page, '24020-085')

    await expect(cards(page)).toHaveCount(5)
    expect(backendUrls).toEqual([NEAREST_URL])
    // Every search is reported.
    await expect.poll(() => leads.length).toBe(1)
    expect(leads[0]).toMatchObject({ email: 'maria@email.com', cep: '24020-085', igreja_mais_proxima: 'Igreja Batista Central' })

    await expect(page.getByRole('region', { name: 'Igrejas mais próximas' }).getByText('CEP 24020-085')).toBeVisible()
    await expect(cards(page).getByRole('heading', { level: 3 })).toHaveText(churches.map((c) => c.name))
    await expect(cards(page).first().getByText('Mais próxima')).toBeVisible()
    await expect(page.getByText('Mais próxima', { exact: true })).toHaveCount(1)
    await expect(cards(page).first().getByText('450 m a pé')).toBeVisible()
    await expect(cards(page).nth(4).getByText('12,8 km a pé')).toBeVisible()
    await expect(cards(page).nth(2).getByText('Endereço não informado — toque para ver no mapa.')).toBeVisible()

    const mapLinks = cards(page).getByRole('link', { name: /Ver no Google Maps/ })
    await expect(mapLinks.first()).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-22.894623%2C-43.123987')
    await expect(mapLinks.first()).toHaveAttribute('rel', 'noopener noreferrer')
    const directions = cards(page).getByRole('link', { name: /^Como chegar/ })
    await expect(directions.nth(1)).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.903000%2C-43.108000&travelmode=walking')

    await expectNoHorizontalOverflow(page)
    await section(page).screenshot({ path: testInfo.outputPath('church-list.png') })
  })

  test('brings the list into view after a search, below the fixed menu and inside the search card', async ({ page }, testInfo) => {
    await mockNetwork(page)
    await page.goto('/')
    await section(page).getByLabel('CEP').scrollIntoViewIfNeeded()

    await search(page, '24020085')

    const region = page.getByRole('region', { name: 'Igrejas mais próximas' })
    await expect(cards(page)).toHaveCount(5)
    // Smooth scrolling settles on its own; wait for the heading to stop moving below the navbar.
    await expect(region.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect.poll(async () => {
      const navBottom = await page.locator('nav').evaluate((nav) => nav.getBoundingClientRect().bottom)
      const headingTop = await region.getByRole('heading', { level: 2 }).evaluate((h) => h.getBoundingClientRect().top)
      return headingTop >= navBottom && headingTop < 400
    }).toBe(true)
    // The list replaces the illustration: beside the form on desktop, under the search button on smaller screens.
    await expect(section(page).locator('svg[viewBox="0 0 400 300"]')).toHaveCount(0)
    const button = (await section(page).getByRole('button', { name: 'Buscar igrejas' }).boundingBox())!
    const list = (await region.boundingBox())!
    if (testInfo.project.name === 'desktop') {
      expect(list.x + list.width).toBeLessThanOrEqual(button.x)
    } else {
      expect(list.y).toBeGreaterThanOrEqual(button.y + button.height)
    }

    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('results-in-view.png') })
  })

  test('opens the exact point when the card itself is tapped', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')
    await search(page, '24020085')

    // The heading is covered by the stretched map link; force a real click at its position.
    const popupPromise = page.waitForEvent('popup')
    await tapThrough(page, cards(page).first().getByRole('heading', { level: 3 }))
    const popup = await popupPromise

    expect(popup.url()).toBe('https://www.google.com/maps/search/?api=1&query=-22.894623%2C-43.123987')
  })

  test('opens directions from the searched CEP, not the exact point, from "Como chegar"', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')
    await search(page, '24020085')

    const popupPromise = page.waitForEvent('popup')
    await cards(page).first().getByRole('link', { name: /^Como chegar/ }).click()
    const popup = await popupPromise

    // The route starts at the origin the backend sent for the CEP, not wherever the device happens to be.
    expect(popup.url()).toBe('https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.894623%2C-43.123987&travelmode=walking')
  })

  test('touch targets are at least 44px tall', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')
    await search(page, '24020085')
    await expect(cards(page)).toHaveCount(5)

    for (const link of await cards(page).getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('sends the email as a lead with the nearest church', async ({ page }) => {
    const { leads } = await mockNetwork(page)
    await page.goto('/')

    await search(page, '24020085', 'maria@email.com')

    await expect(cards(page)).toHaveCount(5)
    await expect.poll(() => leads.length).toBe(1)
    expect(leads[0]).toMatchObject({
      access_key: E2E_WEB3FORMS_KEY,
      subject: 'Busca de igreja - CEP 24020-085',
      email: 'maria@email.com',
      como_vai: 'a pé',
      igreja_mais_proxima: 'Igreja Batista Central',
    })
  })

  test('offers a car search when nothing is within walking distance', async ({ page }) => {
    const { backendUrls } = await mockNetwork(page, (route) =>
      route.request().url().includes('mode=transport')
        ? route.fulfill(json(nearestResponse()))
        : route.fulfill(json({ message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404))
    )
    await page.goto('/')

    await search(page, '24020085')
    await expect(section(page).getByRole('alert')).toHaveText(/Nenhuma igreja a até 10 km a pé desse CEP\./)
    await section(page).getByRole('button', { name: 'Ver igrejas de carro' }).click()

    await expect(cards(page)).toHaveCount(5)
    await expect(cards(page).first().getByText('450 m de carro')).toBeVisible()
    await expect(section(page).getByRole('radio', { name: 'De carro' })).toBeChecked()
    await expect(cards(page).first().getByRole('link', { name: /^Como chegar/ }))
      .toHaveAttribute('href', /travelmode=driving$/)
    expect(backendUrls).toEqual([NEAREST_URL, NEAREST_URL.replace('pedestrian', 'transport')])
  })

  test('switching to "De carro" after a search repeats it by car', async ({ page }) => {
    const { backendUrls } = await mockNetwork(page)
    await page.goto('/')
    await search(page, '24020085')
    await expect(cards(page).first().getByText('450 m a pé')).toBeVisible()

    await section(page).getByText('De carro', { exact: true }).click()

    await expect(cards(page).first().getByText('450 m de carro')).toBeVisible()
    expect(backendUrls).toEqual([NEAREST_URL, NEAREST_URL.replace('pedestrian', 'transport')])
  })

  test('explains when no church is registered nearby by car', async ({ page }) => {
    await mockNetwork(page, (route) =>
      route.fulfill(json({ message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404))
    )
    await page.goto('/')

    await section(page).getByText('De carro', { exact: true }).click()
    await search(page, '24020085')

    await expect(section(page).getByRole('alert')).toHaveText('Ainda não temos igrejas cadastradas perto desse CEP.')
    await expect(section(page).getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)
  })

  test('recovers from a rate limit through "Tentar novamente"', async ({ page }) => {
    let calls = 0
    await mockNetwork(page, (route) => {
      calls += 1
      return route.fulfill(calls === 1 ? json({ message: 'x', code: 'RATE_LIMITED' }, 429) : json(nearestResponse()))
    })
    await page.goto('/')

    await search(page, '24020085')
    await expect(section(page).getByRole('alert')).toHaveText(/Muitas buscas seguidas/)
    await section(page).getByRole('button', { name: 'Tentar novamente' }).click()

    await expect(cards(page)).toHaveCount(5)
    await expect(section(page).getByRole('alert')).toHaveCount(0)
    expect(calls).toBe(2)
  })

  test('reuses a saved result after a reload, even with the backend down', async ({ page }) => {
    let backendUp = true
    const { backendUrls } = await mockNetwork(page, (route) =>
      route.fulfill(backendUp ? json(nearestResponse()) : json(null, 503))
    )
    await page.goto('/')
    await search(page, '24020085')
    await expect(cards(page)).toHaveCount(5)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('evangelismo-digital-query-cache') ?? ''))
      .toContain('Igreja Batista Central')

    backendUp = false
    await page.reload()
    await search(page, '24020-085')

    await expect(cards(page)).toHaveCount(5)
    await expect(section(page).getByRole('alert')).toHaveCount(0)
    expect(backendUrls).toEqual([NEAREST_URL])
  })

  test('the idle form has no WCAG A/AA violations', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')
    await search(page, '', '')
    await expect(section(page).getByRole('alert')).toHaveText(['Digite seu CEP.', 'Digite seu email.'])

    await section(page).evaluate((el) => el.setAttribute('data-axe-scope', 'find-nearest-church'))
    const results = await new AxeBuilder({ page })
      .include('[data-axe-scope="find-nearest-church"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })

  test('the section with results has no WCAG A/AA violations', async ({ page }) => {
    await mockNetwork(page)
    await page.goto('/')
    await search(page, '24020085')
    await expect(cards(page)).toHaveCount(5)

    await section(page).evaluate((el) => el.setAttribute('data-axe-scope', 'find-nearest-church'))
    const results = await new AxeBuilder({ page })
      .include('[data-axe-scope="find-nearest-church"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})
