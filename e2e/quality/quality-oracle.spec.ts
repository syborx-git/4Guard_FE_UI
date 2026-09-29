import { test, expect } from '@playwright/test';

// Credenciales estándar de verificación SDOP
const TEST_USER = {
  email: 'enrique@4guard.com',
  password: 'admin123',
};

test.describe('Oráculo de Pruebas E2E — Control de Calidad (QM) 4GUARD WMS', () => {

  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        if (!text.includes('favicon') && !text.includes('ngrok')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  // Helper para autenticar sesión
  async function performLogin(page: any) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('#login-submit-btn');

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);
    await submitBtn.click();

    // Esperar navegación fuera del login
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 15000 });
  }

  test('[ORACLE-QM-01] Autenticación y Navegación a Módulo de Calidad (/quality/blocks)', async ({ page }) => {
    // 1. Iniciar sesión
    await performLogin(page);

    // 2. Navegar a /quality/blocks
    await page.goto('/quality/blocks');
    await page.waitForLoadState('networkidle');

    // 3. Validar elementos clave de la interfaz
    const headerTitle = page.locator('.quality-header__title');
    await expect(headerTitle).toBeVisible();
    await expect(headerTitle).toHaveText('Control de Calidad');

    // Validar tarjetas de KPIs superiores
    const kpiCards = page.locator('.quality-kpi-card');
    await expect(kpiCards).toHaveCount(4);

    // Validar barra unificada de búsqueda y botón de registro
    const searchInput = page.locator('#blocks-search');
    await expect(searchInput).toBeVisible();

    const newReportBtn = page.locator('.btn-new-quality-report');
    await expect(newReportBtn).toBeVisible();

    // Validar tabla de bloqueos activos
    const blocksTable = page.locator('.minimal-table');
    await expect(blocksTable).toBeVisible();

    // 4. Comparación visual (Visual Regression)
    await expect(page).toHaveScreenshot('01-quality-blocks-dashboard.png', {
      maxDiffPixelRatio: 0.01,
    });

    // 5. Validar ausencia de errores en consola
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('[ORACLE-QM-02] Submódulo de Liberaciones y 3 Destinos Finales (/quality/releases)', async ({ page }) => {
    await performLogin(page);
    await page.goto('/quality/releases');
    await page.waitForLoadState('networkidle');

    // Validar selector de pestañas (Liberaciones Emitidas vs Por Dictaminar)
    const viewTabs = page.locator('.view-tabs .view-tab-btn');
    await expect(viewTabs).toHaveCount(2);

    // Validar las 3 tarjetas de destino final (Distribución, Destrucción, Devolución)
    const destDistribution = page.locator('.dest-card--distribution');
    const destDestruction = page.locator('.dest-card--destruction');
    const destReturn = page.locator('.dest-card--return');

    await expect(destDistribution).toBeVisible();
    await expect(destDestruction).toBeVisible();
    await expect(destReturn).toBeVisible();

    // Comparación visual
    await expect(page).toHaveScreenshot('02-quality-releases-view.png', {
      maxDiffPixelRatio: 0.01,
    });

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('[ORACLE-QM-03] Submódulo de Verificación de Carga F01-PO-GC-8.6-03 (/quality/load-verifications)', async ({ page }) => {
    await performLogin(page);
    await page.goto('/quality/load-verifications');
    await page.waitForLoadState('networkidle');

    // Validar contenedor y directorio de verificaciones de carga
    const pageContainer = page.locator('.load-verif-page');
    await expect(pageContainer).toBeVisible();

    const verifDirectory = page.locator('.verif-directory');
    await expect(verifDirectory).toBeVisible();

    // Comparación visual
    await expect(page).toHaveScreenshot('03-quality-load-verifications.png', {
      maxDiffPixelRatio: 0.01,
    });

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('[ORACLE-QM-04] Submódulo de KPIs y Reclamos F01 con Impacto Financiero (/quality/claims)', async ({ page }) => {
    await performLogin(page);
    await page.goto('/quality/claims');
    await page.waitForLoadState('networkidle');

    // Validar las 4 tarjetas de KPIs financieros
    const claimsKpiCards = page.locator('.claims-kpi-card');
    await expect(claimsKpiCards).toHaveCount(4);

    // Comparación visual
    await expect(page).toHaveScreenshot('04-quality-claims-dashboard.png', {
      maxDiffPixelRatio: 0.01,
    });

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('[ORACLE-QM-05] Validación Integral de Endpoints REST en Spring Boot + PostgreSQL', async ({ request }) => {
    // 1. Obtener token de autenticación directamente del backend
    const loginRes = await request.post('http://localhost:8080/api/v1/auth/login', {
      data: {
        identifier: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);

    const token = loginData.data.accessToken;
    expect(token).toBeDefined();

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. Probar GET /api/v1/quality/dashboard/kpis
    const kpisRes = await request.get('http://localhost:8080/api/v1/quality/dashboard/kpis', {
      headers: authHeaders,
    });
    expect(kpisRes.ok()).toBeTruthy();
    const kpisData = await kpisRes.json();
    expect(kpisData.success).toBe(true);
    expect(kpisData.data).toHaveProperty('totalActiveBlocks');
    expect(kpisData.data).toHaveProperty('totalReleases');
    expect(kpisData.data).toHaveProperty('totalVerifications');
    expect(kpisData.data).toHaveProperty('totalClaims');

    // 3. Probar GET /api/v1/quality/blocks
    const blocksRes = await request.get('http://localhost:8080/api/v1/quality/blocks', {
      headers: authHeaders,
    });
    expect(blocksRes.ok()).toBeTruthy();
    const blocksData = await blocksRes.json();
    expect(blocksData.success).toBe(true);
    expect(Array.isArray(blocksData.data)).toBe(true);

    // 4. Probar GET /api/v1/quality/releases
    const releasesRes = await request.get('http://localhost:8080/api/v1/quality/releases', {
      headers: authHeaders,
    });
    expect(releasesRes.ok()).toBeTruthy();
    const releasesData = await releasesRes.json();
    expect(releasesData.success).toBe(true);
    expect(Array.isArray(releasesData.data)).toBe(true);

    // 5. Probar GET /api/v1/quality/load-verifications
    const verifRes = await request.get('http://localhost:8080/api/v1/quality/load-verifications', {
      headers: authHeaders,
    });
    expect(verifRes.ok()).toBeTruthy();
    const verifData = await verifRes.json();
    expect(verifData.success).toBe(true);
    expect(Array.isArray(verifData.data)).toBe(true);

    // 6. Probar GET /api/v1/quality/claims
    const claimsRes = await request.get('http://localhost:8080/api/v1/quality/claims', {
      headers: authHeaders,
    });
    expect(claimsRes.ok()).toBeTruthy();
    const claimsData = await claimsRes.json();
    expect(claimsData.success).toBe(true);
    expect(Array.isArray(claimsData.data)).toBe(true);

    // 7. Probar GET /api/v1/quality/catalogs/block-reasons
    const reasonsRes = await request.get('http://localhost:8080/api/v1/quality/catalogs/block-reasons', {
      headers: authHeaders,
    });
    expect(reasonsRes.ok()).toBeTruthy();
    const reasonsData = await reasonsRes.json();
    expect(reasonsData.success).toBe(true);
    expect(Array.isArray(reasonsData.data)).toBe(true);
  });
});
