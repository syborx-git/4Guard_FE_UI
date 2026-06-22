/**
 * @file auth.guard.ts
 * @description Guard funcional de autenticación para admin-console.
 * Bloquea el acceso a rutas protegidas si no hay sesión activa.
 */

import { inject }           from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService }      from '@4guard/shared-core';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isTokenValid()) {
    return true;
  }

  // Redirigir al login si no hay sesión válida
  return router.createUrlTree(['/login']);
};
