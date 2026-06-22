import { Routes } from '@angular/router';

export const receivingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./receiving-list/receiving-list.component').then((m) => m.ReceivingListComponent),
    title: '4GUARD WMS — Recepciones',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./receiving-detail/receiving-detail.component').then((m) => m.ReceivingDetailComponent),
    title: '4GUARD WMS — Detalle de Recepción',
  },
];
