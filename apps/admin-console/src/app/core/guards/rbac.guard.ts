/**
 * @file rbac.guard.ts
 * @description Guard funcional RBAC para admin-console.
 * Verifica que el usuario tenga el rol requerido para acceder al módulo.
 * Lee el módulo/roles requeridos desde los data de la ruta.
 */

import { inject }                     from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { UserRole }                    from '@4guard/shared-core';
import { AuthState }                   from '../auth/auth.state';

export const rbacGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authState = inject(AuthState);
  const router    = inject(Router);

  // Extraer configuración RBAC desde los datos de la ruta
  const module        = route.data?.['module'] as string | undefined;
  const requiredRoles = route.data?.['roles']  as UserRole[] | undefined;

  // Si hay roles explícitos en la ruta, verificarlos primero
  if (requiredRoles && requiredRoles.length > 0) {
    if (!authState.hasRole(...requiredRoles)) {
      return router.createUrlTree(['/dashboard']);
    }
  }

  // Verificar acceso por módulo (usando la tabla MODULE_PERMISSIONS)
  if (module && !authState.canAccessModule(module)) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
