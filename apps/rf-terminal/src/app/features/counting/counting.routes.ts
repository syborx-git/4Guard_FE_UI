import { Routes } from '@angular/router';

export const countingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./counting-scan/counting-scan.component').then((m) => m.CountingScanComponent),
  },
];
