/**
 * @file sync.state.ts
 * @description Store reactivo de sincronización offline usando Angular Signals.
 *
 * Thin wrapper sobre SyncService que expone señales de estado para
 * componentes de UI (banner de offline, contador de pendientes, etc.)
 *
 * Patrón: providedIn: 'root' → Singleton.
 */

import { Injectable, inject, computed } from '@angular/core';
import { SyncService, SyncOperation } from '../../infrastructure/services/sync.service';

@Injectable({ providedIn: 'root' })
export class SyncState {
  private readonly syncService = inject(SyncService);

  // ─── Señales derivadas ────────────────────────────────────────────────────

  /** Estado de conectividad */
  readonly isOnline     = this.syncService.isOnline;
  readonly isOffline    = this.syncService.isOfflineMode;

  /** Estado del proceso de sincronización */
  readonly syncStatus   = this.syncService.syncStatus;
  readonly isSyncing    = computed(() => this.syncService.syncStatus() === 'syncing');
  readonly hasError     = computed(() => this.syncService.syncStatus() === 'error');

  /** Cola de operaciones */
  readonly syncQueue    = this.syncService.syncQueue;
  readonly pendingCount = this.syncService.pendingCount;
  readonly hasPending   = this.syncService.hasPendingSync;

  /** Operaciones con error permanente */
  readonly failedOps = computed(() =>
    this.syncService.syncQueue().filter((op: SyncOperation) => op.failed),
  );

  /** Mensaje de estado para la UI */
  readonly statusMessage = computed(() => {
    const status = this.syncService.syncStatus();
    const pending = this.syncService.pendingCount();

    switch (status) {
      case 'offline':  return `Sin conexión • ${pending} operación(es) pendiente(s)`;
      case 'syncing':  return 'Sincronizando con el servidor...';
      case 'error':    return `Error de sincronización • ${this.failedOps().length} fallida(s)`;
      default:         return pending > 0 ? `${pending} operación(es) en cola` : 'Sincronizado';
    }
  });

  /** Color del indicator de status para la UI */
  readonly statusColor = computed(() => {
    switch (this.syncService.syncStatus()) {
      case 'offline': return 'var(--color-warning)';
      case 'syncing': return 'var(--color-primary-light)';
      case 'error':   return 'var(--color-danger)';
      default:        return 'var(--color-success)';
    }
  });

  // ─── Acciones ─────────────────────────────────────────────────────────────

  /**
   * Fuerza la sincronización manual.
   */
  syncNow(): Promise<void> {
    return this.syncService.synchronize();
  }

  /**
   * Descarta una operación de la cola.
   */
  discardOperation(operationId: string): void {
    this.syncService.discardOperation(operationId);
  }

  /**
   * Encola una nueva operación offline.
   */
  enqueue(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'failed' | 'lastError'>): void {
    this.syncService.enqueueOperation(operation);
  }
}
