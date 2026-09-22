/**
 * @file environment.ts
 * @description Variables de entorno LOCAL (desarrollo en máquina local).
 * Apunta al backend corriendo en localhost:8080.
 * Se usa con: npm run start:admin  (que ya tiene --configuration development por defecto)
 */

export const environment = {
  production: false,
  envName: 'local',
  apiBaseUrl: 'http://localhost:8080',
  publicAppUrl: 'https://faster-treadmill-oppose.ngrok-free.dev',
  defaultBranchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
  appVersion: '1.0.0-local',
};
