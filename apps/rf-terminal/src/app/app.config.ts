/**
 * @file app.config.ts
 * @description Configuración de la aplicación rf-terminal (Angular 17 PWA standalone).
 *
 * Diferencias clave vs admin-console:
 * - Service Worker registrado para soporte offline
 * - Router más simple (operaciones por función, no por módulo completo)
 */

import { ApplicationConfig }      from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors }      from '@angular/common/http';
import { provideAnimationsAsync }                   from '@angular/platform-browser/animations/async';
import { isDevMode }                                from '@angular/core';
import { provideServiceWorker }                     from '@angular/service-worker';

import { jwtInterceptor, branchInterceptor } from '@4guard/shared-core';
import { rfRoutes }                          from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // ── Router ──────────────────────────────────────────────────────────────
    provideRouter(rfRoutes, withComponentInputBinding()),

    // ── HTTP Client con interceptores ────────────────────────────────────────
    provideHttpClient(
      withInterceptors([jwtInterceptor, branchInterceptor]),
    ),

    // ── Animaciones ───────────────────────────────────────────────────────────
    provideAnimationsAsync(),

    // ── Service Worker (PWA Offline-First) ────────────────────────────────────
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
