/**
 * @file performance.routes.ts
 * @description Rutas lazy-loaded del Módulo de Rendimiento (HU-9 / HU-138 / HU-141 / HU-159) — 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const performanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/performance-shell/performance-shell.component').then(
        (m) => m.PerformanceShellComponent
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/performance-dashboard/performance-dashboard.component').then(
            (m) => m.PerformanceDashboardComponent
          ),
        title: '4GUARD WMS — Control Operativo & Resumen Ejecutivo',
      },
      {
        path: 'operators',
        loadComponent: () =>
          import('./pages/performance-operators/performance-operators.component').then(
            (m) => m.PerformanceOperatorsComponent
          ),
        title: '4GUARD WMS — Productividad del Personal y Turnos',
      },
      {
        path: 'circuito-delicado',
        loadComponent: () =>
          import('./pages/performance-circuito-delicado/performance-circuito-delicado.component').then(
            (m) => m.PerformanceCircuitoDelicadoComponent
          ),
        title: '4GUARD WMS — Circuito Delicado (Transporte Propio)',
      },
      {
        path: 'kpis',
        loadComponent: () =>
          import('./kpi-management/kpi-management.component').then(
            (m) => m.KpiManagementComponent
          ),
        title: '4GUARD WMS — Catálogo & Definición de Reglas de KPIs',
      },
      // Redirecciones limpias para compatibilidad
      { path: 'operations', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'timeline-audit', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
