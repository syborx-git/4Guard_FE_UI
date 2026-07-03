/**
 * @file jwt.interceptor.ts
 * @description Interceptor funcional JWT para inyectar token de autorización y capturar respuestas 401 Unauthorized.
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionStorageService } from '../services/session-storage.service';
import { Router } from '@angular/router';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionStorageService = inject(SessionStorageService);
  const router = inject(Router);

  const url = req.url.toLowerCase();

  // Excluir endpoints públicos
  const isExcluded =
    url.includes('/login') ||
    url.includes('/refresh') ||
    url.includes('/assets/') ||
    url.includes('/public');

  let authReq = req;

  if (!isExcluded) {
    const token = sessionStorageService.getAccessToken();
    if (token) {
      authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 Unauthorized redirige automáticamente al login y limpia sesión
      if (error.status === 401) {
        sessionStorageService.clearSession();
        router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
      }
      return throwError(() => error);
    })
  );
};
