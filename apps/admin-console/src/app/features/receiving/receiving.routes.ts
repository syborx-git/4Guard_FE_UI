import { Routes } from '@angular/router';

export const receivingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./receiving-wizard/receiving-wizard.component').then(
        (m) => m.ReceivingWizardComponent
      ),
    title: '4GUARD WMS — La Bóveda: Recepción',
  },
];
