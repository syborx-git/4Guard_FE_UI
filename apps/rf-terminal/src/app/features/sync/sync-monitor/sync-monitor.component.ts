/**
 * @file sync-monitor.component.ts
 * @description P11 — Monitor Ejecutivo de Sincronización PWA Offline & Zone Lease [HU-200 / HU-155].
 * Simplificado y directo para operación industrial en piso:
 * Muestra el estado de la cola FIFO, conectividad, zone lease y botón de sincronización directa.
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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SyncState, ZoneLeaseService, ToastService } from '@4guard/shared-core';

export interface SyncEntryItem {
  id: string;
  opType: 'SCAN_RECEIPT' | 'PICK_CONFIRM' | 'BLIND_COUNT' | 'ANOMALY_REPORT' | 'ZONE_LEASE';
  title: string;
  referenceCode: string;
  sku?: string;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'ERROR';
  retries: number;
  payloadSummary: string;
}

@Component({
  selector: 'fg-sync-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sync-monitor.component.html',
  styleUrl: './sync-monitor.component.css',
})
export class SyncMonitorComponent implements OnInit, OnDestroy {
  protected readonly syncState = inject(SyncState);
  protected readonly leaseService = inject(ZoneLeaseService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  // ─── Señales de Estado ────────────────────────────────────────────────────
  protected readonly isOnline = signal<boolean>(navigator.onLine);
  protected readonly isSyncing = signal<boolean>(false);
  protected readonly manualSyncProgress = signal<number>(0);
  protected readonly lastSyncTime = signal<Date | null>(new Date(Date.now() - 12 * 60000));
  protected readonly pingLatencyMs = signal<number>(24);

  // ─── Cola Operativa FIFO Pendiente ────────────────────────────────────────
  protected readonly queue = signal<SyncEntryItem[]>([
    {
      id: 'TX-8901',
      opType: 'SCAN_RECEIPT',
      title: 'Recepción Tarima SSCC-0009',
      referenceCode: 'SSCC-175010009',
      sku: 'SKU-ELECT-001',
      timestamp: new Date(Date.now() - 6 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Andén 01 • 48 Cajas • Lote LOT-2026-A1',
    },
    {
      id: 'TX-8902',
      opType: 'BLIND_COUNT',
      title: 'Conteo Ciego Bahía P04-R02',
      referenceCode: 'RACK-P04-R02',
      sku: 'SKU-BEV-482',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Pasillo 04 • 2 Tarimas (96 Piezas Físicas)',
    },
    {
      id: 'TX-8903',
      opType: 'PICK_CONFIRM',
      title: 'Picking Ola ORD-001 Línea PL-001',
      referenceCode: 'ORD-001-PL01',
      sku: 'SKU-FOOD-104',
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      status: 'PENDING',
      retries: 1,
      payloadSummary: 'Línea 1 Confirmada • 12 Unidades Extraídas',
    },
    {
      id: 'TX-8904',
      opType: 'ANOMALY_REPORT',
      title: 'Anomalía Tarima Dañada ANO-240616-001',
      referenceCode: 'ANO-240616-001',
      sku: 'SKU-PKG-099',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Daño de tarima en maniobra • Evidencia fotográfica adjunta',
    },
  ]);

  // ─── Historial de Operaciones Sincronizadas ───────────────────────────────
  protected readonly syncedHistory = signal<SyncEntryItem[]>([
    {
      id: 'TX-8898',
      opType: 'SCAN_RECEIPT',
      title: 'Escaneo SSCC-0002',
      referenceCode: 'SSCC-175010002',
      sku: 'SKU-ELECT-001',
      timestamp: new Date(Date.now() - 16 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Commit exitoso',
    },
    {
      id: 'TX-8899',
      opType: 'PICK_CONFIRM',
      title: 'Picking ORD-003 Línea PL-003',
      referenceCode: 'ORD-003-PL03',
      sku: 'SKU-CHEM-330',
      timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Balance actualizado',
    },
  ]);

  // ─── Señales Computadas ───────────────────────────────────────────────────
  protected readonly pendingCount = computed(() => this.queue().length);
  protected readonly errorCount = computed(() => this.queue().filter(e => e.retries > 0).length);
  protected readonly maxCapacity = 500;
  protected readonly queueOccupancyPct = computed(() => Math.round((this.pendingCount() / this.maxCapacity) * 100));

  private onlineHandler = () => {
    this.isOnline.set(true);
    this.pingLatencyMs.set(Math.floor(Math.random() * 20) + 18);
  };
  private offlineHandler = () => {
    this.isOnline.set(false);
  };

  ngOnInit(): void {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Asegurar que hay un Zone Lease activo de demostración si no existe
    if (!this.leaseService.activeLease()) {
      this.leaseService.requestLease('ZONE-A-P04', 'Pasillo 04 (Zona A)');
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  // ─── Acciones Operativas ──────────────────────────────────────────────────
  protected goBack(): void {
    this.router.navigate(['/cockpit']);
  }

  protected renewLease(): void {
    this.leaseService.renewLease();
    this.toast.success('Zone Lease extendido por 30 minutos (Pasillo 04).', 'CONCESIÓN RENOVADA');
  }

  protected formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `hace ${mins} min`;
    return `hace ${Math.floor(mins / 60)}h`;
  }

  protected getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      SCAN_RECEIPT: 'Recepción',
      PICK_CONFIRM: 'Picking',
      BLIND_COUNT: 'Conteo Ciego',
      ANOMALY_REPORT: 'Anomalía',
      ZONE_LEASE: 'Zone Lease',
    };
    return labels[type] ?? type;
  }

  protected getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      SCAN_RECEIPT: 'move_to_inbox',
      PICK_CONFIRM: 'conveyor_belt',
      BLIND_COUNT: 'fact_check',
      ANOMALY_REPORT: 'warning',
      ZONE_LEASE: 'lock_clock',
    };
    return icons[type] ?? 'sync';
  }

  /**
   * Sincronización Manual FIFO con Animación y Preflight Ping
   */
  protected manualSync(): void {
    if (this.isSyncing() || !this.isOnline()) return;

    this.isSyncing.set(true);
    this.manualSyncProgress.set(10);
    this.toast.info(`Iniciando transmisión de ${this.queue().length} operaciones pendientes...`, 'SINCRONIZANDO');

    const pending = [...this.queue()];
    let processed = 0;

    const interval = setInterval(() => {
      processed++;
      const pct = Math.min(100, Math.round((processed / pending.length) * 100));
      this.manualSyncProgress.set(pct);

      if (processed >= pending.length) {
        clearInterval(interval);
        setTimeout(() => {
          this.syncedHistory.update(h => [
            ...pending.map(e => ({
              ...e,
              status: 'SYNCED' as const,
              payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Commit FIFO exitoso',
            })),
            ...h,
          ].slice(0, 25));

          const count = this.queue().length;
          this.queue.set([]);
          this.isSyncing.set(false);
          this.lastSyncTime.set(new Date());
          this.manualSyncProgress.set(0);
          this.toast.success(`${count} operaciones sincronizadas con éxito en el WMS Central.`, 'SINCRONIZACIÓN OK');
        }, 300);
      }
    }, 400);
  }

  /**
   * Conmutar estado simulado de red
   */
  protected toggleNetworkSimulation(): void {
    this.isOnline.update(on => !on);
    if (this.isOnline()) {
      this.pingLatencyMs.set(Math.floor(Math.random() * 25) + 15);
      this.toast.success('Conexión con el servidor central restablecida (Ping 200 OK).', 'RED EN LÍNEA');
    } else {
      this.toast.warning('Modo Offline activado. Las transacciones se guardarán localmente en IndexedDB.', 'MODO OFFLINE');
    }
  }

  /**
   * Eliminar una transacción específica de la cola
   */
  protected discardOperation(id: string): void {
    this.queue.update(q => q.filter(e => e.id !== id));
    this.toast.warning(`Transacción ${id} descartada de la cola local.`, 'OPERACIÓN DESCARTADA');
  }
}
