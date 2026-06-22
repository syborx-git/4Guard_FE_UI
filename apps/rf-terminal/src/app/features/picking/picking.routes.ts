import { Routes } from '@angular/router';

export const pickingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./picking-list/picking-list.component').then((m) => m.PickingListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./picking-scan/picking-scan.component').then((m) => m.PickingScanComponent),
  },
];
