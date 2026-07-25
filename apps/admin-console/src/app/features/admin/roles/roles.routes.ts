import { Routes } from '@angular/router';

export const rolesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./role-management/role-management.component').then(
        (m) => m.RoleManagementComponent
      ),
  },
];
