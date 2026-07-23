/**
 * @file app.routes.ts
 * @description Rutas raíz de admin-console con lazy loading por feature.
 * Guards de RBAC aplicados a nivel de ruta.
 */

import { Routes } from '@angular/router';
import { authGuard }         from './core/guards/auth.guard';
import { rbacGuard }         from './core/guards/rbac.guard';
import { changePasswordGuard } from './core/guards/change-password.guard';
import { UserRole }           from '@4guard/shared-core';

export const adminRoutes: Routes = [
  // Ruta pública: Login
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: '4GUARD WMS — Iniciar Sesión',
  },

  // Cambio de contraseña obligatorio — fuera del shell (sin navbar)
  // Requiere sesión activa + changePasswordRequired === true
  {
    path: 'change-password',
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component')
        .then((m) => m.ChangePasswordComponent),
    canActivate: [changePasswordGuard],
    title: '4GUARD WMS — Cambiar Contraseña',
  },

  // Rutas protegidas bajo el shell principal
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      // Perfil de Usuario (Vista Bento Box)
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/user-profile-bento.component').then((m) => m.UserProfileBentoComponent),
        title: '4GUARD WMS — Mi Perfil',
      },

      // Dashboard: Acceso a todos los roles autenticados
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
        title: '4GUARD WMS — Dashboard',
      },

      // Inventario
      {
        path: 'inventory',
        canActivate: [rbacGuard],
        data: { module: 'inventory' },
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.inventoryRoutes),
        title: '4GUARD WMS — Inventario',
      },

      // Layout y Ubicaciones (HU-127)
      {
        path: 'layout',
        canActivate: [rbacGuard],
        data: { module: 'layout' },
        loadChildren: () =>
          import('./features/layout/layout.routes').then((m) => m.layoutRoutes),
        title: '4GUARD WMS — Gestión de Layout',
      },

      // Recepción
      {
        path: 'receiving',
        canActivate: [rbacGuard],
        data: { module: 'receiving' },
        loadChildren: () =>
          import('./features/receiving/receiving.routes').then((m) => m.receivingRoutes),
        title: '4GUARD WMS — Recepción',
      },

      // Control de Calidad
      {
        path: 'quality',
        canActivate: [rbacGuard],
        data: { module: 'quality' },
        loadChildren: () =>
          import('./features/quality/quality.routes').then((m) => m.qualityRoutes),
        title: '4GUARD WMS — Control de Calidad',
      },

      // Despacho
      {
        path: 'shipping',
        canActivate: [rbacGuard],
        data: { module: 'shipping' },
        loadChildren: () =>
          import('./features/shipping/shipping.routes').then((m) => m.shippingRoutes),
        title: '4GUARD WMS — Despacho',
      },

      // Gestión de Transportistas (HU-128)
      {
        path: 'carriers',
        canActivate: [rbacGuard],
        data: { module: 'carriers' },
        loadChildren: () =>
          import('./features/admin/carriers/carriers.routes').then((m) => m.carriersRoutes),
        title: '4GUARD WMS — Gestión de Transportistas',
      },

      // Secciones de Almacén
      {
        path: 'sections',
        canActivate: [rbacGuard],
        data: { module: 'sections' },
        loadChildren: () =>
          import('./features/admin/sections/sections.routes').then((m) => m.sectionsRoutes),
        title: '4GUARD WMS — Secciones de Almacén',
      },

      // Gestión de Proveedores (HU-125)
      {
        path: 'suppliers',
        canActivate: [rbacGuard],
        data: { module: 'suppliers' },
        loadChildren: () =>
          import('./features/admin/suppliers/supplier.routes').then((m) => m.supplierRoutes),
        title: '4GUARD WMS — Catálogo de Proveedores',
      },

      // Monitoreo de Rendimiento (HU-138)
      {
        path: 'performance',
        canActivate: [rbacGuard],
        data: { module: 'performance' },
        loadChildren: () =>
          import('./features/performance/performance.routes').then((m) => m.performanceRoutes),
        title: '4GUARD WMS — Monitoreo de Rendimiento',
      },

      // Administración
      {
        path: 'admin',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.adminRoutes),
        title: '4GUARD WMS — Administración',
      },

      // Sesiones Activas (HU-011)
      {
        path: 'sessions',
        loadComponent: () =>
          import('./features/admin/sessions/active-sessions-monitor.component').then((m) => m.ActiveSessionsMonitorComponent),
        title: '4GUARD WMS — Sesiones Activas',
      },

      // Redirección por defecto
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Catch-all: redirigir a dashboard o login
  { path: '**', redirectTo: 'dashboard' },
];
