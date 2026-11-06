/**
 * @file auth.guard.ts — rf-terminal
 * @description Guard de autenticación para la terminal RF.
 */

import { inject }           from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService }      from '@4guard/shared-core';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Permitir paso inmediato si hay sesión autenticada o token almacenado
  const hasToken = !!auth.getAccessToken() || (typeof localStorage !== 'undefined' && !!localStorage.getItem('4guard_access_token'));
  if (auth.isAuthenticated() || hasToken) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
