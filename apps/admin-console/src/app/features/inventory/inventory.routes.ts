import { Routes } from '@angular/router';

export const inventoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./inventory-list/inventory-list.component').then((m) => m.InventoryListComponent),
    title: '4GUARD WMS — Lista de Inventario',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./inventory-detail/inventory-detail.component').then((m) => m.InventoryDetailComponent),
    title: '4GUARD WMS — Detalle de Ítem',
  },
];
