/**
 * @file warehouse-movements.routes.ts
 * @description Rutas lazy-loaded del módulo Movimientos de Almacén.
 * Redirección directa al submódulo de Recepción (sin páginas intermedias obligatorias).
 */

import { Routes } from '@angular/router';

export const WAREHOUSE_MOVEMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/warehouse-movements-shell/warehouse-movements-shell.component').then(
        (m) => m.WarehouseMovementsShellComponent
      ),
    children: [
      { path: '', redirectTo: 'receiving', pathMatch: 'full' },
      {
        path: 'receiving',
        loadComponent: () =>
          import('./pages/receiving-submodule/receiving-submodule.component').then(
            (m) => m.ReceivingSubmoduleComponent
          ),
        title: '4GUARD WMS — Recepción de Mercancía',
      },
      {
        path: 'transfers',
        loadComponent: () =>
          import('./pages/transfer-submodule/transfer-submodule.component').then(
            (m) => m.TransferSubmoduleComponent
          ),
        title: '4GUARD WMS — Cambio de Almacén',
      },
      {
        path: 'outbound',
        loadComponent: () =>
          import('./pages/outbound-submodule/outbound-submodule.component').then(
            (m) => m.OutboundSubmoduleComponent
          ),
        title: '4GUARD WMS — Salidas de Almacén',
      },
    ],
  },
];
