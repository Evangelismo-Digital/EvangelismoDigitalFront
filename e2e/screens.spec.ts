import { expect, test, type Page } from '@playwright/test'

const expectNoHorizontalOverflow = async (page: Page) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test.describe('Home', () => {
  test('renders the article list without horizontal overflow', async ({ page }, testInfo) => {
    await page.goto('/')

    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Artigos' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Deus existe?' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
  })

  test('opens an article from its card', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('heading', { level: 2, name: 'Deus existe?' }).click()

    await expect(page).toHaveURL(/\/artigo\/deusExiste$/)
  })
})

test.describe('Article', () => {
  test('renders a known article without horizontal overflow', async ({ page }, testInfo) => {
    await page.goto('/artigo/deusExiste')

    await expect(page.getByText('Página não encontrada')).toHaveCount(0)
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.screenshot({ path: testInfo.outputPath('artigo.png'), fullPage: true })
  })

  test('shows the not-found state for an unknown slug', async ({ page }) => {
    await page.goto('/artigo/inexistente')

    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
