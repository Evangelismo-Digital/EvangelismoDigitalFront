import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { REAL_API_URL } from '../playwright.real.config'
import { buildGoogleMapsUrl, formatDistancePtBr, toChurchItem, type PublicNearbyChurch } from '../src/util/googleMapsUrl'
import { tapThrough } from '../e2e/tapThrough'

type Mode = 'pedestrian' | 'transport'

interface NearestResponse {
  nearestChurchesInfo: PublicNearbyChurch[]
  origin: { lat: number; lon: number }
  mode: Mode
}

const SUFFIX: Record<Mode, string> = { pedestrian: 'a pé', transport: 'de carro' }
const TRAVELMODE: Record<Mode, 'walking' | 'driving'> = { pedestrian: 'walking', transport: 'driving' }

/** What the real API says right now, fetched outside the browser to build the expectations. */
const apiNearest = async (request: APIRequestContext, cep: string, mode: Mode): Promise<NearestResponse> => {
  const response = await request.get(`${REAL_API_URL}/churches/nearest?cep=${cep}&mode=${mode}`)
  expect(response.status(), `API ${cep}/${mode}`).toBe(200)
  return response.json()
}

/** Leads must never reach the real Web3Forms; Google Maps popups get a stub page. */
const stubThirdParties = async (page: Page) => {
  const leads: Record<string, string>[] = []
  await page.route('https://api.web3forms.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
    }
    leads.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"success":true,"message":"ok"}' })
  })
  await page.context().route('https://www.google.com/maps/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google Maps (stub)</title>' })
  )
  const backendCalls: string[] = []
  page.on('request', (req) => {
    if (req.url().startsWith(`${REAL_API_URL}/`)) backendCalls.push(req.url())
  })
  return { leads, backendCalls }
}

const section = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { level: 1, name: 'Encontre uma igreja perto de você' }) })
const results = (page: Page) => page.getByRole('region', { name: 'Igrejas mais próximas' })
const stops = (page: Page) => results(page).getByRole('listitem')

const search = async (page: Page, cep: string, email = 'teste.e2e@example.com') => {
  await section(page).getByLabel('CEP').fill(cep)
  await section(page).getByLabel('Email').fill(email)
  await section(page).getByRole('button', { name: 'Buscar igrejas' }).click()
}

/** Every stop must show exactly what the API returned, in order, with correct links. */
const expectStopsToMatch = async (page: Page, api: NearestResponse) => {
  const churches = api.nearestChurchesInfo
  const origin = { latitude: api.origin.lat, longitude: api.origin.lon }
  await expect(stops(page)).toHaveCount(churches.length)

  for (const [index, church] of churches.entries()) {
    const stop = stops(page).nth(index)
    const item = toChurchItem(church)
    await expect(stop.getByRole('heading', { level: 3 })).toHaveText(church.name)
    await expect(stop.getByText(`${formatDistancePtBr(church.distanceKm)} ${SUFFIX[api.mode]}`, { exact: true })).toBeVisible()
    await expect(stop.getByText(church.address ?? 'Endereço não informado — toque para ver no mapa.', { exact: true })).toBeVisible()
    await expect(stop.getByRole('link', { name: /Ver no Google Maps/ })).toHaveAttribute('href', buildGoogleMapsUrl(item))
    // Directions start at the point the backend resolved the CEP to, never at the device's location.
    const directions = stop.getByRole('link', { name: /^Como chegar/ })
    await expect(directions).toHaveAttribute('href', buildGoogleMapsUrl(item, 'directions', TRAVELMODE[api.mode], origin))
    await expect(directions).toHaveAttribute('href', new RegExp(`[?&]origin=${api.origin.lat.toFixed(6)}%2C${api.origin.lon.toFixed(6)}&`))
  }
  await expect(stops(page).first().getByText('Mais próxima', { exact: true })).toBeVisible()
}

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${REAL_API_URL}/churches/nearest?cep=00000000`).catch(() => null)
  expect(response, `backend not reachable at ${REAL_API_URL}`).not.toBeNull()
})

test.describe('Find nearest church — real backend', () => {
  test('walking search shows the real nearest churches with correct links', async ({ page, request }, testInfo) => {
    const { backendCalls } = await stubThirdParties(page)
    const api = await apiNearest(request, '24020085', 'pedestrian')
    await page.goto('/')

    await search(page, '24020-085')

    await expectStopsToMatch(page, api)
    await expect(results(page).getByText('CEP 24020-085', { exact: true })).toBeVisible()
    expect(backendCalls).toEqual([`${REAL_API_URL}/churches/nearest?cep=24020085&mode=pedestrian`])
    await section(page).screenshot({ path: testInfo.outputPath('real-walking.png') })
  })

  test('switching to "De carro" shows the real driving results', async ({ page, request }, testInfo) => {
    const { backendCalls } = await stubThirdParties(page)
    const api = await apiNearest(request, '24020085', 'transport')
    await page.goto('/')
    await search(page, '24020085')
    await expect(stops(page).first()).toBeVisible()

    await section(page).getByText('De carro', { exact: true }).click()

    await expectStopsToMatch(page, api)
    expect(backendCalls.at(-1)).toBe(`${REAL_API_URL}/churches/nearest?cep=24020085&mode=transport`)
    await section(page).screenshot({ path: testInfo.outputPath('real-driving.png') })
  })

  test('Rio Centro by car reaches churches in both cities', async ({ page, request }) => {
    await stubThirdParties(page)
    const api = await apiNearest(request, '20031050', 'transport')
    await page.goto('/')

    await section(page).getByText('De carro', { exact: true }).click()
    await search(page, '20031-050')

    await expectStopsToMatch(page, api)
  })

  test('tapping a stop opens the exact stored coordinate', async ({ page, request }) => {
    await stubThirdParties(page)
    const api = await apiNearest(request, '24230100', 'pedestrian')
    await page.goto('/')
    await search(page, '24230100')
    await expect(stops(page)).toHaveCount(api.nearestChurchesInfo.length)

    const popupPromise = page.waitForEvent('popup')
    await tapThrough(page, stops(page).first().getByRole('heading', { level: 3 }))
    const popup = await popupPromise

    expect(popup.url()).toBe(buildGoogleMapsUrl(toChurchItem(api.nearestChurchesInfo[0])))
  })

  for (const cep of ['00000-000', '99999-999']) {
    test(`the inexistent CEP ${cep} asks the person to check it`, async ({ page }) => {
      await stubThirdParties(page)
      await page.goto('/')

      await search(page, cep)

      await expect(section(page).getByRole('alert')).toHaveText('Não encontramos esse CEP. Confira os números e tente de novo.')
      await expect(section(page).getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)
    })
  }

  test('a CEP far from every church on foot offers the car search, which also finds none', async ({ page }) => {
    const { leads, backendCalls } = await stubThirdParties(page)
    await page.goto('/')

    await search(page, '01310-100')

    const alert = section(page).getByRole('alert')
    await expect(alert).toHaveText(/^Nenhuma igreja a até 10 km a pé desse CEP\./)
    await expect(section(page).getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)

    await section(page).getByRole('button', { name: 'Ver igrejas de carro' }).click()

    await expect(section(page).getByRole('radio', { name: 'De carro' })).toBeChecked()
    await expect(alert).toHaveText('Ainda não temos igrejas cadastradas perto desse CEP.')

    // Both searches reach the team, each saying nothing was found, with one backend call apiece.
    await expect.poll(() => leads.length).toBe(2)
    expect(leads.map((lead) => [lead.como_vai, lead.igreja_mais_proxima])).toEqual([
      ['a pé', 'nenhuma encontrada'],
      ['de carro', 'nenhuma encontrada'],
    ])
    expect(backendCalls).toHaveLength(2)
  })

  test('a CEP far from every church by car says none is registered nearby', async ({ page }) => {
    await stubThirdParties(page)
    await page.goto('/')

    await section(page).getByText('De carro', { exact: true }).click()
    await search(page, '01310-100')

    await expect(section(page).getByRole('alert')).toHaveText('Ainda não temos igrejas cadastradas perto desse CEP.')
    await expect(section(page).getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)
  })

  test('the email produces a lead naming the real nearest church', async ({ page, request }) => {
    const { leads, backendCalls } = await stubThirdParties(page)
    const api = await apiNearest(request, '24020085', 'pedestrian')
    await page.goto('/')

    await search(page, '24020085', 'teste.e2e@example.com')

    await expect(stops(page).first()).toBeVisible()
    await expect.poll(() => leads.length).toBe(1)
    expect(leads[0]).toMatchObject({
      email: 'teste.e2e@example.com',
      cep: '24020-085',
      como_vai: 'a pé',
      igreja_mais_proxima: api.nearestChurchesInfo[0].name,
    })
    expect(backendCalls).toHaveLength(1)
  })

  test('a search by car is reported with the email and the real nearest church by car', async ({ page, request }) => {
    const { leads, backendCalls } = await stubThirdParties(page)
    const api = await apiNearest(request, '24230100', 'transport')
    await page.goto('/')

    await section(page).getByText('De carro', { exact: true }).click()
    await search(page, '24230100')

    await expect(stops(page).first()).toBeVisible()
    await expect.poll(() => leads.length).toBe(1)
    expect(leads[0]).toMatchObject({ email: 'teste.e2e@example.com', cep: '24230-100', como_vai: 'de carro', igreja_mais_proxima: api.nearestChurchesInfo[0].name })
    expect(backendCalls).toHaveLength(1)
  })

  test('a saved real result survives a reload with the backend unreachable', async ({ page }) => {
    await stubThirdParties(page)
    await page.goto('/')
    await search(page, '24020085')
    await expect(stops(page).first()).toBeVisible()
    const names = await stops(page).getByRole('heading', { level: 3 }).allTextContents()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('evangelismo-digital-query-cache') ?? ''))
      .toContain(names[0])

    await page.route(`${REAL_API_URL}/**`, (route) => route.abort('connectionrefused'))
    await page.reload()
    await search(page, '24020-085')

    await expect(stops(page).getByRole('heading', { level: 3 })).toHaveText(names)
    await expect(section(page).getByRole('alert')).toHaveCount(0)
  })

  test('real results have no WCAG A/AA violations and no horizontal overflow', async ({ page }) => {
    await stubThirdParties(page)
    await page.goto('/')
    await search(page, '24020085')
    await expect(stops(page).first()).toBeVisible()

    await section(page).evaluate((el) => el.setAttribute('data-axe-scope', 'find-nearest-church'))
    const axe = await new AxeBuilder({ page })
      .include('[data-axe-scope="find-nearest-church"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})
