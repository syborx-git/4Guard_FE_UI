/**
 * @file quality.routes.ts
 * @description Rutas lazy-loaded del Módulo de Calidad QM para Terminal RF (Shell + 4 Submódulos + Inspección Técnica).
 */

import { Routes } from '@angular/router';

export const qualityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/quality-shell/quality-shell.component').then((m) => m.RfQualityShellComponent),
    children: [
      { path: '', redirectTo: 'blocks', pathMatch: 'full' },
      {
        path: 'blocks',
        loadComponent: () =>
          import('./pages/blocks-submodule/blocks-submodule.component').then((m) => m.RfBlocksSubmoduleComponent),
        title: '4GUARD RF — Bloqueos y Producto No Conforme (PNC)',
      },
      {
        path: 'releases',
        loadComponent: () =>
          import('./pages/releases-submodule/releases-submodule.component').then((m) => m.RfReleasesSubmoduleComponent),
        title: '4GUARD RF — Dictamen de Liberaciones & Destinos',
      },
      {
        path: 'load-verifications',
        loadComponent: () =>
          import('./pages/load-verification-submodule/load-verification-submodule.component').then((m) => m.RfLoadVerificationSubmoduleComponent),
        title: '4GUARD RF — Verificación de Transporte en Andén (F01-PO-GC-8.6-03)',
      },
      {
        path: 'claims',
        loadComponent: () =>
          import('./pages/claims-submodule/claims-submodule.component').then((m) => m.RfClaimsSubmoduleComponent),
        title: '4GUARD RF — Reclamos e Incidencias (F01)',
      },
      {
        path: 'inspection',
        loadComponent: () =>
          import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
        title: '4GUARD RF — Inspección Técnica QM & Certificados',
      },
      {
        path: 'inspection/:id',
        loadComponent: () =>
          import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
        title: '4GUARD RF — Inspección Técnica QM & Certificados',
      },
    ],
  },
];
