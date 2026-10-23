/**
 * @file forklift-mission.service.ts
 * @description Servicio reactivo basado en Angular Signals para el Cockpit Unificado del Montacarguista.
 * Flujo Inbound ADR-017 / ADR-020:
 * - El Administrador define la Remisión, Producto y el catálogo de Lotes Autorizados.
 * - El Administrador NO predetermina cuántas tarimas vienen por cada lote.
 * - El Montacarguista descarga el camión, escanea cada tarima física, selecciona/asigna el lote correspondiente
 *   (con soporte de intercambio de lotes / embarque mixto en caliente), y concluye la descarga física (DISCHARGED).
 */

import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ToastService, UnitOfMeasure, AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from './audio-feedback.service';
import { RfQualityStateService } from './rf-quality-state.service';
import { WarehouseLayoutSyncService } from './warehouse-layout-sync.service';
import { RfNotificationService } from './rf-notification.service';

export type MovementType = 'INBOUND_UNLOAD' | 'INTERNAL_PUTAWAY' | 'OUTBOUND_DISPATCH';
export type MissionPriority = 'URGENT' | 'HIGH' | 'NORMAL';
export type MissionStatus = 'QUEUED' | 'ACTIVE_PICK' | 'ACTIVE_DROP' | 'PARTIAL_DISCHARGED' | 'DISCHARGED' | 'COMPLETED' | 'POSTPONED' | 'INCIDENT_HOLD';
export type CockpitFilter = 'ALL' | 'INBOUND' | 'INTERNAL' | 'OUTBOUND' | 'URGENT';

/**
 * Información de Turno Operativo y Horario Asignado
 */
export interface ShiftScheduleInfo {
  id: string;
  code: string;
  name: string;
  startTime: string; // ej: "12:00"
  endTime: string;   // ej: "20:00"
  warningThresholdMinutes: number; // 15 minutos preventivos
}

export interface LotBreakdownItem {
  lotNumber: string;
  palletCount: number;
  totalPieces: number;
  isPrimary?: boolean;
  expirationDate?: string;
}

/**
 * Lote Autorizado / Habilitado por Mesa de Control para la Remisión
 */
export interface AuthorizedLotItem {
  lotNumber: string;
  expirationDate?: string;
  elaborationDate?: string;
  shelfLifePct?: number;
  isCompliant?: boolean;
  isPrimary?: boolean;
}

/**
 * Representación granular de cada tarima física (UA) escaneada y descargada por el montacarguista
 */
export interface InboundPalletItem {
  id: string;
  palletNumber: number; // 1, 2, 3...
  ssccBarcode: string;
  productId: string;
  productName: string;
  supplierName?: string;
  lotNumber: string;
  originalLotNumber?: string;
  isLotSwapped?: boolean;
  lotSwapReason?: string;
  expirationDate?: string;
  elaborationDate?: string;
  shelfLifePct?: number;
  isShelfLifeCompliant?: boolean;
  pieces: number;
  unit: string;
  weightKg: number;
  palletTypeLabel?: string;
  status: 'PENDING_SCAN' | 'PICKED' | 'STAGED';
  stagedAt?: string;
}

export interface ForkliftMission {
  id: string;
  folio: string;
  type: MovementType;
  typeLabel: string;
  priority: MissionPriority;
  priorityLabel: string;
  status: MissionStatus;
  statusLabel: string;
  originLocation: string;
  originBarcode: string;
  destinationLocation: string;
  destBarcode: string;
  ssccBarcode: string;
  sku: string;
  productName: string;
  supplierName?: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  weightKg: number;
  transportPlate?: string;
  driverName?: string;
  docNumber?: string;
  carrierName?: string;
  rampNumber?: number;
  assignedVehicle: string;
  assignedZoneLease: string;
  slaCountdownMinutes: number;
  arrivalTime: string;
  notes?: string;
  incidentReason?: string;
  photoEvidenceUrl?: string;
  completedAt?: string;
  // ── Dominio Inbound Dinámico (Mesa Control define Producto + Lotes; Montacargas escanea tarimas) ──
  totalExpectedPallets?: number;
  partialDischargedAt?: string;
  partialDischargeReason?: string;
  handoverNotes?: string;
  assignedOperatorName?: string;
  defaultPiecesPerPallet?: number;
  availableLots?: AuthorizedLotItem[];
  activeScanningLot?: string;
  currentPendingSscc?: string;
  currentPendingPieces?: number;
  pallets?: InboundPalletItem[]; // Manifiesto dinámico de tarimas escaneadas en andén
}

export interface ScanFeedback {
  success: boolean;
  message: string;
  phase: 'PICK_VALIDATED' | 'DROP_COMPLETED' | 'LOT_SWAPPED' | 'DISCHARGE_FINISHED' | 'ERROR' | 'ANOMALY_HOLD';
}

const BUFFER_STORAGE_KEY = '4g_forklift_missions_buffer';
const COMPLETED_STORAGE_KEY = '4g_forklift_completed_buffer';
const ACTIVE_MISSION_ID_KEY = '4g_forklift_active_id';
const PENDING_SYNC_QUEUE_KEY = '4g_forklift_pending_sync';
const RECEPTIONS_CACHE_KEY = '4g_warehouse_receptions_cache';

@Injectable({
  providedIn: 'root',
})
export class ForkliftMissionService {
  private readonly audioService = inject(AudioFeedbackService);
  private readonly qualityState = inject(RfQualityStateService);
  private readonly toast        = inject(ToastService);
  private readonly layoutSync   = inject(WarehouseLayoutSyncService);
  private readonly notifService = inject(RfNotificationService);
  private readonly authState    = inject(AuthState);
  private readonly http         = inject(HttpClient);
  private readonly platformId   = inject(PLATFORM_ID);

  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  private sseFailureCount = 0;
  private syncPollIntervalId: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  // ─── Estado Reactivo Principal con Buffer Offline ──────────────────────────
  private readonly rawMissions = signal<ForkliftMission[]>(this.loadBufferMissions());
  private readonly activeMissionId = signal<string | null>(this.loadActiveMissionId());
  private readonly completedMissions = signal<ForkliftMission[]>(this.loadCompletedBuffer());
  private readonly activeFilter = signal<CockpitFilter>('ALL');
  private readonly lastScanFeedback = signal<ScanFeedback | null>(null);

  // ─── Estado de Conexión y Telemetría en Vivo ──────────────────────────────
  public readonly isBackendConnected = signal<boolean>(true);
  public readonly isSyncing = signal<boolean>(false);
  public readonly lastSyncTime = signal<string>('En línea');
  public readonly pendingOfflineCount = signal<number>(this.getPendingSyncQueue().length);

  constructor() {
    this.initRealtimeQualityAlertStream();
    this.initCrossTabSync();
    this.initConnectivityListeners();
    this.loadMissionsFromBackend();
    this.startPeriodicSync();
  }

  // ─── Persistencia y Buffer Local (Offline-First para Tableta) ───────────────

  private loadBufferMissions(): ForkliftMission[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const stored = localStorage.getItem(BUFFER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Si el buffer de misiones está vacío, inicializar desde el cache de recepciones
      const recsCache = localStorage.getItem(RECEPTIONS_CACHE_KEY);
      if (recsCache) {
        const parsedRecs = JSON.parse(recsCache);
        if (Array.isArray(parsedRecs) && parsedRecs.length > 0) {
          const activeRecs = parsedRecs.filter((r: any) => r && r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
          return activeRecs.map((r: any) => this.mapReceptionToMission(r));
        }
      }
    } catch (_) {}
    return [];
  }

  public saveBufferMissions(missions: ForkliftMission[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(BUFFER_STORAGE_KEY, JSON.stringify(missions));
    } catch (_) {}
  }

  private loadCompletedBuffer(): ForkliftMission[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const stored = localStorage.getItem(COMPLETED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  }

  public saveCompletedBuffer(completed: ForkliftMission[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(completed.slice(0, 50)));
    } catch (_) {}
  }

  private loadActiveMissionId(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return localStorage.getItem(ACTIVE_MISSION_ID_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  public saveActiveMissionId(id: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (id) {
        localStorage.setItem(ACTIVE_MISSION_ID_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_MISSION_ID_KEY);
      }
    } catch (_) {}
  }

  private getPendingSyncQueue(): any[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  private enqueuePendingSync(item: any): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const queue = this.getPendingSyncQueue();
      queue.push(item);
      localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(queue));
      this.pendingOfflineCount.set(queue.length);
    } catch (_) {}
  }

  // ─── Mapeo de Recepciones Backend a Misiones de Montacargas ────────────────

  public mapReceptionToMission(rec: any): ForkliftMission {
    const rampNum = Number(rec.rampNumber || rec.checkIn?.rampNumber || 1);
    const folio = String(rec.docNumber || rec.remision || rec.folio || `REC-${String(rec.id || Date.now()).slice(-6)}`).trim();
    const client = rec.clientName || rec.client || rec.checkIn?.client || 'Cliente General';
    const carrier = rec.carrierName || rec.carrierLine || rec.checkIn?.carrierLine || 'Transportista';
    const plates = rec.tractorPlates || rec.plates || rec.checkIn?.tractorPlates || 'S/P';
    const driver = rec.driverName || rec.checkIn?.driverName || 'Operador Chofer';
    const sku = rec.sku || (rec.items && rec.items[0]?.sku) || 'SKU-INBOUND';
    const productName = rec.productName || (rec.items && rec.items[0]?.productName) || rec.description || `${client} - Carga Inbound`;
    const defaultLot = String(rec.lotNumber || (rec.items && rec.items[0]?.lotNumber) || `LOT-${new Date().getFullYear()}-01`).toUpperCase();
    const pieces = Number(rec.totalPieces || rec.pieces || (rec.items && rec.items[0]?.pieces) || 48);
    const expectedPallets = Number(rec.palletsExpected || rec.totalExpectedPallets || rec.totalPallets || 24);
    const weightKg = Number(rec.totalWeight || (pieces * 17.5) || 840);

    let availableLots: AuthorizedLotItem[] = [];
    if (Array.isArray(rec.availableLots) && rec.availableLots.length > 0) {
      availableLots = rec.availableLots.map((l: any) => ({
        lotNumber: String(l.lotNumber || l).trim().toUpperCase(),
        expirationDate: l.expirationDate,
        elaborationDate: l.elaborationDate,
        shelfLifePct: l.shelfLifePct,
        isCompliant: l.isCompliant ?? true,
        isPrimary: l.isPrimary ?? false,
      }));
    } else {
      availableLots = [{ lotNumber: defaultLot, isPrimary: true }];
    }

    const arrivalTime = rec.createdAt
      ? new Date(rec.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const status: MissionStatus = rec.status === 'PARTIAL_DISCHARGED'
      ? 'PARTIAL_DISCHARGED'
      : (rec.status === 'IN_PROGRESS' || rec.status === 'ACTIVE_PICK' ? 'ACTIVE_PICK' : 'QUEUED');

    return {
      id: String(rec.id || folio),
      folio: folio,
      type: 'INBOUND_UNLOAD',
      typeLabel: 'Descarga Inbound',
      priority: rec.priority || (rampNum ? 'URGENT' : 'NORMAL'),
      priorityLabel: rampNum ? `Rampa ${rampNum} • Asignada` : 'Normal',
      status: status,
      statusLabel: status === 'PARTIAL_DISCHARGED' ? 'Descarga Parcial (Reanudable)' : (status === 'ACTIVE_PICK' ? 'En Descarga Activa' : 'En Cola FIFO'),
      originLocation: `Rampa ${String(rampNum).padStart(2, '0')} (${carrier})`,
      originBarcode: `RAMPA-${String(rampNum).padStart(2, '0')}`,
      destinationLocation: `Buffer ${String(rampNum).padStart(2, '0')} (Zona de Descarga / Pre-clasificación)`,
      destBarcode: `LOC-BUFFER-${String(rampNum).padStart(2, '0')}`,
      ssccBarcode: `SSCC-175012345000000001`,
      sku: sku,
      productName: productName,
      supplierName: client,
      lotNumber: defaultLot,
      quantity: pieces,
      unit: 'Cajas por Tarima',
      weightKg: weightKg,
      transportPlate: `${plates} • ${carrier}`,
      driverName: driver,
      docNumber: folio,
      carrierName: carrier,
      rampNumber: rampNum,
      assignedVehicle: 'Montacargas Crown #07',
      assignedZoneLease: `Andén R-${String(rampNum).padStart(2, '0')} / Buffer`,
      slaCountdownMinutes: 30,
      arrivalTime: arrivalTime,
      notes: rec.notes || `Recepción registrada en Caseta / Mesa de Control. Operador: ${driver}.`,
      defaultPiecesPerPallet: pieces,
      totalExpectedPallets: expectedPallets,
      activeScanningLot: defaultLot,
      currentPendingPieces: pieces,
      availableLots: availableLots,
      pallets: rec.pallets || [],
    };
  }

  // ─── Conexión a la Base de Datos Backend ───────────────────────────────────

  private getOrgId(): string {
    const user = this.authState.user() as any;
    if (user?.organizationId && user.organizationId.length === 36 && user.organizationId !== '44444444-4444-4444-4444-444444444444') {
      return user.organizationId;
    }
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.organizationId && session.organizationId.length === 36) return session.organizationId;
      }
    } catch (_) {}
    return 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
  }

  public loadMissionsFromBackend(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isSyncing.set(true);

    const orgId = this.getOrgId();
    const params = new HttpParams().set('organizationId', orgId);

    this.http.get<any>(`/api/v1/warehouse-receptions`, { params }).subscribe({
      next: (res) => {
        this.isBackendConnected.set(true);
        this.isSyncing.set(false);
        this.lastSyncTime.set(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));

        const rawList = res?.data || res || [];
        if (Array.isArray(rawList)) {
          this.mergeBackendReceptionsWithBuffer(rawList);
        }
      },
      error: () => {
        this.isSyncing.set(false);
        this.isBackendConnected.set(false);
        // Fallback al cache local si el backend está momentáneamente inaccesible
        const localRecs = this.loadLocalReceptionsCache();
        if (localRecs.length > 0) {
          this.mergeBackendReceptionsWithBuffer(localRecs);
        }
      }
    });
  }

  private loadLocalReceptionsCache(): any[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(RECEPTIONS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  private mergeBackendReceptionsWithBuffer(backendList: any[]): void {
    const activeBackend = backendList.filter(
      (r: any) => r && r.status !== 'COMPLETED' && r.status !== 'CANCELLED'
    );

    const currentMissions = this.rawMissions();
    const completedList = this.completedMissions();

    const mergedList: ForkliftMission[] = [];
    const handledIds = new Set<string>();

    for (const rec of activeBackend) {
      const mapped = this.mapReceptionToMission(rec);
      const key = mapped.id;
      handledIds.add(key);

      // Si ya está completada localmente, omitir
      if (completedList.some((c) => c.id === key || c.folio === mapped.folio)) {
        continue;
      }

      // Si ya existía en la cola activa, preservar el progreso de escaneo del montacarguista
      const existing = currentMissions.find((m) => m.id === key || m.folio === mapped.folio);
      if (existing) {
        mergedList.push({
          ...mapped,
          status: existing.status,
          statusLabel: existing.statusLabel,
          activeScanningLot: existing.activeScanningLot,
          currentPendingPieces: existing.currentPendingPieces,
          currentPendingSscc: existing.currentPendingSscc,
          pallets: existing.pallets && existing.pallets.length > 0 ? existing.pallets : mapped.pallets,
          notes: existing.notes || mapped.notes,
        });
      } else {
        mergedList.push(mapped);
      }
    }

    // Mantener misiones internas (reubicaciones Putaway o despachos locales)
    for (const m of currentMissions) {
      if (!handledIds.has(m.id) && m.type !== 'INBOUND_UNLOAD') {
        mergedList.push(m);
      }
    }

    this.rawMissions.set(mergedList);
    this.saveBufferMissions(mergedList);

    // Si la misión activa no está en la lista, fijar la primera disponible
    const curActive = this.activeMissionId();
    if (!curActive || !mergedList.some((m) => m.id === curActive)) {
      if (mergedList.length > 0) {
        this.activeMissionId.set(mergedList[0].id);
        this.saveActiveMissionId(mergedList[0].id);
      } else {
        this.activeMissionId.set(null);
        this.saveActiveMissionId(null);
      }
    }
  }

  // ─── Eventos en Tiempo Real (BroadcastChannel & Storage Multi-Dispositivo) ─

  private initCrossTabSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('4guard_wms_events');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcastEvent(event.data);
        };
      }
    } catch (_) {}

    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === '4g_cross_tab_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingBroadcastEvent(parsed);
        } catch (_) {}
      } else if (e.key === RECEPTIONS_CACHE_KEY && e.newValue) {
        try {
          const list = JSON.parse(e.newValue);
          if (Array.isArray(list)) {
            this.mergeBackendReceptionsWithBuffer(list);
          }
        } catch (_) {}
      }
    });
  }

  private handleIncomingBroadcastEvent(event: any): void {
    if (!event) return;
    const type = event.type || event.category;
    const data = event.data || event.notification?.data || event;

    if (type === 'NEW_RECEPTION' || type === 'RECEIVING' || event.category === 'RECEIVING') {
      this.handleIncomingNewReception(data);
    }
  }

  private handleIncomingNewReception(recData: any): void {
    if (!recData) return;
    const mission = this.mapReceptionToMission(recData);

    // Evitar duplicar si ya está completada
    if (this.completedMissions().some((c) => c.id === mission.id || c.folio === mission.folio)) {
      return;
    }

    const current = this.rawMissions();
    const existingIndex = current.findIndex((m) => m.id === mission.id || m.folio === mission.folio);

    if (existingIndex >= 0) {
      const updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        rampNumber: mission.rampNumber,
        originLocation: mission.originLocation,
        originBarcode: mission.originBarcode,
        destinationLocation: mission.destinationLocation,
        destBarcode: mission.destBarcode,
        notes: mission.notes,
      };
      this.rawMissions.set(updated);
      this.saveBufferMissions(updated);
    } else {
      const nextList = [mission, ...current];
      this.rawMissions.set(nextList);
      this.saveBufferMissions(nextList);

      if (!this.activeMissionId() || current.length === 0) {
        this.activeMissionId.set(mission.id);
        this.saveActiveMissionId(mission.id);
      }

      // Alerta acústica en la Tableta
      this.audioService.playFriendlyArrivalChime(1.0);

      // Alerta háptica (Vibración de tableta Android)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 80, 150, 80, 250]);
      }

      // Notificación Toast en pantalla
      this.toast.success(
        `🚜 Nueva Remisión Inbound: Rampa ${mission.rampNumber || 1} • ${mission.folio} (${mission.supplierName})`,
        '¡NUEVA MISIÓN ASIGNADA!'
      );

      // Registrar en el Centro de Notificaciones de Terminal RF
      this.notifService.addReceptionAlert({
        id: mission.id,
        folio: mission.folio,
        client: mission.supplierName || 'Cliente',
        carrier: mission.carrierName || 'Transportista',
        rampNumber: mission.rampNumber,
        docNumber: mission.docNumber,
        driverName: mission.driverName,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        pieces: mission.quantity,
      });
    }
  }

  private startPeriodicSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.syncPollIntervalId = setInterval(() => {
      this.loadMissionsFromBackend();
      this.syncPendingQueue();
    }, 5000);
  }

  private initConnectivityListeners(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.addEventListener('online', () => {
      this.isBackendConnected.set(true);
      this.toast.success('Conexión con la Base de Datos restablecida.', '📶 EN LÍNEA');
      this.syncPendingQueue();
      this.loadMissionsFromBackend();
    });

    window.addEventListener('offline', () => {
      this.isBackendConnected.set(false);
      this.toast.warning('Operando en Modo Buffer Offline. Tus escaneos están protegidos en la tableta.', '📶 MODO OFFLINE');
    });
  }

  public syncPendingQueue(): void {
    const queue = this.getPendingSyncQueue();
    if (queue.length === 0) return;

    const remainingItems: any[] = [];

    for (const item of queue) {
      if (item.type === 'COMPLETE_RECEPTION') {
        this.http.post(`/api/v1/warehouse-receptions/${item.id}/complete`, item.payload).subscribe({
          next: () => {},
          error: () => {
            remainingItems.push(item);
          }
        });
      } else {
        remainingItems.push(item);
      }
    }

    try {
      localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(remainingItems));
      this.pendingOfflineCount.set(remainingItems.length);
    } catch (_) {}
  }

  /**
   * Conexión en tiempo real SSE con el broadcaster de Calidad de 4GUARD Backend
   */
  private initRealtimeQualityAlertStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      const clientId = 'RF-FORKLIFT-' + (Math.floor(Math.random() * 9000) + 1000);
      const sseUrl = `/api/v1/notifications/rf-stream?clientIdentifier=${clientId}`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.addEventListener('QM_BLOCK_ALERT', (e: MessageEvent) => {
        try {
          const alert = JSON.parse(e.data);
          this.handleQualityBlockAlert(alert);
        } catch {}
      });

      this.eventSource.addEventListener('QM_RELEASE_AUTHORIZED', (e: MessageEvent) => {
        try {
          const alert = JSON.parse(e.data);
          this.handleQualityReleaseAlert(alert);
        } catch {}
      });

      this.eventSource.addEventListener('QM_CONDITIONING_REQUIRED', (e: MessageEvent) => {
        try {
          const alert = JSON.parse(e.data);
          this.handleQualityConditioningAlert(alert);
        } catch {}
      });

      this.eventSource.onopen = () => {
        this.sseFailureCount = 0;
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.sseFailureCount++;
        const reconnectDelay = this.sseFailureCount >= 3 ? 60000 : 10000;
        if (!this.sseReconnectTimer) {
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            this.initRealtimeQualityAlertStream();
          }, reconnectDelay);
        }
      };
    } catch {
      // Offline fallback
    }
  }

  private handleQualityBlockAlert(alert: any): void {
    const sscc = alert.sscc;
    const reason = alert.reason || 'Retención preventiva por Calidad';
    const folio = alert.palletFolio || 'QM-ALERT';

    // 1. Sonar alarma grave de alta prioridad y vibrar fuertemente
    this.audioService.playError();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }

    // 2. Notificación Toast en pantalla RF
    this.toast.error(`Tarima ${sscc || folio} BLOQUEADA por Calidad: ${reason}`, '🚨 RETENCIÓN QM EN PISO');

    // 3. Registrar en el catálogo de bloques de Calidad de la Terminal RF
    if (sscc) {
      this.qualityState.blocks.update((prev) => {
        const exists = prev.some((b) => b.sscc === sscc || b.folio === folio);
        if (exists) return prev;
        return [
          {
            id: 'blk-' + Date.now(),
            folio: folio,
            sku: alert.sku || 'SKU-QM',
            description: alert.productName || 'Producto Retenido en Maniobra',
            clientId: 'cli-qm-alert',
            clientName: 'Control de Calidad',
            batchNumber: 'LOTE-QM',
            sscc: sscc,
            quantity: 1,
            unitOfMeasure: UnitOfMeasure.PALLET,
            locationId: alert.locationCode || 'BAHIA-QM',
            stage: 'STORAGE' as any,
            defectCategory: 'MATERIAL' as any,
            defectCriteria: [reason],
            severity: (alert.severity as any) || 'CRITICAL',
            status: 'BLOCKED' as any,
            reportedBy: 'Auditoría de Calidad (Sistema)',
            reportedAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            notes: `${reason} [Norma / Instructivo: ${alert.requiredInstruction || 'IT01-PO-GC-8.6-01'}]`,
            evidenceFiles: [],
          },
          ...prev,
        ];
      });
    }

    // 4. Si la misión activa coincide con la tarima bloqueada, congelarla inmediatamente en INCIDENT_HOLD
    const current = this.activeMission();
    if (current && (current.ssccBarcode === sscc || current.folio === folio || (current.pallets && current.pallets.some((p) => p.ssccBarcode === sscc)))) {
      this.rawMissions.update((list) =>
        list.map((m) =>
          m.id === current.id
            ? {
                ...m,
                status: 'INCIDENT_HOLD',
                statusLabel: '⚠️ DETENIDA POR CALIDAD (QM)',
                incidentReason: `Retención QM: ${reason} (Folio: ${folio}). Mover únicamente a Bahía de Cuarentena.`,
              }
            : m
        )
      );

      this.lastScanFeedback.set({
        success: false,
        message: `🚨 RETENCIÓN DE CALIDAD ACTIVA [${folio}]: ${reason}. Maniobra congelada. No traslade a rack estándar.`,
        phase: 'ANOMALY_HOLD',
      });
    }
  }

  private handleQualityReleaseAlert(alert: any): void {
    const sscc = alert.sscc;
    const folio = alert.palletFolio;

    this.audioService.playSuccess();
    this.toast.success(`Tarima ${sscc || folio} Liberada por Calidad (${alert.reason || 'Dictamen Aprobado'})`, '✅ LIBERACIÓN QM');

    if (sscc) {
      this.qualityState.blocks.update((prev) =>
        prev.map((b) => (b.sscc === sscc || b.folio === folio ? { ...b, status: 'RELEASED' as any } : b))
      );
    }
  }

  private handleQualityConditioningAlert(alert: any): void {
    this.audioService.playWarning();
    this.toast.warning(`Atención en Rampa ${alert.locationCode || 'Andén'}: ${alert.reason}`, '⚠️ ACONDICIONAMIENTO QM');
  }

  // ─── Signals Computados ───────────────────────────────────────────────────

  /** Misión activa en ejecución inmediata (Hero Card) */
  readonly activeMission = computed<ForkliftMission | null>(() => {
    const list = this.rawMissions();
    const id = this.activeMissionId();
    if (id) {
      const found = list.find((m) => m.id === id);
      if (found) return found;
    }
    const firstActive = list.find((m) => m.status === 'ACTIVE_PICK' || m.status === 'ACTIVE_DROP');
    if (firstActive) return firstActive;
    return list.length > 0 ? list[0] : null;
  });

  /** Cola de misiones pendientes filtrada según el tab seleccionado (excluye la misión activa) */
  readonly queuedMissions = computed<ForkliftMission[]>(() => {
    const list = this.rawMissions();
    const active = this.activeMission();
    const filter = this.activeFilter();

    const queue = active ? list.filter((m) => m.id !== active.id) : list;

    if (filter === 'ALL') return queue;
    if (filter === 'INBOUND') return queue.filter((m) => m.type === 'INBOUND_UNLOAD');
    if (filter === 'INTERNAL') return queue.filter((m) => m.type === 'INTERNAL_PUTAWAY');
    if (filter === 'OUTBOUND') return queue.filter((m) => m.type === 'OUTBOUND_DISPATCH');
    if (filter === 'URGENT') return queue.filter((m) => m.priority === 'URGENT');
    return queue;
  });

  /** Conteo en vivo de misiones para los badges del filtro */
  readonly counts = computed(() => {
    const all = this.rawMissions();
    const completed = this.completedMissions();

    return {
      all: all.length,
      inbound: all.filter((m) => m.type === 'INBOUND_UNLOAD').length,
      internal: all.filter((m) => m.type === 'INTERNAL_PUTAWAY').length,
      outbound: all.filter((m) => m.type === 'OUTBOUND_DISPATCH').length,
      urgent: all.filter((m) => m.priority === 'URGENT').length,
      completed: completed.length,
    };
  });

  /** Filtro activo actual */
  readonly currentFilter = computed(() => this.activeFilter());

  /** Último feedback de escaneo */
  readonly scanFeedback = computed(() => this.lastScanFeedback());

  /** Historial de completadas */
  readonly historyMissions = computed(() => this.completedMissions());

  // ─── Turnos y Horarios Operativos (Regla de Fin de Turno & Relevo) ───────────
  readonly currentShift = signal<ShiftScheduleInfo>({
    id: 'shift-vesp',
    code: 'TRN-VES-02',
    name: 'Turno Vespertino Almacén',
    startTime: '12:00',
    endTime: '20:00',
    warningThresholdMinutes: 15,
  });

  /** Minutos restantes del turno (Inicia en 14 min para activar alerta preventiva < 15 min) */
  readonly shiftMinutesRemaining = signal<number>(14);

  /** Estado reactivo del turno y si está dentro de la ventana crítica de fin de turno */
  readonly shiftStatus = computed(() => {
    const shift = this.currentShift();
    const remaining = this.shiftMinutesRemaining();
    return {
      ...shift,
      remainingMinutes: remaining,
      isNearShiftEnd: remaining > 0 && remaining <= shift.warningThresholdMinutes,
      isShiftEnded: remaining <= 0,
    };
  });

  /** Ajustar manualmente o simular minutos restantes de turno para pruebas */
  setMockShiftRemaining(minutes: number): void {
    this.shiftMinutesRemaining.set(minutes);
    if (minutes <= 15) {
      this.toast.warning(`⚠️ Aviso de Turno: Quedan ${minutes} min de jornada. Revisa tus descargas en andén.`);
      this.audioService.playWarning();
    }
  }

  /**
   * Obtener desglose consolidado de tarimas y piezas por cada lote de la misión
   */
  getLotBreakdown(mission: ForkliftMission): LotBreakdownItem[] {
    const pallets = mission.pallets || [];
    const map = new Map<string, { count: number; pieces: number }>();

    for (const p of pallets) {
      const lot = p.lotNumber || 'SIN-LOTE';
      const existing = map.get(lot) || { count: 0, pieces: 0 };
      existing.count += 1;
      existing.pieces += p.pieces || 0;
      map.set(lot, existing);
    }

    const available = mission.availableLots || [];
    return Array.from(map.entries()).map(([lotNumber, data]) => {
      const match = available.find((l) => l.lotNumber === lotNumber);
      return {
        lotNumber,
        palletCount: data.count,
        totalPieces: data.pieces,
        isPrimary: match?.isPrimary,
        expirationDate: match?.expirationDate,
      };
    });
  }

  // ─── Acciones Operativas del Montacarguista ─────────────────────────────────

  /** Cambiar tab de filtro contextual */
  setFilter(filter: CockpitFilter): void {
    this.activeFilter.set(filter);
    this.audioService.playSuccess();
  }

  /** Tomar una misión específica de la cola inmediatamente */
  takeMissionNow(missionId: string): void {
    const list = this.rawMissions();
    const targetIndex = list.findIndex((m) => m.id === missionId);
    if (targetIndex === -1) return;

    const target = { ...list[targetIndex], status: 'ACTIVE_PICK' as MissionStatus, statusLabel: 'En Descarga Activa (Andén)' };
    const remaining = list.filter((m) => m.id !== missionId);
    const updated = [target, ...remaining];

    this.rawMissions.set(updated);
    this.saveBufferMissions(updated);
    this.activeMissionId.set(missionId);
    this.saveActiveMissionId(missionId);

    this.lastScanFeedback.set({
      success: true,
      message: `Misión ${target.folio} activada con éxito. Procede al andén: ${target.originLocation}`,
      phase: 'PICK_VALIDATED',
    });

    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 80, 40]);
  }

  /**
   * Cambiar el Lote Activo para la siguiente tarima a escanear (Selección rápida entre los lotes autorizados por Admin)
   */
  setActiveScanningLot(missionId: string, lotNumber: string): void {
    const cleanLot = (lotNumber || '').trim().toUpperCase();
    this.rawMissions.update((list) => {
      const updated = list.map((m) => {
        if (m.id !== missionId) return m;
        return {
          ...m,
          activeScanningLot: cleanLot,
          lotNumber: cleanLot,
        };
      });
      this.saveBufferMissions(updated);
      return updated;
    });
    this.audioService.playSuccess();
  }

  /**
   * Agregar un Lote Nuevo / No Previsto en caliente (Intercambio de Lote)
   */
  addCustomLot(
    missionId: string,
    customLot: string,
    reason?: string,
    expirationDate?: string,
    elaborationDate?: string,
    shelfLifeEval?: { remainingPct?: number; isCompliant?: boolean }
  ): void {
    const cleanLot = (customLot || '').trim().toUpperCase();
    if (!cleanLot) return;

    this.rawMissions.update((list) => {
      const updated = list.map((m) => {
        if (m.id !== missionId) return m;
        const lots = m.availableLots ? [...m.availableLots] : [];
        if (!lots.some((l) => l.lotNumber === cleanLot)) {
          lots.push({
            lotNumber: cleanLot,
            expirationDate,
            elaborationDate,
            shelfLifePct: shelfLifeEval?.remainingPct,
            isCompliant: shelfLifeEval?.isCompliant,
            isPrimary: false,
          });
        }
        return {
          ...m,
          availableLots: lots,
          activeScanningLot: cleanLot,
          lotNumber: cleanLot,
          notes: `${m.notes || ''} [Lote agregado en andén: ${cleanLot} (${reason || 'Intercambio'}${expirationDate ? ` • Cad: ${expirationDate}` : ''})]`,
        };
      });
      this.saveBufferMissions(updated);
      return updated;
    });

    this.lastScanFeedback.set({
      success: true,
      message: `¡Lote [${cleanLot}] agregado a la remesa y seleccionado para escaneo!`,
      phase: 'LOT_SWAPPED',
    });
    this.audioService.playSuccess();
  }

  /**
   * Ajustar piezas de la tarima actual
   */
  setCurrentPendingPieces(missionId: string, pieces: number): void {
    if (pieces <= 0) return;
    this.rawMissions.update((list) => {
      const updated = list.map((m) => (m.id === missionId ? { ...m, currentPendingPieces: pieces } : m));
      this.saveBufferMissions(updated);
      return updated;
    });
  }

  /**
   * Modificar el lote o piezas de una tarima ya escaneada previamente
   */
  swapPalletLot(
    missionId: string,
    palletId: string,
    newLot: string,
    pieces: number,
    reason: string,
    expirationDate?: string,
    elaborationDate?: string,
    shelfLifeEval?: { remainingPct?: number; isCompliant?: boolean }
  ): boolean {
    const cleanLot = (newLot || '').trim().toUpperCase();
    if (!cleanLot) return false;

    let targetPalletNum = 1;

    this.rawMissions.update((list) => {
      const updated = list.map((m) => {
        if (m.id !== missionId) return m;

        const updatedPallets = (m.pallets || []).map((p) => {
          if (p.id !== palletId && p.ssccBarcode !== palletId) return p;
          targetPalletNum = p.palletNumber;
          const orig = p.originalLotNumber || p.lotNumber;
          return {
            ...p,
            lotNumber: cleanLot,
            originalLotNumber: orig,
            isLotSwapped: cleanLot !== orig,
            lotSwapReason: reason || 'Intercambio manual de lote por montacarguista',
            pieces: pieces > 0 ? pieces : p.pieces,
            expirationDate: expirationDate || p.expirationDate,
            elaborationDate: elaborationDate || p.elaborationDate,
            shelfLifePct: shelfLifeEval?.remainingPct ?? p.shelfLifePct,
            isShelfLifeCompliant: shelfLifeEval?.isCompliant ?? p.isShelfLifeCompliant,
          };
        });

        return {
          ...m,
          pallets: updatedPallets,
        };
      });
      this.saveBufferMissions(updated);
      return updated;
    });

    this.lastScanFeedback.set({
      success: true,
      message: `¡Tarima #${targetPalletNum} actualizada con Lote [${cleanLot}] (${pieces} pzas)!`,
      phase: 'LOT_SWAPPED',
    });

    this.audioService.playSuccess();
    return true;
  }

  /**
   * Procesador universal de escaneo láser (Pick SSCC -> Drop Destino -> Siguiente Tarima -> DISCHARGED)
   */
  processScan(scannedCode: string): ScanFeedback {
    const cleanCode = (scannedCode || '').trim().toUpperCase();
    const current = this.activeMission();

    if (!cleanCode) {
      const feedback: ScanFeedback = {
        success: false,
        message: 'Código de barras vacío o ilegible.',
        phase: 'ERROR',
      };
      this.lastScanFeedback.set(feedback);
      this.audioService.playError();
      return feedback;
    }

    if (!current) {
      const feedback: ScanFeedback = {
        success: false,
        message: 'No hay ninguna misión activa asignada en este momento.',
        phase: 'ERROR',
      };
      this.lastScanFeedback.set(feedback);
      this.audioService.playError();
      return feedback;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDA DE CALIDAD: RECHAZAR ESCANEO SI LA TARIMA ESTÁ RETENIDA (QM)
    // ─────────────────────────────────────────────────────────────────────────
    const blockedPallets = this.qualityState.blocks().filter(
      (b) => b.status === 'BLOCKED' || b.status === 'UNDER_INSPECTION'
    );
    const matchedBlock = blockedPallets.find(
      (b) =>
        b.sscc === cleanCode ||
        cleanCode.includes(b.sscc) ||
        (b.folio && cleanCode === b.folio.toUpperCase())
    );

    const isMovingToQmBay =
      current.destinationLocation.toUpperCase().includes('QM') ||
      current.destinationLocation.toUpperCase().includes('CUARENTENA') ||
      current.destBarcode.toUpperCase().includes('QM') ||
      current.destBarcode.toUpperCase().includes('BUFFER-03');

    if (matchedBlock && !isMovingToQmBay) {
      const feedback: ScanFeedback = {
        success: false,
        message: `🚨 TARIMA BLOQUEADA POR CALIDAD [${matchedBlock.folio || matchedBlock.sscc}]. Motivo: ${
          matchedBlock.notes || matchedBlock.defectCriteria?.join(', ') || 'Retención preventiva PNC'
        }. Solo permitido traslado a Bahía de Cuarentena (QM).`,
        phase: 'ERROR',
      };
      this.lastScanFeedback.set(feedback);
      this.audioService.playError();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 50, 150, 50, 200]);
      }
      return feedback;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // FLUJO INBOUND: ESCANEO LIBRE TARIMA POR TARIMA CON SELECCIÓN DE LOTE
    // ─────────────────────────────────────────────────────────────────────────
    if (current.type === 'INBOUND_UNLOAD') {
      const pallets = current.pallets || [];
      const nextPalletNum = pallets.length + 1;
      const activeLot = current.activeScanningLot || current.lotNumber || 'LOT-2026-X99';
      const pieces = current.currentPendingPieces || current.defaultPiecesPerPallet || 48;

      // FASE 1: VALIDAR / CAPTURAR PICK DE TARIMA (CÓDIGO SSCC)
      if (current.status === 'ACTIVE_PICK' || current.status === 'QUEUED') {
        // Asignar el SSCC escaneado o generado
        const finalSscc = cleanCode.startsWith('SSCC-') ? cleanCode : (cleanCode === current.originBarcode ? `SSCC-1750123450000000${String(nextPalletNum).padStart(2, '0')}` : cleanCode);

        this.rawMissions.update((list) => {
          const updated = list.map((m) =>
            m.id === current.id
              ? {
                  ...m,
                  currentPendingSscc: finalSscc,
                  status: 'ACTIVE_DROP' as MissionStatus,
                  statusLabel: `En Tránsito (Tarima #${nextPalletNum} en curso)`,
                }
              : m
          );
          this.saveBufferMissions(updated);
          return updated;
        });

        const feedback: ScanFeedback = {
          success: true,
          message: `¡Tarima #${nextPalletNum} capturada! [${finalSscc}] • Lote: [${activeLot}]. Traslada la carga a: ${current.destinationLocation}`,
          phase: 'PICK_VALIDATED',
        };
        this.lastScanFeedback.set(feedback);
        this.audioService.playSuccess();
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        return feedback;
      }

      // FASE 2: VALIDAR DEPÓSITO EN BUFFER / DESTINO (LOC-BUFFER-01)
      if (current.status === 'ACTIVE_DROP') {
        const isDestMatch = cleanCode === current.destBarcode.toUpperCase() ||
          cleanCode.includes(current.destBarcode.replace('LOC-', '')) ||
          cleanCode.includes('BUFFER');

        if (isDestMatch) {
          const nowStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          const sscc = current.currentPendingSscc || `SSCC-1750123450000000${String(nextPalletNum).padStart(2, '0')}`;

          const newPallet: InboundPalletItem = {
            id: `pal-inb-${Date.now()}-${nextPalletNum}`,
            palletNumber: nextPalletNum,
            ssccBarcode: sscc,
            productId: current.sku,
            productName: current.productName,
            supplierName: current.supplierName,
            lotNumber: activeLot,
            pieces: pieces,
            unit: 'Cajas',
            weightKg: pieces * 17.5,
            palletTypeLabel: 'Tarima CHEP Estándar',
            status: 'STAGED',
            stagedAt: nowStr,
          };

          const updatedPallets = [...pallets, newPallet];
          const nextNextSscc = `SSCC-1750123450000000${String(nextPalletNum + 1).padStart(2, '0')}`;

          this.rawMissions.update((list) => {
            const updated = list.map((m) =>
              m.id === current.id
                ? {
                    ...m,
                    pallets: updatedPallets,
                    ssccBarcode: nextNextSscc,
                    currentPendingSscc: undefined,
                    status: 'ACTIVE_PICK' as MissionStatus,
                    statusLabel: `En Descarga Activa (${updatedPallets.length} Tarimas en Buffer)`,
                  }
                : m
            );
            this.saveBufferMissions(updated);
            return updated;
          });

          const feedback: ScanFeedback = {
            success: true,
            message: `¡Tarima #${nextPalletNum} depositada con éxito en ${current.destinationLocation}! (${pieces} pzas, Lote: ${activeLot}). Listo para escanear la Tarima #${nextPalletNum + 1}.`,
            phase: 'DROP_COMPLETED',
          };
          this.lastScanFeedback.set(feedback);
          this.audioService.playSuccess();
          if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
          return feedback;
        } else {
          const feedback: ScanFeedback = {
            success: false,
            message: `Ubicación errónea. Destino asignado: [${current.destBarcode}] (${current.destinationLocation}). Escaneado: [${cleanCode}]`,
            phase: 'ERROR',
          };
          this.lastScanFeedback.set(feedback);
          this.audioService.playError();
          return feedback;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    if (current.status === 'ACTIVE_PICK' || current.status === 'QUEUED') {
      const isSsccMatch = cleanCode === current.ssccBarcode.toUpperCase() || cleanCode.includes(current.ssccBarcode.replace('SSCC-', ''));
      const isOriginMatch = cleanCode === current.originBarcode.toUpperCase();

      if (isSsccMatch || isOriginMatch) {
        this.updateMissionStatus(current.id, 'ACTIVE_DROP', 'En Tránsito (Dirígete al Destino)');
        const feedback: ScanFeedback = {
          success: true,
          message: `¡Pallet verificado con éxito! Transporta la carga hacia: ${current.destinationLocation}`,
          phase: 'PICK_VALIDATED',
        };
        this.lastScanFeedback.set(feedback);
        this.audioService.playSuccess();
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        return feedback;
      } else {
        const feedback: ScanFeedback = {
          success: false,
          message: `Código no coincide. Se esperaba SSCC: [${current.ssccBarcode}] o Ubicación: [${current.originBarcode}]. Escaneado: [${cleanCode}]`,
          phase: 'ERROR',
        };
        this.lastScanFeedback.set(feedback);
        this.audioService.playError();
        return feedback;
      }
    }

    if (current.status === 'ACTIVE_DROP') {
      const isDestMatch = cleanCode === current.destBarcode.toUpperCase() || cleanCode.includes(current.destBarcode.replace('LOC-', ''));

      if (isDestMatch) {
        this.completeMission(current.id);
        const feedback: ScanFeedback = {
          success: true,
          message: `¡Misión completada con éxito! Movimiento confirmado en ${current.destinationLocation}.`,
          phase: 'DROP_COMPLETED',
        };
        this.lastScanFeedback.set(feedback);
        this.audioService.playSuccess();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        return feedback;
      } else {
        const feedback: ScanFeedback = {
          success: false,
          message: `Ubicación errónea. Destino asignado: [${current.destBarcode}] (${current.destinationLocation}). Escaneado: [${cleanCode}]`,
          phase: 'ERROR',
        };
        this.lastScanFeedback.set(feedback);
        this.audioService.playError();
        return feedback;
      }
    }

    const feedback: ScanFeedback = {
      success: false,
      message: 'Misión en estado no operable.',
      phase: 'ERROR',
    };
    this.lastScanFeedback.set(feedback);
    this.audioService.playError();
    return feedback;
  }

  /** Concluir formalmente la descarga física Inbound (Estatus DISCHARGED según ADR-017 y ADR-020) */
  finishInboundDischarge(missionId: string): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    let finalPallets = target.pallets && target.pallets.length > 0 ? [...target.pallets] : [];

    // Si no escaneó ninguna, generar al menos la tarima que estaba en curso
    if (finalPallets.length === 0) {
      finalPallets = [
        {
          id: `pal-inb-${Date.now()}-1`,
          palletNumber: 1,
          ssccBarcode: target.ssccBarcode || 'SSCC-175012345000000018',
          productId: target.sku,
          productName: target.productName,
          supplierName: target.supplierName,
          lotNumber: target.activeScanningLot || target.lotNumber || 'LOT-2026-X99',
          pieces: target.defaultPiecesPerPallet || 48,
          unit: 'Cajas',
          weightKg: 840,
          palletTypeLabel: 'Tarima CHEP Estándar',
          status: 'STAGED',
          stagedAt: timeStr,
        },
      ];
    }

    const discharged: ForkliftMission = {
      ...target,
      status: 'DISCHARGED',
      statusLabel: 'Descarga Concluida (DISCHARGED)',
      pallets: finalPallets,
      completedAt: timeStr,
      notes: `${target.notes || ''} [Descarga física de ${finalPallets.length} tarimas concluida en andén a las ${timeStr}]`,
    };

    const remaining = list.filter((m) => m.id !== missionId);
    this.rawMissions.set(remaining);
    this.completedMissions.update((prev) => [discharged, ...prev]);

    // Persistir inmediatamente en Buffer Local de la Tableta
    this.saveBufferMissions(remaining);
    this.saveCompletedBuffer(this.completedMissions());

    // Sincronizar ocupación de bahía en Layout 2D tras concluir descarga física
    const targetBay = target.destBarcode || target.destinationLocation;
    if (targetBay && !targetBay.startsWith('RAMPA') && !targetBay.includes('RAMPA-')) {
      this.layoutSync.recordMovement(
        targetBay,
        finalPallets.length,
        target.productName,
        target.activeScanningLot || target.lotNumber,
        target.folio,
        target.assignedVehicle || 'Montacargas'
      );
    }

    // Enviar conclusión formal a la Base de Datos Backend
    const totalPzas = finalPallets.reduce((acc, p) => acc + (p.pieces || 0), 0);
    const completePayload = {
      status: 'DISCHARGED',
      completedAt: new Date().toISOString(),
      palletsScanned: finalPallets,
      totalPieces: totalPzas,
      notes: discharged.notes,
      operatorName: this.authState.userFullName() || 'Montacarguista',
    };

    this.http.post<any>(`/api/v1/warehouse-receptions/${missionId}/complete`, completePayload).subscribe({
      next: () => {
        this.isBackendConnected.set(true);
        this.toast.success(`Descarga ${discharged.folio} guardada en Base de Datos.`, '✅ BD ACTUALIZADA');
      },
      error: () => {
        // Encolar en buffer offline para sincronizar al volver la red
        this.enqueuePendingSync({
          type: 'COMPLETE_RECEPTION',
          id: missionId,
          payload: completePayload,
          timestamp: Date.now(),
        });
        this.toast.info(`Descarga física protegida en el buffer de la tableta. Se enviará a la BD al reconectar.`, '📶 BUFFER OFFLINE');
      }
    });

    if (remaining.length > 0) {
      const nextMission = remaining[0];
      this.activeMissionId.set(nextMission.id);
      this.saveActiveMissionId(nextMission.id);
      this.rawMissions.update((q) =>
        q.map((m, idx) =>
          idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Descarga Activa / Pick' } : m
        )
      );
    } else {
      this.activeMissionId.set(null);
      this.saveActiveMissionId(null);
    }
  }

  /**
   * Registrar Descarga Parcial (Corte de maniobra por fin de turno o relevo)
   * Guarda las tarimas ya descargadas en buffer y deja la remisión pausada.
   */
  recordPartialDischarge(missionId: string, handoverNotes?: string): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const currentPallets = target.pallets || [];
    const expected = target.totalExpectedPallets || 24;

    const partialMission: ForkliftMission = {
      ...target,
      status: 'PARTIAL_DISCHARGED',
      statusLabel: `Descarga Parcial (${currentPallets.length} de ${expected} Tarimas listas)`,
      partialDischargedAt: timeStr,
      partialDischargeReason: 'Fin de turno operativo / Relevo de montacarguista',
      handoverNotes: handoverNotes || `Pausada a las ${timeStr}. ${currentPallets.length} tarimas en buffer. Pendientes por descargar.`,
      notes: `${target.notes || ''} [Corte parcial a las ${timeStr}: ${currentPallets.length} tarimas bajadas al andén]`,
    };

    // Sincronizar en Layout de Almacén
    const targetBay = target.destBarcode || target.destinationLocation;
    if (targetBay && currentPallets.length > 0) {
      this.layoutSync.recordMovement(
        targetBay,
        currentPallets.length,
        target.productName,
        target.activeScanningLot || target.lotNumber,
        target.folio,
        target.assignedVehicle || 'Montacargas'
      );
    }

    // Mantener la misión en la lista pero con estatus PARTIAL_DISCHARGED y guardar en buffer
    const updatedList = list.map((m) => (m.id === missionId ? partialMission : m));
    this.rawMissions.set(updatedList);
    this.saveBufferMissions(updatedList);

    // Enviar actualización de parámetros a la Base de Datos
    this.http.put<any>(`/api/v1/warehouse-receptions/${missionId}/parameters`, {
      status: 'PARTIAL_DISCHARGED',
      palletsScanned: currentPallets,
      handoverNotes: partialMission.handoverNotes,
      partialDischargedAt: new Date().toISOString(),
    }).subscribe({
      next: () => this.isBackendConnected.set(true),
      error: () => this.isBackendConnected.set(false),
    });

    // Si la misión activa era esta, pasar a la siguiente disponible o dejar null
    const otherActives = updatedList.filter((m) => m.id !== missionId && m.status !== 'PARTIAL_DISCHARGED');
    if (otherActives.length > 0) {
      this.activeMissionId.set(otherActives[0].id);
      this.saveActiveMissionId(otherActives[0].id);
      this.rawMissions.update((q) =>
        q.map((m) => (m.id === otherActives[0].id ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Descarga Activa / Pick' } : m))
      );
    } else {
      this.activeMissionId.set(null);
      this.saveActiveMissionId(null);
    }

    const feedback: ScanFeedback = {
      success: true,
      message: `⏸️ Descarga Parcial registrada [${partialMission.folio}]. ${currentPallets.length} tarimas guardadas en buffer. Notificado a Mesa de Control para relevo.`,
      phase: 'DISCHARGE_FINISHED',
    };
    this.lastScanFeedback.set(feedback);
    this.toast.warning(`Descarga parcial registrada: ${currentPallets.length} tarimas guardadas en buffer.`);
    this.audioService.playWarning();
  }

  /**
   * Reanudar una descarga parcial (cuando un montacarguista toma el relevo o le reabren la remisión)
   */
  resumePartialDischarge(missionId: string): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const currentPallets = target.pallets || [];
    const nextPalletNum = currentPallets.length + 1;
    const nextSscc = `SSCC-1750123450000000${String(nextPalletNum).padStart(2, '0')}`;

    const resumedMission: ForkliftMission = {
      ...target,
      status: 'ACTIVE_PICK',
      statusLabel: `En Descarga Activa (Continuando Tarima #${nextPalletNum})`,
      ssccBarcode: nextSscc,
      priority: 'URGENT',
      priorityLabel: 'Reanudada • Prioridad 4G',
      notes: `${target.notes || ''} [Reanudada por operador a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}]`,
    };

    const remaining = list.filter((m) => m.id !== missionId);
    const updated = [resumedMission, ...remaining];
    this.rawMissions.set(updated);
    this.saveBufferMissions(updated);
    this.activeMissionId.set(missionId);
    this.saveActiveMissionId(missionId);

    const feedback: ScanFeedback = {
      success: true,
      message: `¡Descarga reanudada! ${currentPallets.length} tarimas previas conservadas. Escanea la Tarima #${nextPalletNum}.`,
      phase: 'PICK_VALIDATED',
    };
    this.lastScanFeedback.set(feedback);
    this.toast.success(`¡Remisión reanudada! Continúa con la tarima #${nextPalletNum}.`);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  }

  /** Posponer la misión actual al final de la cola */
  postponeMission(missionId: string, reason = 'Pospuesta por el operador (obstrucción de pasillo o espera de andén)'): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const updatedTarget: ForkliftMission = {
      ...target,
      status: 'QUEUED',
      statusLabel: 'Pospuesta (Al final de la cola)',
      notes: `${target.notes || ''} [Pospuesta: ${reason}]`,
    };

    const remaining = list.filter((m) => m.id !== missionId);
    const newQueue = [...remaining, updatedTarget];
    this.rawMissions.set(newQueue);
    this.saveBufferMissions(newQueue);

    if (newQueue.length > 0) {
      this.activeMissionId.set(newQueue[0].id);
      this.saveActiveMissionId(newQueue[0].id);
      this.rawMissions.update((q) => {
        return q.map((m, idx) => (idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m));
      });
    } else {
      this.activeMissionId.set(null);
      this.saveActiveMissionId(null);
    }

    this.lastScanFeedback.set({
      success: true,
      message: `Misión ${target.folio} movida al final de la cola. Nueva misión activa asignada.`,
      phase: 'PICK_VALIDATED',
    });

    this.audioService.playWarning();
  }

  /** Reportar anomalía o daño de pallet y bloquear misión para QM */
  reportAnomaly(missionId: string, incidentType: string, note: string, photoEvidenceUrl?: string): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const flagged: ForkliftMission = {
      ...target,
      status: 'INCIDENT_HOLD',
      statusLabel: 'Bloqueada por Siniestro / QM',
      incidentReason: `${incidentType}: ${note}`,
      photoEvidenceUrl: photoEvidenceUrl || 'assets/mock-damaged-pallet.jpg',
    };

    const remaining = list.filter((m) => m.id !== missionId);
    this.rawMissions.set(remaining);
    this.completedMissions.update((prev) => [flagged, ...prev]);

    this.saveBufferMissions(remaining);
    this.saveCompletedBuffer(this.completedMissions());

    if (remaining.length > 0) {
      this.activeMissionId.set(remaining[0].id);
      this.saveActiveMissionId(remaining[0].id);
      this.rawMissions.update((q) => {
        return q.map((m, idx) => (idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m));
      });
    } else {
      this.activeMissionId.set(null);
      this.saveActiveMissionId(null);
    }

    this.lastScanFeedback.set({
      success: true,
      message: `Expediente de siniestro registrado. Tarima enviada a cuarentena virtual.`,
      phase: 'ANOMALY_HOLD',
    });

    this.audioService.playWarning();
  }

  /**
   * Refrescar y sincronizar misiones directamente con la Base de Datos
   */
  refreshMissions(): void {
    this.loadMissionsFromBackend();
    this.syncPendingQueue();
    this.audioService.playSuccess();
  }

  /**
   * Alias de compatibilidad: redirige al sincronizador con la Base de Datos
   */
  resetDemoQueue(): void {
    this.refreshMissions();
  }

  // ─── Helpers Internos ──────────────────────────────────────────────────────

  private updateMissionStatus(missionId: string, status: MissionStatus, statusLabel: string): void {
    this.rawMissions.update((list) => {
      const updated = list.map((m) => (m.id === missionId ? { ...m, status, statusLabel } : m));
      this.saveBufferMissions(updated);
      return updated;
    });
  }

  private completeMission(missionId: string): void {
    const list = this.rawMissions();
    const target = list.find((m) => m.id === missionId);
    if (!target) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const completed: ForkliftMission = {
      ...target,
      status: 'COMPLETED',
      statusLabel: 'Completada con Éxito',
      completedAt: timeStr,
    };

    const remaining = list.filter((m) => m.id !== missionId);
    this.rawMissions.set(remaining);
    this.completedMissions.update((prev) => [completed, ...prev]);

    this.saveBufferMissions(remaining);
    this.saveCompletedBuffer(this.completedMissions());

    // Sincronizar ocupación de bahía o rack en Layout 2D tras completar movimiento
    const targetBay = target.destBarcode || target.destinationLocation;
    if (targetBay && !targetBay.startsWith('RAMPA') && !targetBay.includes('RAMPA-')) {
      this.layoutSync.recordMovement(
        targetBay,
        1,
        target.productName,
        target.lotNumber,
        target.folio,
        target.assignedVehicle || 'Montacargas'
      );
    }

    if (remaining.length > 0) {
      const nextMission = remaining[0];
      this.activeMissionId.set(nextMission.id);
      this.saveActiveMissionId(nextMission.id);
      this.rawMissions.update((q) =>
        q.map((m, idx) =>
          idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m
        )
      );
    } else {
      this.activeMissionId.set(null);
      this.saveActiveMissionId(null);
    }
  }
}
