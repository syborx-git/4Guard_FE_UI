import { Routes } from '@angular/router';

export const receivingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./receiving-scan/receiving-scan.component').then((m) => m.ReceivingScanComponent),
  },
];
