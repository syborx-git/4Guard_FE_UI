/**
 * @file business-rules.routes.ts
 * @description Rutas lazy-loaded para HU-131 — Motor de Reglas de Negocio Enterprise.
 */

import { Routes } from '@angular/router';

export const businessRulesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './business-rules-config/business-rules-config.component'
      ).then((m) => m.BusinessRulesConfigComponent),
    title: '4GUARD WMS — Motor de Reglas de Negocio',
  },
];
