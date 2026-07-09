/**
 * @file environment.ts
 * @description Variables de entorno LOCAL (desarrollo en máquina local).
 * Apunta al backend corriendo en localhost:8080.
 * Se usa con: npm run start:rf  (que ya tiene --configuration development por defecto)
 */

export const environment = {
  production: false,
  envName: 'local',
  apiBaseUrl: 'http://localhost:8080',
  appVersion: '1.0.0-local',
};
