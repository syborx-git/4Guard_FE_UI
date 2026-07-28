/**
 * @file currency-exchange.routes.ts
 * @description Rutas lazy-loaded para HU-148 — Gestión de Divisas y Tipos de Cambio.
 */

import { Routes } from '@angular/router';

export const currencyExchangeRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './currency-exchange-management/currency-exchange-management.component'
      ).then((m) => m.CurrencyExchangeManagementComponent),
    title: '4GUARD WMS — Divisas y Tipos de Cambio',
  },
];
