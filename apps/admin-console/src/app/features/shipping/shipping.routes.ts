import { Routes } from '@angular/router';

export const shippingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shipping-list/shipping-list.component').then((m) => m.ShippingListComponent),
    title: '4GUARD WMS — Despacho',
  },
];
