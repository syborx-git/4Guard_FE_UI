/**
 * @file performance.routes.ts
 * @description Rutas de la feature Monitoreo de Rendimiento (HU-138) — 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const performanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./kpi-management/kpi-management.component').then(
        (m) => m.KpiManagementComponent
      ),
    title: '4GUARD WMS — Monitoreo de Rendimiento',
  },
];
