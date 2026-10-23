import { test, expect, Page } from '@playwright/test';

// Credenciales estándar de verificación SDOP
const TEST_USER = {
  email: 'enrique@4guard.com',
  password: 'admin123',
};

async function performLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#login-submit-btn').click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Oráculo de Pruebas E2E — Recepción de Mercancía (Turno / Filtro por defecto)', () => {
  test('[ORACLE-RCV-01] Recepción abre por defecto con el filtro "En Caseta" activo', async ({ page }) => {
    await performLogin(page);

    await page.goto('/warehouse-movements/receiving');
    await page.waitForLoadState('domcontentloaded');

    const filterPills = page.locator('.directory-filter-pills');
    await expect(filterPills).toBeVisible();

    const enCasetaPill = filterPills.getByRole('button', { name: 'En Caseta' });
    const todosPill = filterPills.getByRole('button', { name: /^Todos/ });

    await expect(enCasetaPill).toBeVisible();
    await expect(enCasetaPill).toHaveClass(/filter-pill--active/);
    await expect(todosPill).not.toHaveClass(/filter-pill--active/);
  });

  test('[ORACLE-RCV-02] El usuario puede navegar del filtro por defecto a "Todos" y regresar a "En Caseta"', async ({ page }) => {
    await performLogin(page);

    await page.goto('/warehouse-movements/receiving');
    await page.waitForLoadState('domcontentloaded');

    const filterPills = page.locator('.directory-filter-pills');
    await expect(filterPills).toBeVisible();

    const enCasetaPill = filterPills.getByRole('button', { name: 'En Caseta' });
    const todosPill = filterPills.getByRole('button', { name: /^Todos/ });

    await todosPill.click();
    await expect(todosPill).toHaveClass(/filter-pill--active/);
    await expect(enCasetaPill).not.toHaveClass(/filter-pill--active/);

    await enCasetaPill.click();
    await expect(enCasetaPill).toHaveClass(/filter-pill--active/);
    await expect(todosPill).not.toHaveClass(/filter-pill--active/);
  });
});
