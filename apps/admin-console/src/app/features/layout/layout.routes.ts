import { Routes } from '@angular/router';

export const layoutRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout-management/layout-management.component').then(
        (m) => m.LayoutManagementComponent
      ),
    title: '4GUARD WMS — Gestión de Layout y Ubicaciones',
  },
];
