/**
 * @file environment.prod.ts
 * @description Variables de entorno PRODUCCIÓN / HETZNER / DOCKER.
 * Las peticiones API son relativas (apiBaseUrl='') para que Nginx en el puerto 8082
 * las enrute internamente al contenedor del backend (http://4guard-backend:8080/api/v1/).
 */

export const environment = {
  production: true,
  envName: 'production',
  apiBaseUrl: '',
  appVersion: '1.0.0-prod',
};

