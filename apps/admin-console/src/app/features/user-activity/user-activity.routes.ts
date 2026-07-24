/**
 * @file user-activity.routes.ts
 * @description Rutas para HU-146 — Actividad por Usuario.
 *
 * Ruta: /user-activity (primer nivel, temporal debajo de Administrar)
 *
 * DECISIÓN: Se mantiene como ruta de primer nivel para evaluación.
 * Cuando se defina el módulo definitivo (Monitoreo, Auditoría, etc.),
 * solo se cambia la ruta en app.routes.ts y el navItem en shell.component.ts.
 */
import { Routes } from '@angular/router';

export const userActivityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./user-activity-report/user-activity-report.component').then(
        (m) => m.UserActivityReportComponent
      ),
    title: '4GUARD WMS — Actividad por Usuario',
  },
];
