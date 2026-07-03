/**
 * @file permission.guard.ts
 * @description Guard de ruta basado en permisos específicos configurados en el data de las rutas.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredPermissions = route.data?.['permissions'] as string[] | undefined;

  // Si no se configuran permisos requeridos, permitir paso
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // Verificar si el usuario tiene al menos uno de los permisos requeridos
  if (authService.hasAnyPermission(requiredPermissions)) {
    return true;
  }

  // Si no tiene permisos, redirigir al Dashboard
  return router.createUrlTree(['/dashboard']);
};
