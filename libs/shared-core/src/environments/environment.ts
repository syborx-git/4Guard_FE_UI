/**
 * @file environment.ts
 * @description Variables de entorno para desarrollo.
 * Reemplazar apiBaseUrl con la URL del backend en producción.
 */

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  appVersion: '1.0.0-dev',
};
