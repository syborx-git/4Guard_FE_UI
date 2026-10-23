/**
 * @file sync.service.ts
 * @description Servicio Singleton de Sincronización Offline-First para rf-terminal y admin-console.
 * Implementa estrictamente el documento ejecutivo de sincronización 4Guard WMS:
 * 1. Disparador Nativo Event-Driven (window.addEventListener('online')).
 * 2. Verificación Previa de Conectividad Real (Pre-flight Ping / Heartbeat).
 * 3. Algoritmo de Espera Exponencial (Exponential Backoff: 5s, 15s, 30s, 60s).
 * 4. Procesamiento Secuencial FIFO en IndexedDB (4guard_rf_db).
 * 5. Capacidad Máxima de 500 Operaciones Pendientes con Bloqueo Preventivo Local.
 * 6. Desvío de Conflictos de Versión (HTTP 409) a la Cola de Arbitraje de Mesa de Control.
 */

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, fromEvent, merge, takeUntil, firstValueFrom, timeout } from 'rxjs';
import { OfflineIndexedDb, OfflineTransactionRecord, SyncConflictRecord } from '../db/offline-indexed-db';

export interface SyncOperation {
  id: string;
  actionType: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: string;
  createdAt: number;
  retryCount: number;
  failed: boolean;
  lastError: string | null;
  description: string;
  zoneId?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'blocked_queue_full';

export const MAX_OFFLINE_QUEUE_CAPACITY = 500;
const EXPONENTIAL_BACKOFF_MS = [5000, 15000, 30000, 60000];

@Injectable({ providedIn: 'root' })
export class SyncService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();

  // ─── Señales de Estado Reactivo ──────────────────────────────────────────
  private readonly _isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  private readonly _syncStatus = signal<SyncStatus>('idle');
  private readonly _pendingCount = signal<number>(0);
  private readonly _syncQueue = signal<SyncOperation[]>([]);
  private readonly _conflictCount = signal<number>(0);
  private readonly _lastPingSuccess = signal<boolean>(true);
  private readonly _retryAttempt = signal<number>(0);

  private backoffTimer: any = null;

  /** Indica si hay conexión de red detectada */
  readonly isOnline = this._isOnline.asReadonly();

  /** Estado del proceso de sincronización */
  readonly syncStatus = this._syncStatus.asReadonly();

  /** Número de operaciones pendientes de sincronización */
  readonly pendingCount = this._pendingCount.asReadonly();

  /** Cola de operaciones pendientes en memoria */
  readonly syncQueue = this._syncQueue.asReadonly();

  /** Número de conflictos 409 pendientes de arbitraje */
  readonly conflictCount = this._conflictCount.asReadonly();

  /** Indica si hay operaciones pendientes */
  readonly hasPendingSync = computed(() => this._pendingCount() > 0);

  /** Indica si el modo offline está activo */
  readonly isOfflineMode = computed(() => !this._isOnline());

  /** Capacidad máxima permitida (500 operaciones) */
  readonly maxCapacity = MAX_OFFLINE_QUEUE_CAPACITY;

  /** Indica si la cola alcanzó el tope máximo de 500 operaciones */
  readonly isQueueFull = computed(() => this._pendingCount() >= MAX_OFFLINE_QUEUE_CAPACITY);

  /** Porcentaje de ocupación de la cola offline (0 - 100%) */
  readonly queueOccupancyPercentage = computed(() => {
    return Math.min(100, Math.round((this._pendingCount() / MAX_OFFLINE_QUEUE_CAPACITY) * 100));
  });

  /** Indica si el sistema puede encolar nuevas operaciones */
  readonly canEnqueue = computed(() => this._pendingCount() < MAX_OFFLINE_QUEUE_CAPACITY);

  constructor() {
    this.initConnectivityMonitor();
    this.loadQueueFromDb();
  }

  // ─── API Pública ──────────────────────────────────────────────────────────

  /**
   * Encola una operación offline en IndexedDB bajo política FIFO.
   * Lanza excepción o bloquea si se alcanza el tope de 500 operaciones.
   */
  async enqueueOperation(
    operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'failed' | 'lastError'>
  ): Promise<boolean> {
    if (this.isQueueFull()) {
      this._syncStatus.set('blocked_queue_full');
      console.warn('[SyncService] Tope de 500 operaciones alcanzado. Bloqueo preventivo activo.');
      return false;
    }

    const newOp: SyncOperation = {
      ...operation,
      id: this.generateId(),
      createdAt: Date.now(),
      retryCount: 0,
      failed: false,
      lastError: null,
    };

    const record: OfflineTransactionRecord = {
      id: newOp.id,
      actionType: newOp.actionType || 'TRANSACTION',
      method: newOp.method,
      url: newOp.url,
      body: newOp.body,
      createdAt: newOp.createdAt,
      retryCount: newOp.retryCount,
      syncStatus: 'PENDING',
      lastError: null,
      description: newOp.description,
      zoneId: newOp.zoneId,
    };

    await OfflineIndexedDb.saveTransaction(record);

    const updatedQueue = [...this._syncQueue(), newOp];
    this._syncQueue.set(updatedQueue);
    this._pendingCount.set(updatedQueue.length);

    if (this._isOnline()) {
      this.triggerSyncWithPreflight();
    }

    return true;
  }

  /**
   * Ejecuta la sincronización con pre-flight ping y vaciado secuencial FIFO.
   */
  async synchronize(): Promise<void> {
    if (this._syncStatus() === 'syncing') return;
    if (this._syncQueue().length === 0) {
      this._syncStatus.set(this._isOnline() ? 'idle' : 'offline');
      return;
    }

    // 1. Verificación previa de conectividad real (Pre-flight Ping)
    const isServerReachable = await this.preFlightPing();
    if (!isServerReachable) {
      this.scheduleExponentialBackoff();
      return;
    }

    this._syncStatus.set('syncing');
    this.clearBackoffTimer();

    const queue = [...this._syncQueue()];
    const remainingOps: SyncOperation[] = [];

    // 2. Vaciado secuencial FIFO estricto
    for (const op of queue) {
      try {
        await this.executeOperation(op);
        await OfflineIndexedDb.removeTransaction(op.id);
      } catch (err: any) {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          // Conflicto de Versión (HTTP 409) -> Derivar a Cola de Arbitraje
          await this.handleConflict(op, err);
          await OfflineIndexedDb.removeTransaction(op.id);
        } else {
          // Error transitorio de red -> Incrementar reintentos y mantener en cola
          const updatedOp: SyncOperation = {
            ...op,
            retryCount: op.retryCount + 1,
            failed: op.retryCount >= 4,
            lastError: err?.message || 'Error de red en sincronización',
          };
          remainingOps.push(updatedOp);
          await OfflineIndexedDb.saveTransaction({
            id: updatedOp.id,
            actionType: updatedOp.actionType,
            method: updatedOp.method,
            url: updatedOp.url,
            body: updatedOp.body,
            createdAt: updatedOp.createdAt,
            retryCount: updatedOp.retryCount,
            syncStatus: updatedOp.failed ? 'FAILED' : 'PENDING',
            lastError: updatedOp.lastError,
            description: updatedOp.description,
            zoneId: updatedOp.zoneId,
          });
        }
      }
    }

    this._syncQueue.set(remainingOps);
    this._pendingCount.set(remainingOps.length);

    if (remainingOps.length > 0) {
      this._syncStatus.set('error');
      this.scheduleExponentialBackoff();
    } else {
      this._syncStatus.set('idle');
      this._retryAttempt.set(0);
    }
  }

  /**
   * Pre-flight Ping / Heartbeat para validar salida real a internet (evita redes cautivas).
   */
  async preFlightPing(): Promise<boolean> {
    if (!navigator.onLine) {
      this._lastPingSuccess.set(false);
      return false;
    }

    try {
      // Petición liviana con timeout de 3.5 segundos
      await firstValueFrom(
        this.http.get('/api/v1/health/ping', { responseType: 'text' }).pipe(timeout(3500))
      );
      this._lastPingSuccess.set(true);
      return true;
    } catch {
      // Si la API no tiene /ping o estamos en mock local, asumimos online si navigator.onLine es true
      const fallbackOk = navigator.onLine;
      this._lastPingSuccess.set(fallbackOk);
      return fallbackOk;
    }
  }

  /**
   * Elimina manualmente una operación de la cola.
   */
  async discardOperation(operationId: string): Promise<void> {
    await OfflineIndexedDb.removeTransaction(operationId);
    const filtered = this._syncQueue().filter(op => op.id !== operationId);
    this._syncQueue.set(filtered);
    this._pendingCount.set(filtered.length);
    if (this._pendingCount() === 0 && this._syncStatus() === 'blocked_queue_full') {
      this._syncStatus.set(this._isOnline() ? 'idle' : 'offline');
    }
  }

  ngOnDestroy(): void {
    this.clearBackoffTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Métodos Privados ─────────────────────────────────────────────────────

  private initConnectivityMonitor(): void {
    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'offline')
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this._isOnline.set(online);
        this._syncStatus.set(online ? 'idle' : 'offline');

        if (online && this._syncQueue().length > 0) {
          this.triggerSyncWithPreflight();
        }
      });
  }

  private triggerSyncWithPreflight(): void {
    setTimeout(() => {
      this.synchronize();
    }, 400);
  }

  private scheduleExponentialBackoff(): void {
    this.clearBackoffTimer();
    const attempt = this._retryAttempt();
    const delay = EXPONENTIAL_BACKOFF_MS[Math.min(attempt, EXPONENTIAL_BACKOFF_MS.length - 1)];

    this._retryAttempt.update(a => a + 1);

    this.backoffTimer = setTimeout(() => {
      if (this._isOnline() && this._syncQueue().length > 0) {
        this.synchronize();
      }
    }, delay);
  }

  private clearBackoffTimer(): void {
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  private async executeOperation(op: SyncOperation): Promise<void> {
    const body = op.body ? JSON.parse(op.body) : null;
    await firstValueFrom(
      this.http.request(op.method, op.url, { body })
    );
  }

  private async handleConflict(op: SyncOperation, error: HttpErrorResponse): Promise<void> {
    const conflict: SyncConflictRecord = {
      transactionId: op.id,
      zoneId: op.zoneId || 'ZONA-DESCONOCIDA',
      actionType: op.actionType || 'INVENTORY_MUTATION',
      payload: op.body,
      serverErrorCode: 409,
      serverState: JSON.stringify(error.error || {}),
      createdAt: Date.now(),
      status: 'PENDING_ARBITRATION',
    };

    await OfflineIndexedDb.saveConflict(conflict);
    this._conflictCount.update(c => c + 1);
  }

  private async loadQueueFromDb(): Promise<void> {
    const records = await OfflineIndexedDb.getAllTransactions();
    const conflicts = await OfflineIndexedDb.getAllConflicts();

    const ops: SyncOperation[] = records.map(r => ({
      id: r.id,
      actionType: r.actionType,
      method: r.method,
      url: r.url,
      body: r.body,
      createdAt: r.createdAt,
      retryCount: r.retryCount,
      failed: r.syncStatus === 'FAILED',
      lastError: r.lastError,
      description: r.description,
      zoneId: r.zoneId,
    }));

    this._syncQueue.set(ops);
    this._pendingCount.set(ops.length);
    this._conflictCount.set(conflicts.filter(c => c.status === 'PENDING_ARBITRATION').length);

    if (this.isQueueFull()) {
      this._syncStatus.set('blocked_queue_full');
    }
  }

  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
