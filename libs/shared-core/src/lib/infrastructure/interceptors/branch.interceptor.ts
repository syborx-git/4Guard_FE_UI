/**
 * @file branch.interceptor.ts
 * @description Interceptor HTTP que inyecta automáticamente el header X-Branch-Id
 * en todas las peticiones al backend de 4GUARD.
 *
 * El X-Branch-Id es requerido por el backend para determinar el contexto
 * de sucursal/almacén del operario autenticado. Funciona en conjunto con
 * el jwtInterceptor.
 *
 * Patrón: Singleton registrado en providers root como HttpInterceptorFn.
 */

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Header name requerido por el backend de 4GUARD.
 */
const BRANCH_HEADER = 'X-Branch-Id';

/**
 * Rutas que NO requieren el header de sucursal.
 */
const SKIP_BRANCH_HEADER: string[] = [
  '/api/auth/login',
  '/api/auth/refresh',
];

/**
 * Interceptor funcional X-Branch-Id.
 * Se registra en app.config.ts con: withInterceptors([branchInterceptor])
 *
 * Orden de ejecución recomendado: [jwtInterceptor, branchInterceptor]
 */
export const branchInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Skip para endpoints que no necesitan el header de sucursal
  const shouldSkip = SKIP_BRANCH_HEADER.some((url) => request.url.includes(url));
  if (shouldSkip) {
    return next(request);
  }

  const authService = inject(AuthService);
  const branchId = authService.getBranchId();

  if (!branchId) {
    // Sin branchId, dejar pasar la request (el backend retornará 403)
    return next(request);
  }

  const requestWithBranch = request.clone({
    setHeaders: {
      [BRANCH_HEADER]: branchId,
    },
  });

  return next(requestWithBranch);
};
