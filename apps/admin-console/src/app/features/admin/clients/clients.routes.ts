import { Routes } from '@angular/router';

export const clientsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./client-management/client-management.component').then(
        (m) => m.ClientManagementComponent
      ),
  },
];
