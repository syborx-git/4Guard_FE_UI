import { Routes } from '@angular/router';

export const pickingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./picking-list/picking-list.component').then(
        (m) => m.PickingListComponent
      ),
    title: '4GUARD Terminal — Picking FEFO',
  },
];
