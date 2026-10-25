import { expect, test, type Locator, type Page } from '@playwright/test'

const openMenu = async (page: Page) => {
  const toggler = page.getByRole('button', { name: 'Toggle navigation' })
  if (await toggler.isVisible()) {
    await toggler.click()
    // Bootstrap ignores toggles while it animates, so wait until the menu is fully open, as a person would.
    await expect(page.locator('#navbarNav')).toHaveClass(/(^|\s)show(\s|$)/)
  }
}

/** On small screens the menu folds back after a choice, so it no longer covers the section. */
const expectMenuFolded = async (page: Page) => {
  if (await page.getByRole('button', { name: 'Toggle navigation' }).isVisible()) {
    await expect(page.locator('#navbarNav')).not.toHaveClass(/(^|\s)(show|collapsing)(\s|$)/)
    await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false')
  }
}

/** The heading sits in view, below the fixed navbar rather than hidden under it. */
const expectBelowNavbar = async (page: Page, heading: Locator) => {
  await expect(heading).toBeInViewport()
  await expect.poll(async () => {
    const navBottom = await page.locator('nav').evaluate((nav) => nav.getBoundingClientRect().bottom)
    const headingTop = await heading.evaluate((h) => h.getBoundingClientRect().top)
    return headingTop >= navBottom - 1 && headingTop < 300
  }).toBe(true)
}

test.describe('Navbar sections', () => {
  test('"Recursos" scrolls to the resources section and marks itself current', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)

    await page.getByRole('navigation').getByRole('link', { name: 'Recursos' }).click()

    await expect(page).toHaveURL(/\?section=recursos$/)
    await expectMenuFolded(page)
    await expectBelowNavbar(page, page.locator('#mais-recursos-title'))
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Recursos', includeHidden: true })).toHaveAttribute('aria-current', 'page')
  })

  test('"Encontre uma igreja" scrolls to the church search, below the fixed menu', async ({ page }, testInfo) => {
    await page.goto('/')
    await openMenu(page)

    await page.getByRole('navigation').getByRole('link', { name: 'Encontre uma igreja' }).click()

    await expect(page).toHaveURL(/\?section=encontre-uma-igreja$/)
    await expectMenuFolded(page)
    await expectBelowNavbar(page, page.getByRole('heading', { level: 1, name: 'Encontre uma igreja perto de você' }))
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Encontre uma igreja', includeHidden: true })).toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: testInfo.outputPath('navbar-encontre-uma-igreja.png') })
  })

  test('opening /?section=encontre-uma-igreja directly lands on the church search', async ({ page }) => {
    await page.goto('/?section=encontre-uma-igreja')

    await expectBelowNavbar(page, page.getByRole('heading', { level: 1, name: 'Encontre uma igreja perto de você' }))
  })
})
