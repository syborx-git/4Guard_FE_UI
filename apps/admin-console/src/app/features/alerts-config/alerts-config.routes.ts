/**
 * @file alerts-config.routes.ts
 * @description Rutas lazy-loaded para HU-134 — Configuración de Alertas y Notificaciones.
 */

import { Routes } from '@angular/router';

export const alertsConfigRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './alerts-config-management/alerts-config-management.component'
      ).then((m) => m.AlertsConfigManagementComponent),
    title: '4GUARD WMS — Configuración de Alertas y Notificaciones',
  },
];
