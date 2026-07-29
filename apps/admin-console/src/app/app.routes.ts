/**
 * @file app.routes.ts
 * @description Rutas raíz de admin-console con lazy loading por feature.
 * Guards de RBAC aplicados a nivel de ruta.
 */

import { Routes } from '@angular/router';
import { authGuard }         from './core/guards/auth.guard';
import { rbacGuard }         from './core/guards/rbac.guard';
import { changePasswordGuard } from './core/guards/change-password.guard';
import { lockoutGuard }      from './core/guards/lockout.guard';
import { UserRole }           from '@4guard/shared-core';

export const adminRoutes: Routes = [
  // Ruta pública: Login
  // lockoutGuard: intercepta ANTES del componente para evitar evasion del bloqueo por F5 (HU-010)
  {
    path: 'login',
    canActivate: [lockoutGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: '4GUARD WMS — Iniciar Sesión',
  },

  // Ruta pública: Recuperar contraseña (OTP)
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    title: '4GUARD WMS — Recuperar Contraseña',
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

      // Control de Usuarios y Seguridad (Homologado)
      {
        path: 'users',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadComponent: () =>
          import('./features/admin/users/users-list.component').then((m) => m.UsersListComponent),
        title: '4GUARD WMS — Control de Usuarios y Seguridad',
      },

      // Gestión de Organizaciones Multi-Tenancy (Homologado)
      {
        path: 'organizations',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/organizations/organization.routes').then((m) => m.organizationRoutes),
        title: '4GUARD WMS — Gestión de Organizaciones',
      },

      // Gestión de Sucursales (Homologado)
      {
        path: 'branches',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/branches/branches.routes').then((m) => m.branchesRoutes),
        title: '4GUARD WMS — Gestión de Sucursales',
      },

      // Gestión de Clientes (Homologado)
      {
        path: 'clients',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/clients/clients.routes').then((m) => m.clientsRoutes),
        title: '4GUARD WMS — Gestión de Clientes',
      },

      // Catálogo de Productos / SKUs (Homologado)
      {
        path: 'skus',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/skus/skus.routes').then((m) => m.skusRoutes),
        title: '4GUARD WMS — Catálogo de Productos / SKUs',
      },

      // Roles y Matriz de Permisos (Homologado)
      {
        path: 'roles',
        canActivate: [rbacGuard],
        data: { module: 'admin' },
        loadChildren: () =>
          import('./features/admin/roles/roles.routes').then((m) => m.rolesRoutes),
        title: '4GUARD WMS — Roles y Matriz de Permisos',
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

      // Turnos y Horarios (HU-140)
      {
        path: 'shifts',
        canActivate: [rbacGuard],
        data: { module: 'shifts' },
        loadComponent: () =>
          import('./features/admin/shifts/shift-management/shift-management.component').then(
            (m) => m.ShiftManagementComponent
          ),
        title: '4GUARD WMS — Turnos y Horarios',
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

      // Actividad por Usuario (HU-146) — Temporal debajo de Administrar
      // Ruta: /user-activity (primer nivel, sin anidar en /admin ni /monitoring)
      // Decisión: ruta independiente para evaluación. Al definir el módulo definitivo,
      // solo se cambia esta ruta y el navItem en shell.component.ts.
      {
        path: 'user-activity',
        canActivate: [rbacGuard],
        data: { module: 'user-activity' },
        loadChildren: () =>
          import('./features/user-activity/user-activity.routes').then((m) => m.userActivityRoutes),
        title: '4GUARD WMS — Actividad por Usuario',
      },

      // Motor de Reglas de Negocio (HU-131)
      {
        path: 'business-rules',
        canActivate: [rbacGuard],
        data: { module: 'business-rules' },
        loadChildren: () =>
          import('./features/business-rules/business-rules.routes').then((m) => m.businessRulesRoutes),
        title: '4GUARD WMS — Motor de Reglas de Negocio',
      },

      // Divisas y Tipos de Cambio (HU-148)
      {
        path: 'currency-exchange',
        canActivate: [rbacGuard],
        data: { module: 'currency-exchange' },
        loadChildren: () =>
          import('./features/currency-exchange/currency-exchange.routes').then((m) => m.currencyExchangeRoutes),
        title: '4GUARD WMS — Divisas y Tipos de Cambio',
      },

      // Configuración de Alertas y Notificaciones (HU-134)
      {
        path: 'alerts-config',
        canActivate: [rbacGuard],
        data: { module: 'alerts-config' },
        loadChildren: () =>
          import('./features/alerts-config/alerts-config.routes').then((m) => m.alertsConfigRoutes),
        title: '4GUARD WMS — Configuración de Alertas y Notificaciones',
      },

      // Gestión de Licencias del WMS (HU-139)
      {
        path: 'licenses',
        canActivate: [rbacGuard],
        data: { module: 'license-management' },
        loadChildren: () =>
          import('./features/license-management/license-management.routes').then(
            (m) => m.licenseManagementRoutes
          ),
        title: '4GUARD WMS — Licencias y Capacidades del WMS',
      },

      // Redirección por defecto
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Catch-all: redirigir a dashboard o login
  { path: '**', redirectTo: 'dashboard' },
];
