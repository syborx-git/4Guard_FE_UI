/**
 * @file auth.interceptor.ts
 * @description Interceptor HTTP funcional y reactivo para 4GUARD WMS.
 *
 * Responsabilidades:
 *  - Inyectar el token '4g_token' (Bearer) a todas las peticiones salientes.
 *  - Excluir endpoints públicos y de autenticación base (/login, /refresh, /logout).
 *  - Interceptar errores 401 Unauthorized de forma transparente.
 *  - Detener peticiones concurrentes ante un 401 mediante Mutex (isRefreshing)
 *    y reintentar con el nuevo token obtenido una única vez.
 *  - Forzar cierre de sesión si el refresh falla.
 */

import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  originalError: HttpErrorResponse
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        const newToken = response?.data?.accessToken || authService.getAccessToken();
        if (!newToken) {
          authService.clearSessionAndRedirect('session_expired');
          return throwError(() => originalError);
        }

        refreshTokenSubject.next(newToken);
        return next(
          req.clone({
            headers: req.headers.set('Authorization', `Bearer ${newToken}`)
          })
        );
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.clearSessionAndRedirect('session_expired');
        return throwError(() => refreshError);
      })
    );
  } else {
    // Si ya hay un refresco en progreso, esperar a que emita el nuevo token
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((newToken) => {
        return next(
          req.clone({
            headers: req.headers.set('Authorization', `Bearer ${newToken}`)
          })
        );
      })
    );
  }
}

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
      // Si el token almacenado ya expiró por tiempo antes de enviarlo
      if (authService.isTokenExpired()) {
        return handle401Error(req, next, authService, router, new HttpErrorResponse({ status: 401, statusText: 'Token Expired' }));
      }

      activeReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }
  }

  return next(activeReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isExpiredForbidden =
        error.status === 403 &&
        error.error &&
        typeof error.error.message === 'string' &&
        (error.error.message.toLowerCase().includes('token expirado') ||
         error.error.message.toLowerCase().includes('no autenticado') ||
         error.error.message.toLowerCase().includes('jwt expired'));

      // Interceptar 401 Unauthorized únicamente en peticiones protegidas
      if ((error.status === 401 || isExpiredForbidden) && !isAuthOrPublic) {
        return handle401Error(req, next, authService, router, error);
      }

      return throwError(() => error);
    })
  );
};
