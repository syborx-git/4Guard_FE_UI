/**
 * @file inventory-query.routes.ts
 * @description Rutas lazy-loaded del módulo de Consulta de Inventarios en 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const INVENTORY_QUERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/inventory-query-shell/inventory-query-shell.component').then(
        (m) => m.InventoryQueryShellComponent
      ),
    title: '4GUARD WMS — Consulta de Inventarios y Exportación Excel'
  }
];
