/**
 * @file sync.state.ts
 * @description Store reactivo de sincronización offline usando Angular Signals.
 * Thin wrapper sobre SyncService que expone señales de estado para componentes de UI
 * (banner de offline, contador de pendientes, ocupación de cola 500, etc.)
 */

import { Injectable, inject, computed } from '@angular/core';
import { SyncService, SyncOperation, MAX_OFFLINE_QUEUE_CAPACITY } from '../../infrastructure/services/sync.service';

@Injectable({ providedIn: 'root' })
export class SyncState {
  private readonly syncService = inject(SyncService);

  // ─── Señales Derivadas ───────────────────────────────────────────────────

  /** Estado de conectividad */
  readonly isOnline     = this.syncService.isOnline;
  readonly isOffline    = this.syncService.isOfflineMode;

  /** Estado del proceso de sincronización */
  readonly syncStatus   = this.syncService.syncStatus;
  readonly isSyncing    = computed(() => this.syncService.syncStatus() === 'syncing');
  readonly hasError     = computed(() => this.syncService.syncStatus() === 'error');
  readonly isQueueFull  = this.syncService.isQueueFull;
  readonly canEnqueue   = this.syncService.canEnqueue;
  readonly maxCapacity  = MAX_OFFLINE_QUEUE_CAPACITY;
  readonly queueOccupancy = this.syncService.queueOccupancyPercentage;

  /** Cola de operaciones y conflictos */
  readonly syncQueue    = this.syncService.syncQueue;
  readonly pendingCount = this.syncService.pendingCount;
  readonly hasPending   = this.syncService.hasPendingSync;
  readonly conflictCount = this.syncService.conflictCount;

  /** Operaciones con error permanente */
  readonly failedOps = computed(() =>
    this.syncService.syncQueue().filter((op: SyncOperation) => op.failed)
  );

  /** Mensaje de estado para la UI */
  readonly statusMessage = computed(() => {
    const status = this.syncService.syncStatus();
    const pending = this.syncService.pendingCount();

    switch (status) {
      case 'blocked_queue_full':
        return `⚠️ COLA LLENA (500/500) • Bloqueo preventivo de captura`;
      case 'offline':
        return `Sin conexión • ${pending} op(s) en cola IndexedDB`;
      case 'syncing':
        return 'Sincronizando operaciones con el servidor...';
      case 'error':
        return `Error de sincronización • Reintentando en segundo plano (${this.failedOps().length} fallida(s))`;
      default:
        return pending > 0 ? `${pending} op(s) en cola` : 'Sincronizado al 100%';
    }
  });

  /** Color del indicador de status para la UI */
  readonly statusColor = computed(() => {
    switch (this.syncService.syncStatus()) {
      case 'blocked_queue_full':
        return 'var(--c-danger, #ef4444)';
      case 'offline':
        return 'var(--c-warning, #f59e0b)';
      case 'syncing':
        return 'var(--c-info, #0284c7)';
      case 'error':
        return 'var(--c-danger, #ef4444)';
      default:
        return 'var(--c-success, #10b981)';
    }
  });

  // ─── Acciones ─────────────────────────────────────────────────────────────

  /**
   * Fuerza la sincronización manual inmediata con pre-flight ping.
   */
  syncNow(): Promise<void> {
    return this.syncService.synchronize();
  }

  /**
   * Descarta una operación de la cola IndexedDB.
   */
  discardOperation(operationId: string): Promise<void> {
    return this.syncService.discardOperation(operationId);
  }

  /**
   * Encola una nueva operación offline.
   */
  enqueue(
    operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'failed' | 'lastError'>
  ): Promise<boolean> {
    return this.syncService.enqueueOperation(operation);
  }
}
