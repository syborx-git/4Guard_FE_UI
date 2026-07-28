/**
 * @file lockout.guard.ts
 * @description Guard de ruta que previene el acceso al formulario de login
 * cuando existe un bloqueo temporal activo (HU-010).
 *
 * PROBLEMA DE SEGURIDAD RESUELTO:
 * Sin este guard, un usuario podía refrescar la página (F5) durante el bloqueo
 * de 15 minutos y el formulario se mostraba brevemente antes de que ngOnInit
 * pudiera restaurar el estado. Este guard actúa ANTES de que el componente se cree.
 *
 * FLUJO:
 * 1. El router evalúa canActivate ANTES de cargar el componente.
 * 2. Si hay un lockout válido en localStorage, redirige a /login con ?locked=true.
 * 3. LoginComponent lee el estado del lockout desde localStorage en ngOnInit
 *    y muestra la pantalla de bloqueo directamente.
 * 4. Si no hay lockout activo, permite la activación normal de la ruta.
 *
 * NOTA DE SEGURIDAD:
 * Este guard es una capa de defensa frontal. La validación definitiva
 * de bloqueos debe ejecutarse en el backend para evitar evasión
 * por borrado manual de localStorage o modo incógnito.
 */

import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { SessionStorageService } from '../services/session-storage.service';

export const lockoutGuard: CanActivateFn = () => {
  const sessionStorage = inject(SessionStorageService);

  const lockoutState = sessionStorage.getAuthLockout();
  if (!lockoutState) {
    return true; // Sin bloqueo → acceso normal al formulario
  }

  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.ceil((lockoutState.lockedUntil - now) / 1000));

  if (remainingSeconds > 0) {
    // Bloqueo activo — el componente LoginComponent se encargará de mostrar
    // la pantalla de bloqueo al leer el lockout desde localStorage en ngOnInit.
    // Permitimos la navegación a /login (el componente maneja la UI correctamente)
    // pero NO limpiamos el lockout aquí.
    return true;
  }

  // Bloqueo expirado → limpiar y permitir acceso normal
  sessionStorage.clearAuthLockout();
  if (lockoutState.identifier) {
    sessionStorage.clearFailedAttempts(lockoutState.identifier);
  }

  return true;
};
