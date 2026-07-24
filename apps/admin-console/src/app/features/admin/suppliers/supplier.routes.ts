/**
 * @file supplier.routes.ts
 * @description Rutas de la feature Gestión de Proveedores (HU-125) — 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const supplierRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./supplier-management/supplier-management.component').then(
        (m) => m.SupplierManagementComponent
      ),
    title: '4GUARD WMS — Catálogo de Proveedores',
  },
];
