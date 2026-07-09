/**
 * @file sync-monitor.component.ts
 * @description P11 — Monitor de Sincronización PWA Offline [HU-200].
 * Muestra cola de operaciones pendientes, botón de sync manual,
 * indicador de conectividad y últimas N operaciones sincronizadas.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncState } from '@4guard/shared-core';

type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';

interface SyncEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: SyncStatus;
  retries: number;
}

@Component({
  selector: 'fg-sync-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sync-monitor.component.html',
  styleUrl: './sync-monitor.component.css',
})
export class SyncMonitorComponent implements OnInit, OnDestroy {
  protected readonly syncState = inject(SyncState);

  protected readonly isOnline = signal(navigator.onLine);
  protected readonly isSyncing = signal(false);
  protected readonly lastSync  = signal<Date | null>(null);
  protected readonly manualSyncProgress = signal(0);

  // Operaciones en cola (mock) para visualización
  protected readonly queue = signal<SyncEntry[]>([
    { id: 'SY-001', type: 'SCAN_RECEIPT',   description: 'Escaneo SSCC-0009 — Andén 01',         timestamp: new Date(Date.now() - 5  * 60000).toISOString(), status: 'PENDING', retries: 0 },
    { id: 'SY-002', type: 'SCAN_RECEIPT',   description: 'Escaneo SSCC-0001 — Andén 01',         timestamp: new Date(Date.now() - 4  * 60000).toISOString(), status: 'PENDING', retries: 0 },
    { id: 'SY-003', type: 'PICK_CONFIRM',   description: 'Picking ORD-001 línea PL-001',          timestamp: new Date(Date.now() - 2  * 60000).toISOString(), status: 'PENDING', retries: 1 },
    { id: 'SY-004', type: 'ANOMALY_REPORT', description: 'Anomalía ANO-240616-001',               timestamp: new Date(Date.now() - 1  * 60000).toISOString(), status: 'PENDING', retries: 0 },
  ]);

  protected readonly syncedHistory = signal<SyncEntry[]>([
    { id: 'SY-H01', type: 'SCAN_RECEIPT', description: 'Escaneo SSCC-0002 — sincronizado OK', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), status: 'SYNCED', retries: 0 },
    { id: 'SY-H02', type: 'PICK_CONFIRM', description: 'Picking ORD-003 línea PL-003',        timestamp: new Date(Date.now() - 20 * 60000).toISOString(), status: 'SYNCED', retries: 0 },
  ]);

  protected readonly pendingCount = computed(() => this.queue().length);
  protected readonly errorCount   = computed(() => this.queue().filter(e => e.retries > 0).length);

  private onlineHandler  = () => this.isOnline.set(true);
  private offlineHandler = () => this.isOnline.set(false);

  ngOnInit(): void {
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  protected formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Ahora mismo';
    if (mins < 60) return `hace ${mins} min`;
    return `hace ${Math.floor(mins / 60)}h`;
  }

  protected getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      SCAN_RECEIPT:   'Recepción',
      PICK_CONFIRM:   'Picking',
      ANOMALY_REPORT: 'Anomalía',
      ZONE_LEASE:     'Concesión',
    };
    return labels[type] ?? type;
  }

  protected manualSync(): void {
    if (this.isSyncing() || !this.isOnline()) return;

    this.isSyncing.set(true);
    this.manualSyncProgress.set(0);

    // Simulación de sincronización progresiva
    const pending = this.queue();
    let processed = 0;
    const interval = setInterval(() => {
      processed++;
      const pct = Math.round((processed / pending.length) * 100);
      this.manualSyncProgress.set(pct);

      if (processed >= pending.length) {
        clearInterval(interval);
        // Mover todo a historial
        this.syncedHistory.update(h => [
          ...pending.map(e => ({ ...e, status: 'SYNCED' as SyncStatus })),
          ...h,
        ].slice(0, 20));
        this.queue.set([]);
        this.isSyncing.set(false);
        this.lastSync.set(new Date());
        this.manualSyncProgress.set(0);
      }
    }, 500);
  }
}
