/**
 * @file offline.guard.ts
 * @description Guard para flujos que requieren soporte offline.
 * Advierte al usuario si intenta operar en una sección sin soporte offline
 * cuando no hay conexión, pero permite continuar con funciones offline-ready.
 */

import { inject }      from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { SyncState }   from '@4guard/shared-core';

export const offlineGuard: CanActivateFn = () => {
  const syncState = inject(SyncState);

  // La terminal RF siempre permite el acceso (offline-first).
  // El guard solo loguea el estado para telemetría.
  if (syncState.isOffline()) {
    console.info('[OfflineGuard] Modo offline activo. Usando datos de IndexedDB.');
  }

  return true;
};
