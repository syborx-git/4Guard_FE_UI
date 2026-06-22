/**
 * @file jwt.interceptor.ts
 * @description Interceptor HTTP que inyecta automáticamente el Bearer JWT RS256
 * en todas las peticiones salientes al backend de 4GUARD.
 *
 * Patrón: Singleton registrado en providers root como HttpInterceptorFn.
 * Angular 17 usa interceptores funcionales (no clase).
 */

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Rutas que NO requieren autenticación (skip JWT injection).
 */
const PUBLIC_ENDPOINTS: string[] = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
];

/**
 * Verifica si la URL es un endpoint público.
 */
function isPublicEndpoint(url: string): boolean {
  return PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Clona la request inyectando el header Authorization: Bearer <token>.
 */
function addAuthorizationHeader(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Interceptor funcional JWT RS256.
 * Se registra en app.config.ts con: withInterceptors([jwtInterceptor])
 */
export const jwtInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Skip JWT para endpoints públicos
  if (isPublicEndpoint(request.url)) {
    return next(request);
  }

  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (!token) {
    return next(request);
  }

  const authRequest = addAuthorizationHeader(request, token);

  return next(authRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 Unauthorized: intentar refrescar el token
      if (error.status === 401 && !request.url.includes('/api/auth/refresh')) {
        return authService.refreshToken().pipe(
          switchMap((newToken) => {
            const retryRequest = addAuthorizationHeader(request, newToken);
            return next(retryRequest);
          }),
          catchError((refreshError) => {
            // Si el refresh también falla, cerrar sesión
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
