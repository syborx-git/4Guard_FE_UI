/**
 * @file environment.develop.ts
 * @description Variables de entorno DEVELOP (servidor de desarrollo en Render).
 * Apunta al backend desplegado en: https://fourguard-be.onrender.com
 * Se usa con: npm run start:admin:dev
 */

export const environment = {
  production: false,
  envName: 'develop',
  apiBaseUrl: 'https://fourguard-be-huzh.onrender.com',
  publicAppUrl: 'https://faster-treadmill-oppose.ngrok-free.dev',
  defaultBranchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
  appVersion: '1.0.0-develop',
};
