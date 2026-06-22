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

import { jwtInterceptor, branchInterceptor } from '@4guard/shared-core';
import { adminRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // ── Router ──────────────────────────────────────────────────────────────
    provideRouter(
      adminRoutes,
      withComponentInputBinding(),
      withViewTransitions(),
    ),

    // ── HTTP Client con interceptores ────────────────────────────────────────
    // Orden importante: JWT primero, luego Branch
    provideHttpClient(
      withInterceptors([jwtInterceptor, branchInterceptor]),
    ),

    // ── Animaciones ───────────────────────────────────────────────────────────
    provideAnimationsAsync(),
  ],
};
