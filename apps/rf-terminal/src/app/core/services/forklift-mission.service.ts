/**
 * @file forklift-mission.service.ts
 * @description Servicio reactivo basado en Angular Signals para el Cockpit Unificado del Montacarguista.
 * Gestiona el flujo FIFO dinámico de misiones unificadas (Descargas Inbound, Reubicaciones Putaway, Cargas Outbound),
 * validaciones 1-Scan de láser (Pick SSCC -> Drop Destino -> Done), aplazamientos, toma directa y reporte de anomalías.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { AudioFeedbackService } from './audio-feedback.service';

export type MovementType = 'INBOUND_UNLOAD' | 'INTERNAL_PUTAWAY' | 'OUTBOUND_DISPATCH';
export type MissionPriority = 'URGENT' | 'HIGH' | 'NORMAL';
export type MissionStatus = 'QUEUED' | 'ACTIVE_PICK' | 'ACTIVE_DROP' | 'COMPLETED' | 'POSTPONED' | 'INCIDENT_HOLD';
export type CockpitFilter = 'ALL' | 'INBOUND' | 'INTERNAL' | 'OUTBOUND' | 'URGENT';

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
  lotNumber: string;
  quantity: number;
  unit: string;
  weightKg: number;
  transportPlate?: string;
  driverName?: string;
  assignedVehicle: string;
  assignedZoneLease: string;
  slaCountdownMinutes: number;
  arrivalTime: string;
  notes?: string;
  incidentReason?: string;
  photoEvidenceUrl?: string;
  completedAt?: string;
}

export interface ScanFeedback {
  success: boolean;
  message: string;
  phase: 'PICK_VALIDATED' | 'DROP_COMPLETED' | 'ERROR' | 'ANOMALY_HOLD';
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
    statusLabel: 'En Curso (Esperando Pick)',
    originLocation: 'Rampa 03 (Andén Norte - Tráiler F-92)',
    originBarcode: 'RAMPA-03',
    destinationLocation: 'Buffer 01 (Zona de Descarga / Pre-clasificación)',
    destBarcode: 'LOC-BUFFER-01',
    ssccBarcode: 'SSCC-175012345000000018',
    sku: 'SKU-773091',
    productName: 'Aceite Sintético 5W-30 Ultra (48 Cajas)',
    lotNumber: 'LOT-2026-X99',
    quantity: 48,
    unit: 'Cajas (1 Pallet)',
    weightKg: 840,
    transportPlate: '88-AA-1Z • Transportes Monclova',
    driverName: 'Armando Salazar',
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Pasillo 04',
    slaCountdownMinutes: 8,
    arrivalTime: '14:22',
    notes: 'Tarima de alta rotación. Desembarcar y posicionar en buffer para QM.',
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
    originLocation: 'Rampa 03 (Andén Norte - Tráiler F-92)',
    originBarcode: 'RAMPA-03',
    destinationLocation: 'Buffer 01 (Zona de Descarga / Pre-clasificación)',
    destBarcode: 'LOC-BUFFER-01',
    ssccBarcode: 'SSCC-175012345000000019',
    sku: 'SKU-773091',
    productName: 'Aceite Sintético 5W-30 Ultra (48 Cajas)',
    lotNumber: 'LOT-2026-X99',
    quantity: 48,
    unit: 'Cajas (1 Pallet)',
    weightKg: 840,
    transportPlate: '88-AA-1Z • Transportes Monclova',
    driverName: 'Armando Salazar',
    assignedVehicle: 'Montacargas Crown #07',
    assignedZoneLease: 'Pasillo 04',
    slaCountdownMinutes: 25,
    arrivalTime: '14:35',
    notes: 'Segundo pallet de la remesa #42.',
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

  // ─── Estado Reactivo Principal ─────────────────────────────────────────────
  private readonly rawMissions = signal<ForkliftMission[]>(INITIAL_MISSIONS);
  private readonly activeMissionId = signal<string | null>('mis-001');
  private readonly completedMissions = signal<ForkliftMission[]>([]);
  private readonly activeFilter = signal<CockpitFilter>('ALL');
  private readonly lastScanFeedback = signal<ScanFeedback | null>(null);

  // ─── Signals Computados ───────────────────────────────────────────────────

  /** Misión activa en ejecución inmediata (Hero Card) */
  readonly activeMission = computed<ForkliftMission | null>(() => {
    const list = this.rawMissions();
    const id = this.activeMissionId();
    if (id) {
      const found = list.find((m) => m.id === id);
      if (found) return found;
    }
    // Si no hay seleccionada explícitamente, toma la primera en curso o en cola
    const firstActive = list.find((m) => m.status === 'ACTIVE_PICK' || m.status === 'ACTIVE_DROP');
    if (firstActive) return firstActive;
    return list.length > 0 ? list[0] : null;
  });

  /** Cola de misiones pendientes filtrada según el tab seleccionado (excluye la misión activa) */
  readonly queuedMissions = computed<ForkliftMission[]>(() => {
    const list = this.rawMissions();
    const active = this.activeMission();
    const filter = this.activeFilter();

    // Excluir la activa
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

  /** Tomar una misión específica de la cola inmediatamente (⚡ Tomar Misión Ahora) */
  takeMissionNow(missionId: string): void {
    const list = this.rawMissions();
    const targetIndex = list.findIndex((m) => m.id === missionId);
    if (targetIndex === -1) return;

    const target = { ...list[targetIndex], status: 'ACTIVE_PICK' as MissionStatus, statusLabel: 'En Curso (Esperando Pick)' };
    const remaining = list.filter((m) => m.id !== missionId);

    // Colocarla al frente como activa
    this.rawMissions.set([target, ...remaining]);
    this.activeMissionId.set(missionId);
    this.lastScanFeedback.set({
      success: true,
      message: `Misión ${target.folio} activada con éxito. Procede al origen: ${target.originLocation}`,
      phase: 'PICK_VALIDATED',
    });

    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 80, 40]);
  }

  /**
   * Procesador universal de escaneo láser 1-Scan (Pick -> Drop -> Done)
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

    // FASE 1: Validar Escaneo de PICK (SSCC del Pallet o Código de Origen)
    if (current.status === 'ACTIVE_PICK' || current.status === 'QUEUED') {
      const isSsccMatch = cleanCode === current.ssccBarcode.toUpperCase() || cleanCode.includes(current.ssccBarcode.replace('SSCC-', ''));
      const isOriginMatch = cleanCode === current.originBarcode.toUpperCase();

      if (isSsccMatch || isOriginMatch) {
        // Éxito en Pick: Cambiar a estado ACTIVE_DROP
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

    // FASE 2: Validar Escaneo de DROP (Ubicación de Destino)
    if (current.status === 'ACTIVE_DROP') {
      const isDestMatch = cleanCode === current.destBarcode.toUpperCase() || cleanCode.includes(current.destBarcode.replace('LOC-', ''));

      if (isDestMatch) {
        // Completar misión
        this.completeMission(current.id);
        const feedback: ScanFeedback = {
          success: true,
          message: `¡Misión completada con éxito! Descarga confirmada en ${current.destinationLocation}.`,
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
    // Mandar al final
    const newQueue = [...remaining, updatedTarget];
    this.rawMissions.set(newQueue);

    // Si la pospuesta era la activa, activar la nueva primera
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

    // Remover de cola activa y registrar
    const remaining = list.filter((m) => m.id !== missionId);
    this.rawMissions.set(remaining);
    this.completedMissions.update((prev) => [flagged, ...prev]);

    // Promover la siguiente si existe
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

    // Promover automáticamente la siguiente misión en la cola
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
