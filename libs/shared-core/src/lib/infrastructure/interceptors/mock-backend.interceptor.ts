/**
 * @file mock-backend.interceptor.ts
 * @description Interceptor de paso transparente en cumplimiento estricto con ADR-007 (Cero Mocks).
 * Todas las peticiones van directamente a la base de datos y API del backend real.
 */

import { HttpInterceptorFn } from '@angular/common/http';

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  // ADR-007: Cero Mocks en producción. Todo tráfico va directamente al Backend real.
  return next(req);
};
