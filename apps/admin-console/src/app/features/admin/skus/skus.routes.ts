import { Routes } from '@angular/router';

export const skusRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sku-management/sku-management.component').then(
        (m) => m.SkuManagementComponent
      ),
  },
];
