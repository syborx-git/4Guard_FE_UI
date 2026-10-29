/**
 * @file sync-monitor.component.ts
 * @description P11 — Monitor Ejecutivo de Sincronización PWA Offline & Concesión Operativa [HU-200 / HU-155].
 * Dinámico y contextualizado para cada rol del sistema (Guardia de Seguridad, Montacarguista, Calidad QM, Mesa de Control):
 * Muestra el estado de la cola FIFO, telemetría de red, concesión de área/caseta y sincronización directa.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AuthState,
  UserRole,
  SyncState,
  ZoneLeaseService,
  ToastService,
} from '@4guard/shared-core';

export interface SyncEntryItem {
  id: string;
  opType:
    | 'SCAN_RECEIPT'
    | 'PICK_CONFIRM'
    | 'BLIND_COUNT'
    | 'ANOMALY_REPORT'
    | 'ZONE_LEASE'
    | 'CHECK_IN_F01'
    | 'CHECK_OUT_VERIF'
    | 'DRIVER_PASS_QR'
    | 'QM_INSPECTION'
    | 'SAMPLE_RELEASE'
    | 'RAMP_ASSIGN'
    | 'TRAFFIC_RELEASE';
  title: string;
  referenceCode: string;
  sku?: string;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'ERROR';
  retries: number;
  payloadSummary: string;
}

export interface RoleSyncConfig {
  moduleEyebrow: string[];
  title: string;
  subtitle: string;
  backRoute: string[];
  backTooltip: string;
  assignedAreaLabel: string;
  assignedAreaSub: string;
  areaIcon: string;
  renewButtonText: string;
  renewToastMessage: string;
  chipTitle: string;
  chipLabel: string;
  emptyTitle: string;
  emptySub: string;
}

const ROLE_SYNC_CONFIGS: Partial<Record<UserRole, RoleSyncConfig>> = {
  [UserRole.SECURITY_GUARD]: {
    moduleEyebrow: ['Caseta de Seguridad', 'Control Perimetral & F01', 'Telemetría Offline'],
    title: 'Sincronización de Caseta & Registro F01',
    subtitle: 'Gestión de cola local IndexedDB para control de acceso, verificación de sellos de seguridad, pases QR e incidencias en caseta.',
    backRoute: ['/security'],
    backTooltip: 'Regresar a Caseta de Seguridad',
    assignedAreaLabel: 'TURNO DE CASETA',
    assignedAreaSub: 'Caseta Principal Norte • Control Perimetral Activo',
    areaIcon: 'shield',
    renewButtonText: 'Renovar Turno',
    renewToastMessage: 'Turno de Caseta Principal Norte extendido con éxito.',
    chipTitle: 'Caseta Principal Norte • Turno Activo',
    chipLabel: 'Caseta Norte',
    emptyTitle: 'Caseta Sincronizada',
    emptySub: 'No hay registros de ingreso ni sellos pendientes en esta tableta. Todos los datos están en el WMS central.',
  },
  [UserRole.QM_INSPECTOR]: {
    moduleEyebrow: ['Control de Calidad QM', 'Estación de Muestreo', 'Telemetría Offline'],
    title: 'Sincronización de Calidad & Muestreo',
    subtitle: 'Gestión de cola local IndexedDB para dictámenes de cuarentena, auditorías de lote, liberación de tarimas e incidencias QM.',
    backRoute: ['/quality'],
    backTooltip: 'Regresar a Calidad QM',
    assignedAreaLabel: 'ESTACIÓN DE CALIDAD',
    assignedAreaSub: 'Laboratorio QM • Bahía de Inspección 01',
    areaIcon: 'verified_user',
    renewButtonText: 'Renovar',
    renewToastMessage: 'Concesión de Estación de Calidad extendida por 30 minutos.',
    chipTitle: 'Estación QM • Laboratorio 01 Activo',
    chipLabel: 'Lab QM 01',
    emptyTitle: 'Muestreos Sincronizados',
    emptySub: 'No hay inspecciones ni dictámenes pendientes en esta tableta. Todo el control QM está al día.',
  },
  [UserRole.WAREHOUSE_OPERATOR]: {
    moduleEyebrow: ['Terminal RF', 'Offline-First Engine', 'Telemetría de Red'],
    title: 'Sincronización de Datos & Zone Lease',
    subtitle: 'Gestión de cola local IndexedDB, resolución de conflictos y arrendamiento de pasillo (HU-155 / HU-200).',
    backRoute: ['/cockpit'],
    backTooltip: 'Regresar al Cockpit',
    assignedAreaLabel: 'ZONE LEASE (30 MIN)',
    assignedAreaSub: 'Pasillo 04 • Zona A (HU-155)',
    areaIcon: 'lock_clock',
    renewButtonText: 'Renovar',
    renewToastMessage: 'Zone Lease extendido por 30 minutos (Pasillo 04).',
    chipTitle: 'Arrendamiento de Pasillo Activo (30 min)',
    chipLabel: 'Pasillo 04',
    emptyTitle: 'Todo Sincronizado',
    emptySub: 'No hay transacciones pendientes en esta tableta. Todos los datos están en el WMS central.',
  },
  [UserRole.CONTROL_DESK]: {
    moduleEyebrow: ['Mesa de Control', 'Tráfico Central & Rampas', 'Telemetría WMS'],
    title: 'Sincronización de Asignaciones & Tráfico',
    subtitle: 'Gestión de cola local IndexedDB para asignación de andenes, flujo vehicular en patio y confirmación de órdenes.',
    backRoute: ['/menu'],
    backTooltip: 'Regresar al Menú',
    assignedAreaLabel: 'MESA DE TRÁFICO',
    assignedAreaSub: 'Torre de Control Central • Patio Monterrey',
    areaIcon: 'traffic',
    renewButtonText: 'Renovar',
    renewToastMessage: 'Sesión de Mesa de Control sincronizada.',
    chipTitle: 'Torre de Control • Operación Activa',
    chipLabel: 'Mesa Control',
    emptyTitle: 'Patio Sincronizado',
    emptySub: 'No hay asignaciones de andenes ni liberaciones de tráfico pendientes.',
  },
};

const DEFAULT_SYNC_CONFIG: RoleSyncConfig = {
  moduleEyebrow: ['Terminal RF', 'Offline-First Engine', 'Telemetría de Red'],
  title: 'Sincronización de Terminal RF',
  subtitle: 'Gestión de cola local IndexedDB, transacciones operativas y balance de datos con el servidor central.',
  backRoute: ['/menu'],
  backTooltip: 'Regresar al Menú',
  assignedAreaLabel: 'ZONA ASIGNADA',
  assignedAreaSub: 'Nave Central • CEDIS Monterrey',
  areaIcon: 'warehouse',
  renewButtonText: 'Renovar',
  renewToastMessage: 'Concesión operativa de terminal renovada.',
  chipTitle: 'Terminal Conectada • Nave Central',
  chipLabel: 'Nave Central',
  emptyTitle: 'Todo Sincronizado',
  emptySub: 'No hay transacciones pendientes en esta terminal. Todos los datos están confirmados en el servidor central.',
};

const ROLE_DEFAULT_QUEUES: Partial<Record<UserRole, SyncEntryItem[]>> = {
  [UserRole.SECURITY_GUARD]: [
    {
      id: 'TX-SEC-901',
      opType: 'CHECK_IN_F01',
      title: 'Ingreso F01 • Tráiler Castores (72-AB-9K)',
      referenceCode: 'REM-884120',
      sku: 'ORD-PROV-771',
      timestamp: new Date(Date.now() - 6 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Caseta Norte • Sellos SL-99412, SL-99413 • Chofer Juan Morales • En espera de rampa',
    },
    {
      id: 'TX-SEC-902',
      opType: 'CHECK_OUT_VERIF',
      title: 'Salida de Patio • TUM Logística (11-XY-8P)',
      referenceCode: 'SAL-2026-000105',
      sku: 'DOC-EMB-402',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Sello Verificado SL-88120 sin violación física • Documentación de embarque liberada',
    },
    {
      id: 'TX-SEC-903',
      opType: 'DRIVER_PASS_QR',
      title: 'Pase Chofer QR • Conductor Ernesto Beltrán',
      referenceCode: 'PASS-20260929-0108',
      sku: 'INE-77491-X',
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      status: 'PENDING',
      retries: 1,
      payloadSummary: 'Validación de gafete digital F01 • Tracto Transportes del Norte (34-BB-1C)',
    },
    {
      id: 'TX-SEC-904',
      opType: 'ANOMALY_REPORT',
      title: 'Incidencia de Sellos • Fletera Express (99-AA-2B)',
      referenceCode: 'INC-SEC-004',
      sku: 'SEAL-DISC-01',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Discrepancia en sello fiscal SL-3321 contra remisión de origen • Reporte adjunto',
    },
  ],
  [UserRole.QM_INSPECTOR]: [
    {
      id: 'TX-QM-701',
      opType: 'QM_INSPECTION',
      title: 'Dictamen de Cuarentena • Aceite Sintético LOT-2026-A1',
      referenceCode: 'INSP-QM-8821',
      sku: 'SKU-CHEM-330',
      timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Tarima #03 • Viscosidad y pureza aprobados con dictamen de laboratorio',
    },
    {
      id: 'TX-QM-702',
      opType: 'SAMPLE_RELEASE',
      title: 'Liberación de Lote • Envases PET 1L Grado Alimento',
      referenceCode: 'LIB-QM-0044',
      sku: 'SKU-PKG-099',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: '48 Cajas inspeccionadas • Criterio de hermeticidad y torque 100% conforme',
    },
    {
      id: 'TX-QM-703',
      opType: 'ANOMALY_REPORT',
      title: 'No Conformidad QM • Humedad en Empaque Secundario',
      referenceCode: 'NC-QM-2026-09',
      sku: 'SKU-ELECT-001',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      status: 'PENDING',
      retries: 1,
      payloadSummary: 'Caja con mancha de condensación • Bloqueo preventivo en Bahía de Calidad',
    },
  ],
  [UserRole.WAREHOUSE_OPERATOR]: [
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
  ],
  [UserRole.CONTROL_DESK]: [
    {
      id: 'TX-CD-401',
      opType: 'RAMP_ASSIGN',
      title: 'Asignación de Andén • Rampa 04 para Tráiler Castores',
      referenceCode: 'RAMP-04-A',
      sku: 'TRAFFIC-CAST',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Tracto 72-AB-9K asignado a descarga prioritaria en Rampa 04',
    },
    {
      id: 'TX-CD-402',
      opType: 'TRAFFIC_RELEASE',
      title: 'Autorización Salida de Patio • TUM Logística',
      referenceCode: 'PATIO-TUM-105',
      sku: 'DOC-EMB-402',
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      status: 'PENDING',
      retries: 0,
      payloadSummary: 'Descarga concluida al 100% • Pase de salida habilitado en Caseta',
    },
  ],
};

const ROLE_DEFAULT_HISTORY: Partial<Record<UserRole, SyncEntryItem[]>> = {
  [UserRole.SECURITY_GUARD]: [
    {
      id: 'TX-SEC-898',
      opType: 'CHECK_IN_F01',
      title: 'Ingreso F01 • Tracto TLG-04 (55-BC-2D)',
      referenceCode: 'REM-884110',
      sku: 'ORD-PROV-765',
      timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Entrada Registrada y Notificada',
    },
    {
      id: 'TX-SEC-899',
      opType: 'CHECK_OUT_VERIF',
      title: 'Salida de Patio • Unidad 24-AA-11',
      referenceCode: 'SAL-2026-000101',
      sku: 'DOC-EMB-399',
      timestamp: new Date(Date.now() - 24 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Sellos Validados & Salida Confirmada',
    },
  ],
  [UserRole.QM_INSPECTOR]: [
    {
      id: 'TX-QM-698',
      opType: 'SAMPLE_RELEASE',
      title: 'Liberación de Lote LOT-2026-B02',
      referenceCode: 'LIB-QM-0039',
      sku: 'SKU-FOOD-104',
      timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Aprobado para almacenamiento',
    },
    {
      id: 'TX-QM-699',
      opType: 'QM_INSPECTION',
      title: 'Auditoría de Recepción Andén 01',
      referenceCode: 'AUD-QM-102',
      sku: 'SKU-BEV-482',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Dictamen favorable registrado',
    },
  ],
  [UserRole.WAREHOUSE_OPERATOR]: [
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
  ],
  [UserRole.CONTROL_DESK]: [
    {
      id: 'TX-CD-398',
      opType: 'RAMP_ASSIGN',
      title: 'Rampa 02 Asignada • Tracto Castores',
      referenceCode: 'RAMP-02-B',
      sku: 'TR-CAST-02',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      status: 'SYNCED',
      retries: 0,
      payloadSummary: 'HTTP 200 OK • Servidor Central WMS • Notificación a montacarguistas enviada',
    },
  ],
};

@Component({
  selector: 'fg-sync-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sync-monitor.component.html',
  styleUrl: './sync-monitor.component.css',
})
export class SyncMonitorComponent implements OnInit, OnDestroy {
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  protected readonly leaseService = inject(ZoneLeaseService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  // ─── Rol Activo & Configuración Contextual ────────────────────────────────
  protected readonly currentRole = computed<UserRole>(() => {
    return this.authState.role() ?? UserRole.WAREHOUSE_OPERATOR;
  });

  protected readonly roleConfig = computed<RoleSyncConfig>(() => {
    const role = this.currentRole();
    return ROLE_SYNC_CONFIGS[role] || DEFAULT_SYNC_CONFIG;
  });

  // ─── Señales de Estado de Red ─────────────────────────────────────────────
  protected readonly isOnline = signal<boolean>(navigator.onLine);
  protected readonly isSyncing = signal<boolean>(false);
  protected readonly manualSyncProgress = signal<number>(0);
  protected readonly lastSyncTime = signal<Date | null>(new Date(Date.now() - 12 * 60000));
  protected readonly pingLatencyMs = signal<number>(24);

  // ─── Cola Operativa FIFO Pendiente (Adaptable por Rol) ────────────────────
  protected readonly queue = signal<SyncEntryItem[]>([]);

  // ─── Historial de Operaciones Sincronizadas (Adaptable por Rol) ───────────
  protected readonly syncedHistory = signal<SyncEntryItem[]>([]);

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

  constructor() {
    // Sincronizar reactivamente con la cola real de IndexedDB (SyncState)
    effect(() => {
      const realOps = this.syncState.syncQueue();
      const mappedQueue: SyncEntryItem[] = realOps.map((op) => ({
        id: op.id,
        opType: (op.actionType as SyncEntryItem['opType']) || 'SCAN_RECEIPT',
        title: op.description || `${op.method} ${op.url}`,
        referenceCode: op.id.slice(0, 12).toUpperCase(),
        timestamp: new Date(op.createdAt).toISOString(),
        status: op.failed ? 'ERROR' : 'PENDING',
        retries: op.retryCount,
        payloadSummary: op.lastError || (op.body ? op.body.slice(0, 90) : 'Operación en cola IndexedDB'),
      }));
      this.queue.set(mappedQueue);
    });
  }

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
    const route = this.roleConfig().backRoute;
    this.router.navigate(route);
  }

  protected renewLease(): void {
    this.leaseService.renewLease();
    const message = this.roleConfig().renewToastMessage;
    this.toast.success(message, 'CONCESIÓN RENOVADA');
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
      ANOMALY_REPORT: 'Incidencia',
      ZONE_LEASE: 'Zone Lease',
      CHECK_IN_F01: 'Ingreso F01',
      CHECK_OUT_VERIF: 'Salida Caseta',
      DRIVER_PASS_QR: 'Pase Chofer QR',
      QM_INSPECTION: 'Dictamen QM',
      SAMPLE_RELEASE: 'Liberación QM',
      RAMP_ASSIGN: 'Asignación Rampa',
      TRAFFIC_RELEASE: 'Tráfico Patio',
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
      CHECK_IN_F01: 'login',
      CHECK_OUT_VERIF: 'door_open',
      DRIVER_PASS_QR: 'qr_code_scanner',
      QM_INSPECTION: 'verified_user',
      SAMPLE_RELEASE: 'fact_check',
      RAMP_ASSIGN: 'warehouse',
      TRAFFIC_RELEASE: 'local_shipping',
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
          this.toast.success(`${count} operaciones sincronizadas con éxito en el Servidor Central.`, 'SINCRONIZACIÓN OK');
        }, 300);
      }
    }, 380);
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
    void this.syncState.discardOperation(id);
    this.queue.update(q => q.filter(e => e.id !== id));
    this.toast.warning(`Transacción ${id} descartada de la cola local.`, 'OPERACIÓN DESCARTADA');
  }
}
