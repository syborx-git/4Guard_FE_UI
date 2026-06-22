import { Routes } from '@angular/router';

export const qualityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./quality-inspection/quality-inspection.component').then((m) => m.QualityInspectionComponent),
  },
];
