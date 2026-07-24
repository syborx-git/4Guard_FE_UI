import { Routes } from '@angular/router';

export const organizationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./organization-management.component').then(
        (m) => m.OrganizationManagementComponent
      ),
    title: '4GUARD WMS — Gestión de Organizaciones',
  },
];
