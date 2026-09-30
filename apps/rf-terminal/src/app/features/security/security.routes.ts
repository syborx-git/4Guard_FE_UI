/**
 * @file security.routes.ts
 * @description Rutas para el módulo de Seguridad & Caseta en Terminal RF.
 */

import { Routes } from '@angular/router';

export const securityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./security-gate/security-gate.component').then((m) => m.SecurityGateRfComponent),
    title: '4GUARD Terminal — Seguridad & Caseta',
  },
];
