/**
 * @file catalogs.routes.ts
 * @description Rutas lazy-loaded del módulo de Catálogos Maestros en 4GUARD WMS.
 * Redirección directa al catálogo de Usuarios (sin páginas intermedias obligatorias).
 */

import { Routes } from '@angular/router';

export const catalogsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/catalogs-shell/catalogs-shell.component').then(
        (m) => m.CatalogsShellComponent
      ),
    children: [
      { path: '', redirectTo: 'warehouse', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users-catalog/users-catalog.component').then(
            (m) => m.UsersCatalogComponent
          ),
        title: '4GUARD WMS — Catálogo de Usuarios',
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients-catalog/clients-catalog.component').then(
            (m) => m.ClientsCatalogComponent
          ),
        title: '4GUARD WMS — Catálogo de Clientes',
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/products-catalog/products-catalog.component').then(
            (m) => m.ProductsCatalogComponent
          ),
        title: '4GUARD WMS — Catálogo de Productos / SKUs',
      },
      {
        path: 'warehouse',
        loadComponent: () =>
          import('./pages/warehouse-catalog/warehouse-catalog.component').then(
            (m) => m.WarehouseCatalogComponent
          ),
        title: '4GUARD WMS — Catálogo de Almacén y Topología',
      },
    ],
  },
];
