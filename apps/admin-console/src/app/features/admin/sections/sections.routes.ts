/**
 * @file sections.routes.ts
 * @description Rutas de la feature Secciones de Almacén — 4GUARD WMS.
 */

import { Routes } from '@angular/router';

export const sectionsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./section-management/section-management.component').then(
        (m) => m.SectionManagementComponent
      ),
    title: '4GUARD WMS — Secciones de Almacén',
  },
];
