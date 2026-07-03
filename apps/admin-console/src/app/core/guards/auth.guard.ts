/**
 * @file auth.guard.ts
 * @description Guard de ruta para verificar si hay una sesión JWT válida activa.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirigir al login si no hay sesión válida
  return router.createUrlTree(['/login']);
};
