import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-panel/admin-panel.component').then((m) => m.AdminPanelComponent),
    title: '4GUARD WMS — Administración',
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./users/users-list.component').then((m) => m.UsersListComponent),
    title: '4GUARD WMS — Gestión de Usuarios',
  },
];
