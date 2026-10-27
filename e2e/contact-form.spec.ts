import { expect, test, type Page } from '@playwright/test';

const expectNoHorizontalOverflow = async (page: Page) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
};

test.describe('Contact Form Component & Section', () => {
  test('renders the enhanced contact form with proper layout, icons, and inputs', async ({ page }, testInfo) => {
    await page.goto('/');

    const section = page.locator('#contatosRef');
    await section.scrollIntoViewIfNeeded();

    await expect(section.getByRole('heading', { name: 'Gostaria de entrar em contato conosco?' })).toBeVisible();

    const nameInput = section.getByLabel(/Nome:/);
    const lastNameInput = section.getByLabel(/Sobrenome:/);
    const emailInput = section.getByLabel(/Email:/);
    const phoneInput = section.getByLabel(/Telefone \(opcional\):/);
    const checkbox = section.getByRole('checkbox');
    const submitButton = section.getByRole('button', { name: /Enviar/ });

    await expect(nameInput).toBeVisible();
    await expect(lastNameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(checkbox).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Verify phone mask interaction
    await phoneInput.fill('21987654321');
    await expect(phoneInput).toHaveValue('(21) 98765-4321');

    // Verify touch target / minimum height for inputs
    const phoneBox = await phoneInput.boundingBox();
    expect(phoneBox).not.toBeNull();
    expect(phoneBox!.height).toBeGreaterThanOrEqual(44);

    const buttonBox = await submitButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

    await expectNoHorizontalOverflow(page);

    await section.screenshot({ path: testInfo.outputPath('contact-form-section.png') });
  });

  test('renders the contact form properly on the article page', async ({ page }, testInfo) => {
    await page.goto('/artigo/deusExiste');

    const formSection = page.locator('section[aria-labelledby="form-contato-article-heading"]');
    await formSection.scrollIntoViewIfNeeded();

    await expect(formSection.getByRole('heading', { name: 'Quer saber mais? Entre em contato hoje!' })).toBeVisible();
    await expect(formSection.getByLabel(/Telefone \(opcional\):/)).toBeVisible();

    await expectNoHorizontalOverflow(page);

    await formSection.screenshot({ path: testInfo.outputPath('contact-form-article-section.png') });
  });
});
