import { Routes } from '@angular/router';

export const qualityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./quality-list/quality-list.component').then((m) => m.QualityListComponent),
    title: '4GUARD WMS — Control de Calidad',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
    title: '4GUARD WMS — Inspección QM',
  },
];
