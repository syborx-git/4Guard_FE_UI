import { Routes } from '@angular/router';

export const receivingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./receiving-center/receiving-center.component').then(
        (m) => m.ReceivingCenterComponent
      ),
    title: '4GUARD WMS — Centro de Recepciones',
  },
  {
    path: 'appointments/:appointmentId/wizard',
    loadComponent: () =>
      import('./receiving-wizard/receiving-wizard.component').then(
        (m) => m.ReceivingWizardComponent
      ),
    title: '4GUARD WMS — La Bóveda: Recepción',
  },
  {
    path: 'wizard',
    redirectTo: '',
    pathMatch: 'full',
  },
];
