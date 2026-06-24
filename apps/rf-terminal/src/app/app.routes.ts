/**
 * @file app.routes.ts
 * @description Rutas de rf-terminal.
 * Diseñadas para flujos operativos simples: una acción por pantalla.
 */

import { Routes } from '@angular/router';
import { authGuard }    from './core/guards/auth.guard';
import { offlineGuard } from './core/guards/offline.guard';

export const rfRoutes: Routes = [
  // Login
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/rf-login/rf-login.component').then((m) => m.RfLoginComponent),
    title: '4GUARD Terminal — Acceso',
  },

  // Rutas operativas protegidas
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/rf-shell/rf-shell.component').then((m) => m.RfShellComponent),
    canActivate: [authGuard],
    children: [
      // Menú principal
      {
        path: 'menu',
        loadChildren: () =>
          import('./features/menu/menu.routes').then((m) => m.menuRoutes),
        title: '4GUARD Terminal — Menú',
      },

      // Recepción de mercancía (andén)
      {
        path: 'receiving',
        canActivate: [offlineGuard],
        loadChildren: () =>
          import('./features/receiving/receiving.routes').then((m) => m.receivingRoutes),
        title: '4GUARD Terminal — Recepción',
      },

      // Ubicación en rack (putaway)
      {
        path: 'putaway',
        canActivate: [offlineGuard],
        loadChildren: () =>
          import('./features/putaway/putaway.routes').then((m) => m.putawayRoutes),
        title: '4GUARD Terminal — Putaway',
      },

      // Picking de órdenes
      {
        path: 'picking',
        canActivate: [offlineGuard],
        loadChildren: () =>
          import('./features/picking/picking.routes').then((m) => m.pickingRoutes),
        title: '4GUARD Terminal — Picking',
      },

      // Conteo físico
      {
        path: 'counting',
        canActivate: [offlineGuard],
        loadChildren: () =>
          import('./features/counting/counting.routes').then((m) => m.countingRoutes),
        title: '4GUARD Terminal — Conteo',
      },

      // Inspección QM
      {
        path: 'quality',
        loadChildren: () =>
          import('./features/quality/quality.routes').then((m) => m.qualityRoutes),
        title: '4GUARD Terminal — Calidad',
      },

      // Sincronización
      {
        path: 'sync',
        loadChildren: () =>
          import('./features/sync/sync.routes').then((m) => m.syncRoutes),
        title: '4GUARD Terminal — Sincronización',
      },

      // Reporte de anomalía
      {
        path: 'anomaly',
        loadComponent: () =>
          import('./features/anomaly/anomaly-report/anomaly-report.component').then((m) => m.AnomalyReportComponent),
        title: '4GUARD Terminal — Reportar Anomalía',
      },

      { path: '', redirectTo: 'menu', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '' },
];
