import { test, expect } from '@playwright/test';

/**
 * ORÁCULO DE ESPECIFICACIÓN SDOP: Autenticación y Control de Sesión
 * Espec: docs/sdd/user-management.sdd.md & docs/adr/ADR-004-rbac-guard.md
 *
 * Valida los criterios de aceptación inmutables:
 * 1. Formulario de autenticación visible con campos obligatorios.
 * 2. Bloqueo de botón de acceso si el formulario es inválido.
 * 3. Validación ante credenciales inválidas (mensaje de error y no mutación de sesión).
 * 4. Redirección y estado de sesión ante autenticación exitosa.
 */
test.describe('Oráculo SDOP — Autenticación y Sesión', () => {

  test.beforeEach(async ({ page }) => {
    // Navega a la ruta raíz o login
    await page.goto('/login');
  });

  test('ORACLE-AUTH-01: Debe renderizar los elementos requeridos de la vista de login', async ({ page }) => {
    // 1. Título y Formulario presentes
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // 2. Botón de acceso deshabilitado inicialmente (formulario vacío)
    const submitBtn = page.locator('#login-submit-btn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('ORACLE-AUTH-02: Debe rechazar credenciales inválidas sin almacenar tokens', async ({ page }) => {
    // Ingresa credenciales erróneas
    await page.fill('#email', 'invalido@4guard.com');
    await page.fill('#password', 'ClaveIncorrecta123!');

    const submitBtn = page.locator('#login-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Valida que permanezca en /login o muestre mensaje de error
    const errorAlert = page.locator('.login-error, [role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Valida que no exista token válido almacenado
    const token = await page.evaluate(() => localStorage.getItem('4g_token'));
    expect(token).toBeNull();
  });

  test('ORACLE-AUTH-03: Debe autenticar y redirigir con credenciales válidas', async ({ page }) => {
    // Simula o ejecuta login con credenciales estándar
    await page.fill('#email', 'enrique@4guard.com');
    await page.fill('#password', 'admin123');

    const submitBtn = page.locator('#login-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Espera redirección a dashboard o panel administrativo
    await expect(page).toHaveURL(/.*(dashboard|admin)/, { timeout: 15000 });

    // Valida presencia del token de acceso en localStorage
    const token = await page.evaluate(() => localStorage.getItem('4g_token'));
    expect(token).toBeTruthy();
  });

});
