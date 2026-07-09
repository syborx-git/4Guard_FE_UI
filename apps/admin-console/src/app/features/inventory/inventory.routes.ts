import { Routes } from '@angular/router';

export const inventoryRoutes: Routes = [
  {
    path: '',
    redirectTo: 'map',
    pathMatch: 'full',
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./warehouse-map/warehouse-map.component').then(
        (m) => m.WarehouseMapComponent
      ),
    title: '4GUARD WMS — Mapa 2D del Almacén',
  },
];
