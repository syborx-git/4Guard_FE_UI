/**
 * @file app.config.ts
 * @description Configuración de la aplicación admin-console (Angular 17 standalone).
 *
 * Registra:
 * - Proveedores HTTP con interceptores (JWT + Branch)
 * - Router con lazy loading
 * - Animaciones del navegador
 */

import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { branchInterceptor, mockBackendInterceptor } from '@4guard/shared-core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { adminRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // ── Router ──────────────────────────────────────────────────────────────
    provideRouter(
      adminRoutes,
      withComponentInputBinding(),
      withViewTransitions({
        onViewTransitionCreated: (info) => {
          info.transition.finished.catch(() => {
            // Absorbe la cancelación limpia de la transición sin lanzar error no capturado en consola
          });
        },
      }),
    ),

    // ── HTTP Client con interceptores ────────────────────────────────────────
    // Orden importante: Auth primero, luego Branch, luego Mock Backend
    provideHttpClient(
      withInterceptors([authInterceptor, branchInterceptor, mockBackendInterceptor]),
    ),

    // ── Animaciones ───────────────────────────────────────────────────────────
    provideAnimationsAsync(),
  ],
};
