/**
 * @file change-password.guard.ts
 * @description Guard funcional para la ruta /change-password.
 *
 * Lógica de acceso:
 *   - Sin sesión activa              → redirige a /login
 *   - Con sesión + changePasswordRequired === true  → permite acceso
 *   - Con sesión + changePasswordRequired === false → redirige a /dashboard
 *     (el usuario ya cambió su contraseña, no tiene sentido volver aquí)
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const changePasswordGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Sin sesión activa: redirigir al login
  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  // Con sesión: verificar si el cambio de contraseña es obligatorio
  const currentUser = authService.getCurrentUser();
  if (currentUser?.changePasswordRequired) {
    return true;
  }

  // Ya cambió la contraseña: redirigir al dashboard
  return router.createUrlTree(['/dashboard']);
};
