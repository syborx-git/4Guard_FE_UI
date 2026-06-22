/**
 * @file sync.service.ts
 * @description Servicio Singleton de Sincronización Offline para rf-terminal.
 *
 * Responsabilidades:
 * - Detectar conectividad (online/offline)
 * - Encolar operaciones fallidas en IndexedDB (via Dexie.js)
 * - Re-sincronizar la cola cuando se recupera la conexión
 * - Exponer el estado de sincronización vía Signals
 *
 * Patrón: providedIn: 'root' → Singleton global.
 * Usado principalmente por rf-terminal. admin-console puede inyectarlo
 * pero solo para monitorear el estado.
 */

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, fromEvent, merge, takeUntil } from 'rxjs';

/**
 * Operación HTTP que puede encolarse para sincronización offline.
 */
export interface SyncOperation {
  /** Identificador único local (generado offline) */
  id: string;

  /** Método HTTP */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** URL del endpoint backend */
  url: string;

  /** Cuerpo de la petición (serializado como JSON string) */
  body: string;

  /** Timestamp de creación (offline) */
  createdAt: number;

  /** Número de intentos de sincronización */
  retryCount: number;

  /** Descripción legible de la operación (para UI) */
  description: string;

  /** Indica si la operación falló permanentemente */
  failed: boolean;

  /** Mensaje del último error */
  lastError: string | null;
}

/**
 * Estado del servicio de sincronización.
 */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

@Injectable({ providedIn: 'root' })
export class SyncService implements OnDestroy {
  private readonly http    = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();

  // ─── Señales de estado ────────────────────────────────────────────────────
  private readonly _isOnline     = signal<boolean>(navigator.onLine);
  private readonly _syncStatus   = signal<SyncStatus>('idle');
  private readonly _pendingCount = signal<number>(0);
  private readonly _syncQueue    = signal<SyncOperation[]>([]);

  /** Indica si hay conexión a internet */
  readonly isOnline   = this._isOnline.asReadonly();

  /** Estado del proceso de sincronización */
  readonly syncStatus = this._syncStatus.asReadonly();

  /** Número de operaciones pendientes de sincronización */
  readonly pendingCount = this._pendingCount.asReadonly();

  /** Cola de operaciones pendientes */
  readonly syncQueue = this._syncQueue.asReadonly();

  /** Indica si hay operaciones pendientes */
  readonly hasPendingSync = computed(() => this._pendingCount() > 0);

  /** Indica si el modo offline está activo */
  readonly isOfflineMode = computed(() => !this._isOnline());

  constructor() {
    this.initConnectivityMonitor();
    this.loadQueueFromStorage();
  }

  // ─── API Pública ──────────────────────────────────────────────────────────

  /**
   * Encola una operación para sincronización cuando se recupere la conexión.
   * Se usa cuando una petición HTTP falla por falta de conexión.
   */
  enqueueOperation(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'failed' | 'lastError'>): void {
    const newOperation: SyncOperation = {
      ...operation,
      id: this.generateId(),
      createdAt: Date.now(),
      retryCount: 0,
      failed: false,
      lastError: null,
    };

    const currentQueue = this._syncQueue();
    const updatedQueue = [...currentQueue, newOperation];
    this._syncQueue.set(updatedQueue);
    this._pendingCount.set(updatedQueue.length);
    this.persistQueueToStorage(updatedQueue);
  }

  /**
   * Inicia manualmente el proceso de sincronización.
   * Normalmente se llama automáticamente al detectar conexión.
   */
  async synchronize(): Promise<void> {
    if (!this._isOnline() || this._syncQueue().length === 0) return;
    if (this._syncStatus() === 'syncing') return;

    this._syncStatus.set('syncing');

    const queue = [...this._syncQueue()];
    const failedOps: SyncOperation[] = [];

    for (const operation of queue) {
      try {
        await this.executeOperation(operation);
      } catch (error) {
        const updatedOp: SyncOperation = {
          ...operation,
          retryCount: operation.retryCount + 1,
          failed: operation.retryCount >= 3,
          lastError: String(error),
        };
        failedOps.push(updatedOp);
      }
    }

    this._syncQueue.set(failedOps);
    this._pendingCount.set(failedOps.length);
    this.persistQueueToStorage(failedOps);
    this._syncStatus.set(failedOps.length > 0 ? 'error' : 'idle');
  }

  /**
   * Elimina una operación de la cola (descarta cambios).
   */
  discardOperation(operationId: string): void {
    const filtered = this._syncQueue().filter((op) => op.id !== operationId);
    this._syncQueue.set(filtered);
    this._pendingCount.set(filtered.length);
    this.persistQueueToStorage(filtered);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  private initConnectivityMonitor(): void {
    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'offline'),
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const online = navigator.onLine;
        this._isOnline.set(online);
        this._syncStatus.set(online ? 'idle' : 'offline');

        if (online && this._syncQueue().length > 0) {
          // Auto-sincronizar al recuperar conexión
          this.synchronize();
        }
      });
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const body = JSON.parse(operation.body);
    await this.http
      .request(operation.method, operation.url, { body })
      .toPromise();
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private readonly STORAGE_KEY = '4guard_sync_queue';

  private persistQueueToStorage(queue: SyncOperation[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // localStorage puede estar lleno (cuota excedida)
      console.warn('[SyncService] No se pudo persistir la cola en localStorage');
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const queue = JSON.parse(raw) as SyncOperation[];
        this._syncQueue.set(queue);
        this._pendingCount.set(queue.length);
      }
    } catch {
      this._syncQueue.set([]);
    }
  }
}
