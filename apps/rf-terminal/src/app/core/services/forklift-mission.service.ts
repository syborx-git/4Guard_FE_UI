/**
 * @file forklift-mission.service.ts
 * @description Servicio reactivo basado en Angular Signals para el Cockpit Unificado del Montacarguista.
 * Flujo Inbound ADR-017 / ADR-020:
 * - El Administrador define la Remisión, Producto y el catálogo de Lotes Autorizados.
 * - El Administrador NO predetermina cuántas tarimas vienen por cada lote.
 * - El Montacarguista descarga el camión, escanea cada tarima física, selecciona/asigna el lote correspondiente
 *   (con soporte de intercambio de lotes / embarque mixto en caliente), y concluye la descarga física (DISCHARGED).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { ToastService, UnitOfMeasure } from '@4guard/shared-core';
import { AudioFeedbackService } from './audio-feedback.service';
import { RfQualityStateService } from './rf-quality-state.service';

export type MovementType = 'INBOUND_UNLOAD' | 'INTERNAL_PUTAWAY' | 'OUTBOUND_DISPATCH';
export type MissionPriority = 'URGENT' | 'HIGH' | 'NORMAL';
export type MissionStatus = 'QUEUED' | 'ACTIVE_PICK' | 'ACTIVE_DROP' | 'DISCHARGED' | 'COMPLETED' | 'POSTPONED' | 'INCIDENT_HOLD';
export type CockpitFilter = 'ALL' | 'INBOUND' | 'INTERNAL' | 'OUTBOUND' | 'URGENT';

/**
 * Lote Autorizado / Habilitado por Mesa de Control para la Remisión
 */
export interface AuthorizedLotItem {
  lotNumber: string;
  expirationDate?: string;
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

const INITIAL_MISSIONS: ForkliftMission[] = [
  {
    id: 'mis-001',
    folio: 'MIS-INB-2026-081',
    type: 'INBOUND_UNLOAD',
    typeLabel: 'Descarga Inbound',
    priority: 'URGENT',
    priorityLabel: 'Urgente • Prioridad 4G',
    status: 'ACTIVE_PICK',
    statusLabel: 'En Descarga Activa (Andén)',
    originLocation: 'Rampa 03 (Andén Norte - Tráiler F-92)',
    originBarcode: 'RAMPA-03',
    destinationLocation: 'Buffer 01 (Zona de Descarga / Pre-clasificación)',
    destBarcode: 'LOC-BUFFER-01',
    ssccBarcode: 'SSCC-175012345000000018',
    sku: 'SKU-773091',
    productName: 'Aceite Sintético 5W-30 Ultra',
    supplierName: 'LUBRICANTES DE MÉXICO S.A. DE C.V.',
    lotNumber: 'LOT-2026-X99',
    quantity: 48,
    unit: 'Cajas por Tarima',
    weightKg: 840,
    transportPlate: '88-AA-1Z • Transportes Monclova',
    driverName: 'Armando Salazar',
    docNumber: 'REM-2026-881',
    carrierName: 'Transportes Monclova S.A.',
    rampNumber: 3,
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Andén R-03 / Buffer 01',
    slaCountdownMinutes: 8,
    arrivalTime: '14:22',
    notes: 'Mesa de Control autorizó Lote LOT-2026-X99 y Lote LOT-2026-Y02. El montacarguista escanea las tarimas físicas conforme salen del camión.',
    defaultPiecesPerPallet: 48,
    activeScanningLot: 'LOT-2026-X99',
    currentPendingPieces: 48,
    availableLots: [
      { lotNumber: 'LOT-2026-X99', expirationDate: '2027-12-31', isPrimary: true },
      { lotNumber: 'LOT-2026-Y02', expirationDate: '2028-06-30', isPrimary: false },
    ],
    pallets: [], // Se llena dinámicamente conforme el operador escanea
  },
  {
    id: 'mis-002',
    folio: 'MIS-PUT-2026-042',
    type: 'INTERNAL_PUTAWAY',
    typeLabel: 'Reubicación / Putaway',
    priority: 'HIGH',
    priorityLabel: 'Alta Prioridad',
    status: 'QUEUED',
    statusLabel: 'En Cola FIFO',
    originLocation: 'Buffer 02 (Recepción Lote A)',
    originBarcode: 'LOC-BUFFER-02',
    destinationLocation: 'Rack A-04-03 (Pasillo 04 - Nivel 3)',
    destBarcode: 'LOC-A04-03',
    ssccBarcode: 'SSCC-175012345000000029',
    sku: 'SKU-992140',
    productName: 'Filtros de Aire Heavy Duty HD-400 (36 Cajas)',
    lotNumber: 'LOT-2026-B12',
    quantity: 36,
    unit: 'Cajas (1 Pallet)',
    weightKg: 520,
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Pasillo 04',
    slaCountdownMinutes: 15,
    arrivalTime: '14:28',
    notes: 'Requiere Zone Lease Pasillo 04 activo. Nivel medio de elevación.',
  },
  {
    id: 'mis-003',
    folio: 'MIS-OUT-2026-015',
    type: 'OUTBOUND_DISPATCH',
    typeLabel: 'Carga de Salida (Despacho)',
    priority: 'URGENT',
    priorityLabel: 'Urgente • Salida en 20m',
    status: 'QUEUED',
    statusLabel: 'En Cola FIFO',
    originLocation: 'Stage Salidas ST-02 (Zona Consolidada)',
    originBarcode: 'LOC-STAGE-02',
    destinationLocation: 'Rampa 05 (Caja Fría 53ft - Tráiler Express)',
    destBarcode: 'RAMPA-05',
    ssccBarcode: 'SSCC-175012345000000055',
    sku: 'SKU-441029',
    productName: 'Líquido de Frenos DOT-4 Pro (60 Cajas)',
    lotNumber: 'LOT-2026-C01',
    quantity: 60,
    unit: 'Cajas (1 Pallet)',
    weightKg: 960,
    transportPlate: '44-BB-9K • Logística Express',
    driverName: 'Carlos Mendoza',
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Patio / Andén Salidas',
    slaCountdownMinutes: 10,
    arrivalTime: '14:31',
    notes: 'Embarque urgente con cita de salida 15:00 hrs.',
  },
  {
    id: 'mis-004',
    folio: 'MIS-INB-2026-082',
    type: 'INBOUND_UNLOAD',
    typeLabel: 'Descarga Inbound',
    priority: 'NORMAL',
    priorityLabel: 'Normal',
    status: 'QUEUED',
    statusLabel: 'En Cola FIFO',
    originLocation: 'Rampa 04 (Andén Sur - Tráiler R-10)',
    originBarcode: 'RAMPA-04',
    destinationLocation: 'Buffer 01 (Zona de Descarga / Pre-clasificación)',
    destBarcode: 'LOC-BUFFER-01',
    ssccBarcode: 'SSCC-175012345000000031',
    sku: 'SKU-552011',
    productName: 'Líquido Refrigerante Anticongelante 50/50',
    lotNumber: 'LOT-2026-M04',
    quantity: 40,
    unit: 'Cajas por Tarima',
    weightKg: 780,
    transportPlate: '12-ZZ-3P • Transportes del Norte',
    driverName: 'Jorge Valenzuela',
    docNumber: 'REM-2026-904',
    carrierName: 'Transportes del Norte S.A.',
    rampNumber: 4,
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Pasillo 04',
    slaCountdownMinutes: 25,
    arrivalTime: '14:35',
    notes: 'Embarque de producto químico refrigerante.',
    defaultPiecesPerPallet: 40,
    activeScanningLot: 'LOT-2026-M04',
    currentPendingPieces: 40,
    availableLots: [
      { lotNumber: 'LOT-2026-M04', expirationDate: '2028-11-30', isPrimary: true },
    ],
    pallets: [],
  },
  {
    id: 'mis-005',
    folio: 'MIS-PUT-2026-043',
    type: 'INTERNAL_PUTAWAY',
    typeLabel: 'Reubicación / Putaway',
    priority: 'NORMAL',
    priorityLabel: 'Normal',
    status: 'QUEUED',
    statusLabel: 'En Cola FIFO',
    originLocation: 'Buffer 03 (Cuarentena Liberada QM)',
    originBarcode: 'LOC-BUFFER-03',
    destinationLocation: 'Rack B-02-01 (Pasillo 02 - Nivel 1)',
    destBarcode: 'LOC-B02-01',
    ssccBarcode: 'SSCC-175012345000000080',
    sku: 'SKU-331002',
    productName: 'Bujías de Iridio Industrial (24 Cajas)',
    lotNumber: 'LOT-2026-K44',
    quantity: 24,
    unit: 'Cajas (1 Pallet)',
    weightKg: 310,
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Pasillo 02',
    slaCountdownMinutes: 35,
    arrivalTime: '14:40',
    notes: 'Liberado por control de calidad.',
  },
];

@Injectable({
  providedIn: 'root',
})
export class ForkliftMissionService {
  private readonly audioService = inject(AudioFeedbackService);
  private readonly qualityState = inject(RfQualityStateService);
  private readonly toast = inject(ToastService);

  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;

  // ─── Estado Reactivo Principal ─────────────────────────────────────────────
  private readonly rawMissions = signal<ForkliftMission[]>(INITIAL_MISSIONS);
  private readonly activeMissionId = signal<string | null>('mis-001');
  private readonly completedMissions = signal<ForkliftMission[]>([]);
  private readonly activeFilter = signal<CockpitFilter>('ALL');
  private readonly lastScanFeedback = signal<ScanFeedback | null>(null);

  constructor() {
    this.initRealtimeQualityAlertStream();
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

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        if (!this.sseReconnectTimer) {
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            this.initRealtimeQualityAlertStream();
          }, 10000);
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

    this.rawMissions.set([target, ...remaining]);
    this.activeMissionId.set(missionId);
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
    this.rawMissions.update((list) =>
      list.map((m) => {
        if (m.id !== missionId) return m;
        return {
          ...m,
          activeScanningLot: cleanLot,
          lotNumber: cleanLot,
        };
      })
    );
    this.audioService.playSuccess();
  }

  /**
   * Agregar un Lote Nuevo / No Previsto en caliente (Intercambio de Lote)
   */
  addCustomLot(missionId: string, customLot: string, reason?: string): void {
    const cleanLot = (customLot || '').trim().toUpperCase();
    if (!cleanLot) return;

    this.rawMissions.update((list) =>
      list.map((m) => {
        if (m.id !== missionId) return m;
        const lots = m.availableLots ? [...m.availableLots] : [];
        if (!lots.some((l) => l.lotNumber === cleanLot)) {
          lots.push({ lotNumber: cleanLot, isPrimary: false });
        }
        return {
          ...m,
          availableLots: lots,
          activeScanningLot: cleanLot,
          lotNumber: cleanLot,
          notes: `${m.notes || ''} [Lote agregado en andén: ${cleanLot} (${reason || 'Intercambio'})]`,
        };
      })
    );

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
    this.rawMissions.update((list) =>
      list.map((m) => (m.id === missionId ? { ...m, currentPendingPieces: pieces } : m))
    );
  }

  /**
   * Modificar el lote o piezas de una tarima ya escaneada previamente
   */
  swapPalletLot(missionId: string, palletId: string, newLot: string, pieces: number, reason: string): boolean {
    const cleanLot = (newLot || '').trim().toUpperCase();
    if (!cleanLot) return false;

    let targetPalletNum = 1;

    this.rawMissions.update((list) =>
      list.map((m) => {
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
          };
        });

        return {
          ...m,
          pallets: updatedPallets,
        };
      })
    );

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

        this.rawMissions.update((list) =>
          list.map((m) =>
            m.id === current.id
              ? {
                  ...m,
                  currentPendingSscc: finalSscc,
                  status: 'ACTIVE_DROP',
                  statusLabel: `En Tránsito (Tarima #${nextPalletNum} en curso)`,
                }
              : m
          )
        );

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

          this.rawMissions.update((list) =>
            list.map((m) =>
              m.id === current.id
                ? {
                    ...m,
                    pallets: updatedPallets,
                    ssccBarcode: nextNextSscc,
                    currentPendingSscc: undefined,
                    status: 'ACTIVE_PICK',
                    statusLabel: `En Descarga Activa (${updatedPallets.length} Tarimas en Buffer)`,
                  }
                : m
            )
          );

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

    if (remaining.length > 0) {
      const nextMission = remaining[0];
      this.activeMissionId.set(nextMission.id);
      this.rawMissions.update((q) =>
        q.map((m, idx) =>
          idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Descarga Activa / Pick' } : m
        )
      );
    } else {
      this.activeMissionId.set(null);
    }
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

    if (newQueue.length > 0) {
      this.activeMissionId.set(newQueue[0].id);
      this.rawMissions.update((q) => {
        return q.map((m, idx) => (idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m));
      });
    } else {
      this.activeMissionId.set(null);
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

    if (remaining.length > 0) {
      this.activeMissionId.set(remaining[0].id);
      this.rawMissions.update((q) => {
        return q.map((m, idx) => (idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m));
      });
    } else {
      this.activeMissionId.set(null);
    }

    this.lastScanFeedback.set({
      success: true,
      message: `Expediente de siniestro registrado. Tarima enviada a cuarentena virtual.`,
      phase: 'ANOMALY_HOLD',
    });

    this.audioService.playWarning();
  }

  /** Reiniciar cola demo con las 5 misiones de prueba */
  resetDemoQueue(): void {
    this.rawMissions.set(JSON.parse(JSON.stringify(INITIAL_MISSIONS)));
    this.activeMissionId.set('mis-001');
    this.completedMissions.set([]);
    this.lastScanFeedback.set(null);
    this.activeFilter.set('ALL');
    this.audioService.playSuccess();
  }

  // ─── Helpers Internos ──────────────────────────────────────────────────────

  private updateMissionStatus(missionId: string, status: MissionStatus, statusLabel: string): void {
    this.rawMissions.update((list) =>
      list.map((m) => (m.id === missionId ? { ...m, status, statusLabel } : m))
    );
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

    if (remaining.length > 0) {
      const nextMission = remaining[0];
      this.activeMissionId.set(nextMission.id);
      this.rawMissions.update((q) =>
        q.map((m, idx) =>
          idx === 0 ? { ...m, status: 'ACTIVE_PICK', statusLabel: 'En Curso (Esperando Pick)' } : m
        )
      );
    } else {
      this.activeMissionId.set(null);
    }
  }
}
