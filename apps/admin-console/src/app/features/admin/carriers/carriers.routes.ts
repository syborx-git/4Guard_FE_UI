/**
 * @file carriers.routes.ts
 * @description Rutas de la feature Gestión de Transportistas (HU-128) — 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const carriersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./carrier-management/carrier-management.component').then(
        (m) => m.CarrierManagementComponent
      ),
    title: '4GUARD WMS — Gestión de Transportistas',
  },
];
