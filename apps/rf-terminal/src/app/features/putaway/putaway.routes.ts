import { Routes } from '@angular/router';

export const putawayRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./putaway-scan/putaway-scan.component').then((m) => m.PutawayScanComponent),
  },
];
