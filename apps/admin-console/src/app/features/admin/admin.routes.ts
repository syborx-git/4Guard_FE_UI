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
  {
    path: 'carriers',
    loadChildren: () =>
      import('./carriers/carriers.routes').then((m) => m.carriersRoutes),
    title: '4GUARD WMS — Gestión de Transportistas',
  },
  {
    path: 'sections',
    loadChildren: () =>
      import('./sections/sections.routes').then((m) => m.sectionsRoutes),
    title: '4GUARD WMS — Secciones de Almacén',
  },
  {
    path: 'suppliers',
    loadChildren: () =>
      import('./suppliers/supplier.routes').then((m) => m.supplierRoutes),
    title: '4GUARD WMS — Catálogo de Proveedores',
  },
  {
    path: 'sessions',
    loadComponent: () =>
      import('./sessions/active-sessions-monitor.component').then((m) => m.ActiveSessionsMonitorComponent),
    title: '4GUARD WMS — Sesiones Activas',
  },
  {
    path: 'organizations',
    loadChildren: () =>
      import('./organizations/organization.routes').then((m) => m.organizationRoutes),
    title: '4GUARD WMS — Gestión de Organizaciones',
  },
];

