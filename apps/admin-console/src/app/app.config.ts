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
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { branchInterceptor } from '@4guard/shared-core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { adminRoutes } from './app.routes';
import { WAREHOUSE_LAYOUT_REPOSITORY } from './features/inventory/ports/warehouse-layout.repository.port';
import { WarehouseLayoutHttpAdapter } from './features/inventory/services/warehouse-layout-http.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    // ── Router ──────────────────────────────────────────────────────────────
    provideRouter(
      adminRoutes,
      withComponentInputBinding(),
      withRouterConfig({
        onSameUrlNavigation: 'reload',
      }),
      withViewTransitions({
        onViewTransitionCreated: (info) => {
          info.transition.finished.catch(() => {
            // Absorbe la cancelación limpia de la transición sin lanzar error no capturado en consola
          });
        },
      }),
    ),

    // ── HTTP Client con interceptores ────────────────────────────────────────
    // Orden: Auth primero, luego Branch
    provideHttpClient(
      withInterceptors([authInterceptor, branchInterceptor]),
    ),

    // ── Repositorio Warehouse Layout (SDOP Bridge) ───────────────────────────
    {
      provide: WAREHOUSE_LAYOUT_REPOSITORY,
      useClass: WarehouseLayoutHttpAdapter,
    },

    // ── Animaciones ───────────────────────────────────────────────────────────
    provideAnimationsAsync(),
  ],
};
