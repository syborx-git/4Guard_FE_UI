/**
 * @file environment.prod.ts
 * @description Variables de entorno PRODUCCIÓN / HETZNER / DOCKER.
 * Las peticiones API son relativas (apiBaseUrl='') para que Nginx en el puerto 8081
 * las enrute internamente al contenedor del backend (http://4guard-backend:8080/api/v1/).
 */

export const environment = {
  production: true,
  envName: 'production',
  apiBaseUrl: '',
  publicAppUrl: '',
  defaultBranchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
  appVersion: '1.0.0-prod',
  useMockData: false,
};

