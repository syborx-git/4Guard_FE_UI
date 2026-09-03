/**
 * @file quality.routes.ts
 * @description Rutas lazy-loaded del Módulo de Calidad QM (Shell + 3 Submódulos + Inspección profunda).
 */

import { Routes } from '@angular/router';

export const qualityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/quality-shell/quality-shell.component').then((m) => m.QualityShellComponent),
    children: [
      { path: '', redirectTo: 'blocks', pathMatch: 'full' },
      {
        path: 'blocks',
        loadComponent: () =>
          import('./pages/blocks-submodule/blocks-submodule.component').then((m) => m.BlocksSubmoduleComponent),
        title: '4GUARD WMS — Bloqueos y Producto No Conforme',
      },
      {
        path: 'releases',
        loadComponent: () =>
          import('./pages/releases-submodule/releases-submodule.component').then((m) => m.ReleasesSubmoduleComponent),
        title: '4GUARD WMS — Liberaciones & Destinos',
      },
      {
        path: 'load-verifications',
        loadComponent: () =>
          import('./pages/load-verification-submodule/load-verification-submodule.component').then((m) => m.LoadVerificationSubmoduleComponent),
        title: '4GUARD WMS — Verificación de Carga (F01-PO-GC-8.6-03)',
      },
    ],
  },
  {
    path: 'inspection/:id',
    loadComponent: () =>
      import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
    title: '4GUARD WMS — Inspección Técnica QM',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
    title: '4GUARD WMS — Inspección Técnica QM',
  },
];
