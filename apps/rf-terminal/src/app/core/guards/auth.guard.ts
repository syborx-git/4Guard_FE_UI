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

  if (auth.isAuthenticated() && auth.isTokenValid()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
