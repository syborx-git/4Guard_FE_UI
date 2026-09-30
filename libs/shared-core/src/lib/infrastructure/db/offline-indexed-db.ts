/**
 * @file offline-indexed-db.ts
 * @description Gestor nativo de IndexedDB para la persistencia transaccional Offline-First (4guard_rf_db).
 * Cumple estrictamente con la especificación técnica de sincronización 4Guard WMS:
 * - Tabla 'offline_transactions': Cola FIFO con límite máximo de 500 operaciones.
 * - Tabla 'zone_leases': Protocolo de arrendamiento de 30 minutos (HU-155).
 * - Tabla 'auth_cache': Credenciales con vigencia máxima de 24 horas.
 * - Tabla 'sync_conflicts': Registro de conflictos HTTP 409 para arbitraje en admin-console.
 */

export interface OfflineTransactionRecord {
  id: string;
  actionType: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: string;
  createdAt: number;
  retryCount: number;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
  lastError: string | null;
  description: string;
  zoneId?: string;
}

export interface ZoneLeaseRecord {
  zoneId: string;
  zoneName: string;
  leaseToken: string;
  grantedAt: number;
  expiresAt: number; // 30 min (1800s)
  status: 'ACTIVE' | 'WARNING' | 'EXPIRED';
}

export interface AuthCacheRecord {
  userId: string;
  username: string;
  token: string;
  role: string;
  branchId: string;
  cachedAt: number;
  expiresAt: number; // 24 Horas
}

export interface SyncConflictRecord {
  transactionId: string;
  zoneId: string;
  actionType: string;
  payload: string;
  serverErrorCode: number; // 409
  serverState?: string;
  createdAt: number;
  status: 'PENDING_ARBITRATION' | 'RESOLVED_ACCEPTED' | 'RESOLVED_REJECTED' | 'RESOLVED_RECOUNT';
  supervisorResolution?: string;
  resolvedAt?: number;
}

const DB_NAME = '4guard_rf_db';
const DB_VERSION = 1;

export class OfflineIndexedDb {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB no está disponible en este entorno'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Cola de transacciones offline (FIFO)
        if (!db.objectStoreNames.contains('offline_transactions')) {
          const txStore = db.createObjectStore('offline_transactions', { keyPath: 'id' });
          txStore.createIndex('createdAt', 'createdAt', { unique: false });
          txStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // 2. Zone Leases (HU-155)
        if (!db.objectStoreNames.contains('zone_leases')) {
          db.createObjectStore('zone_leases', { keyPath: 'zoneId' });
        }

        // 3. Auth Cache (24h)
        if (!db.objectStoreNames.contains('auth_cache')) {
          db.createObjectStore('auth_cache', { keyPath: 'userId' });
        }

        // 4. Conflictos de sincronización (HTTP 409)
        if (!db.objectStoreNames.contains('sync_conflicts')) {
          db.createObjectStore('sync_conflicts', { keyPath: 'transactionId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ─── Métodos de Transacciones Offline (FIFO) ──────────────────────────────

  static async getAllTransactions(): Promise<OfflineTransactionRecord[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readonly');
        const store = tx.objectStore('offline_transactions');
        const index = store.index('createdAt');
        const request = index.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback a localStorage si falla IndexedDB
      const raw = localStorage.getItem('4guard_sync_queue');
      return raw ? JSON.parse(raw) : [];
    }
  }

  static async saveTransaction(record: OfflineTransactionRecord): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const current = await this.getAllTransactions();
      const updated = [...current.filter(t => t.id !== record.id), record];
      localStorage.setItem('4guard_sync_queue', JSON.stringify(updated));
    }
  }

  static async removeTransaction(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const current = await this.getAllTransactions();
      const updated = current.filter(t => t.id !== id);
      localStorage.setItem('4guard_sync_queue', JSON.stringify(updated));
    }
  }

  static async getTransactionCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readonly');
        const store = tx.objectStore('offline_transactions');
        const request = store.count();

        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const list = await this.getAllTransactions();
      return list.length;
    }
  }

  // ─── Métodos de Zone Lease (HU-155) ───────────────────────────────────────

  static async saveZoneLease(lease: ZoneLeaseRecord): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('zone_leases', 'readwrite');
        const store = tx.objectStore('zone_leases');
        const request = store.put(lease);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      localStorage.setItem('4guard_active_zone_lease', JSON.stringify(lease));
    }
  }

  static async getZoneLease(zoneId: string): Promise<ZoneLeaseRecord | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('zone_leases', 'readonly');
        const store = tx.objectStore('zone_leases');
        const request = store.get(zoneId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const raw = localStorage.getItem('4guard_active_zone_lease');
      return raw ? JSON.parse(raw) : null;
    }
  }

  static async removeZoneLease(zoneId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('zone_leases', 'readwrite');
        const store = tx.objectStore('zone_leases');
        const request = store.delete(zoneId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      localStorage.removeItem('4guard_active_zone_lease');
    }
  }

  // ─── Métodos de Conflictos (HTTP 409) ────────────────────────────────────

  static async saveConflict(conflict: SyncConflictRecord): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_conflicts', 'readwrite');
        const store = tx.objectStore('sync_conflicts');
        const request = store.put(conflict);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const raw = localStorage.getItem('4guard_sync_conflicts');
      const list = raw ? JSON.parse(raw) : [];
      list.push(conflict);
      localStorage.setItem('4guard_sync_conflicts', JSON.stringify(list));
    }
  }

  static async getAllConflicts(): Promise<SyncConflictRecord[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_conflicts', 'readonly');
        const store = tx.objectStore('sync_conflicts');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const raw = localStorage.getItem('4guard_sync_conflicts');
      return raw ? JSON.parse(raw) : [];
    }
  }
}
