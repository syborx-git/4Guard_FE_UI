/**
 * @file license-management.routes.ts
 * @description Rutas lazy-loaded para HU-139 — Gestión de Licencias del WMS.
 */

import { Routes } from '@angular/router';

export const licenseManagementRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./license-management/license-management.component').then(
        (m) => m.LicenseManagementComponent
      ),
    title: '4GUARD WMS — Licencias y Capacidades del WMS',
  },
];
