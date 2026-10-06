/**
 * @file auth.interceptor.ts
 * @description Interceptor HTTP funcional y reactivo para 4GUARD WMS.
 *
 * Responsabilidades:
 *  - Inyectar el token '4g_token' (Bearer) a todas las peticiones salientes.
 *  - Excluir endpoints públicos y de autenticación base (/login, /refresh, /logout).
 *  - Interceptar errores 401 Unauthorized de forma transparente.
 *  - Detener peticiones en vuelo ante un 401, ejecutar refresh token asíncronamente
 *    y reintentar de forma transparente la petición original con el nuevo token.
 *  - Forzar cierre de sesión si el refresh también falla con 401.
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const url = req.url.toLowerCase();

  // Excluir endpoints públicos o de autenticación base (login, refresh, logout, portal chofer)
  const isAuthOrPublic =
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/carrier-checkin') ||
    url.includes('/driver-checkin') ||
    url.includes('/security-gate/public') ||
    url.includes('/assets/') ||
    url.includes('/public');

  let activeReq = req;

  if (!isAuthOrPublic) {
    const token = authService.getAccessToken();
    if (token) {
      activeReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }
  }

  return next(activeReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Interceptar 401 Unauthorized únicamente en peticiones protegidas que no sean de auth
      if (error.status === 401 && !isAuthOrPublic) {
        // Detener flujo, llamar a refreshToken() y reintentar con el nuevo token obtenido
        return authService.refreshToken().pipe(
          switchMap((response) => {
            const newToken = response?.data?.accessToken || authService.getAccessToken();
            if (!newToken) {
              return throwError(() => error);
            }

            // Clonar la petición original con el nuevo Bearer Token
            const retriedReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken}`)
            });

            return next(retriedReq);
          }),
          catchError((refreshError) => {
            // Si el refresh falla definitivamente (401), forzar cierre de sesión
            if (
              !router.url.includes('/login') &&
              !router.url.includes('/carrier-checkin') &&
              !router.url.includes('/driver-checkin')
            ) {
              authService.clearSessionAndRedirect('session_expired');
            }
            return throwError(() => refreshError);
          })
        );
      }

      // Nota de Arquitectura: Errores 403 Forbidden representan denegación de permisos
      // sobre un recurso específico, NO expiración de sesión. No se debe expulsar al usuario.

      return throwError(() => error);
    })
  );
};
