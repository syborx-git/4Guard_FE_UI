/**
 * @file environment.develop.ts
 * @description Variables de entorno DEVELOP (servidor de desarrollo en Render).
 * Apunta al backend desplegado en: https://fourguard-be.onrender.com
 * Se usa con: npm run start:admin:dev
 */

export const environment = {
  production: false,
  envName: 'develop',
  apiBaseUrl: 'https://fourguard-be.onrender.com',
  appVersion: '1.0.0-develop',
};
