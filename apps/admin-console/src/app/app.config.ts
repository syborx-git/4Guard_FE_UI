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

import { branchInterceptor, LICENSE_REPOSITORY } from '@4guard/shared-core';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';
import { LicenseManagementService } from './features/license-management/license-management.service';
import { MockLicenseRepositoryAdapter } from './features/license-management/adapters/mock-license-repository.adapter';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { adminRoutes } from './app.routes';

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

    // ── Animaciones ───────────────────────────────────────────────────────────
    provideAnimationsAsync(),

    // ── SDOP Repositorios (Bridge Pattern) ────────────────────────────────────
    {
      provide: LICENSE_REPOSITORY,
      useFactory: () => {
        return environment.dataSource === 'MOCK' || environment.featureFlags?.useMockData
          ? inject(MockLicenseRepositoryAdapter)
          : inject(LicenseManagementService);
      },
    },
  ],
};
