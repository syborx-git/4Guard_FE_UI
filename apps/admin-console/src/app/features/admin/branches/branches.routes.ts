import { Routes } from '@angular/router';

export const branchesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./branch-management/branch-management.component').then(
        (m) => m.BranchManagementComponent
      ),
    title: '4GUARD WMS — Gestión de Sucursales',
  },
];
