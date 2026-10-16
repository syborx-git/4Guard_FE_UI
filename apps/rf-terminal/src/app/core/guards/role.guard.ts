/**
 * @file role.guard.ts — rf-terminal
 * @description Guard de autorización RBAC para rutas de la terminal RF.
 * Impide que perfiles como Guardia de Seguridad ingresen a Cockpit/Calidad,
 * o que Operarios ingresen a Caseta/Seguridad.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthState, UserRole } from '@4guard/shared-core';

export const rfRoleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authState = inject(AuthState);
  const router = inject(Router);

  const role = authState.role();
  if (!role) {
    return router.createUrlTree(['/login']);
  }

  // Director General, Gerente, Coordinador, Supervisor, Mesa de Control y Líder de Turno tienen supervisión completa
  if (
    role === UserRole.ADMIN ||
    role === UserRole.OPERATIONS_MANAGER ||
    role === UserRole.OPERATIONS_COORDINATOR ||
    role === UserRole.OPERATIONS_SUPERVISOR ||
    role === UserRole.CONTROL_DESK ||
    role === UserRole.SHIFT_LEADER
  ) {
    return true;
  }

  const allowedRoles = route.data?.['roles'] as UserRole[] | undefined;
  if (allowedRoles && allowedRoles.includes(role)) {
    return true;
  }

  // Redirección inteligente de seguridad según el rol
  if (role === UserRole.SECURITY_GUARD) {
    return router.createUrlTree(['/security']);
  }
  if (role === UserRole.QM_INSPECTOR) {
    return router.createUrlTree(['/quality']);
  }
  if (role === UserRole.WAREHOUSE_OPERATOR) {
    return router.createUrlTree(['/cockpit']);
  }

  return router.createUrlTree(['/menu']);
};
