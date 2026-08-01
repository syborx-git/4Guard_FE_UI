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

  // Excluir endpoints públicos o de autenticación base (login, refresh, logout)
  const isAuthOrPublic =
    url.includes('/login') ||
    url.includes('/refresh') ||
    url.includes('/logout') ||
    url.includes('/assets/') ||
    url.includes('/public');

  let activeReq = req;

  if (!isAuthOrPublic) {
    const token = localStorage.getItem('4g_token') || authService.getAccessToken();
    if (token) {
      activeReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }
  }

  return next(activeReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Interceptar 401 Unauthorized o 403 Forbidden únicamente en peticiones protegidas que no estén excluidas
      if (error.status === 401 && !isAuthOrPublic) {
        // Detener flujo, llamar a refreshToken() y reintentar con el nuevo token obtenido
        return authService.refreshToken().pipe(
          switchMap((response) => {
            const newToken = response?.data?.accessToken || localStorage.getItem('4g_token');

            // Clonar la petición original con el nuevo Bearer Token
            const retriedReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken}`)
            });

            return next(retriedReq);
          }),
          catchError((refreshError) => {
            // Si el refresh falla, forzar cierre de sesión sin duplicar navegaciones si ya estamos en /login
            if (!router.url.includes('/login')) {
              authService.clearSessionAndRedirect('session_expired');
            }
            return throwError(() => refreshError);
          })
        );
      }

      // Si recibe 403 Forbidden por revocación de sesión en un endpoint protegido
      if (error.status === 403 && !isAuthOrPublic && !router.url.includes('/login')) {
        authService.clearSessionAndRedirect('session_expired');
      }

      return throwError(() => error);
    })
  );
};
