/**
 * @file quality-inspection.service.ts
 * @description Servicio reactivo de Control de Calidad y Cuarentenas (QM) para 4Guard RF Terminal.
 * Administra la cola de tarimas en cuarentena derivadas de Siniestros de Cockpit, Recepción Inbound y Caseta,
 * validación de checklist técnico de 4 puntos y matriz de disposición final con auto-generación de misiones de Putaway.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { ForkliftMissionService } from './forklift-mission.service';
import { AudioFeedbackService } from './audio-feedback.service';

export type QuarantineOrigin = 'COCKPIT_INCIDENT' | 'INBOUND_SAMPLE' | 'SECURITY_GATE' | 'WAREHOUSE_AUDIT';
export type QmDecision =
  | 'RELEASED_TO_WAREHOUSE'
  | 'CONDITIONAL_REPACK'
  | 'SCRAP_DESTRUCTION'
  | 'RETURN_TO_VENDOR'
  | 'PENDING_INSPECTION';
export type QmSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type QmFilter = 'ALL' | 'INCIDENTS' | 'INBOUND' | 'COMPLETED';

export interface QualityChecklist {
  packagingIntegrity: boolean; // Empaque sin deformaciones ni cajas rotas
  hermeticSeals: boolean;      // Sin derrames de líquido, humedad ni contaminación
  lotAndExpiryMatch: boolean;  // Coincidencia física de Lote y Fecha de Caducidad
  gs1BarcodeLegible: boolean;  // Código GS1-128 / SSCC legible por escáner
}

export interface QualityInspectionItem {
  id: string;
  ticketFolio: string;
  sscc: string;
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: string;
  quantityTotal: number;
  quantitySampled: number;
  unit: string;
  weightKg: number;
  currentLocation: string;
  originType: QuarantineOrigin;
  originLabel: string;
  severity: QmSeverity;
  severityLabel: string;
  retentionReason: string;
  reportedBy: string;
  reportedAt: string;
  photoUrl?: string;
  decision: QmDecision;
  decisionLabel: string;
  inspectorName?: string;
  inspectedAt?: string;
  dispositionNotes?: string;
  actaFolio?: string;
  checklist: QualityChecklist;
}

const INITIAL_QM_ITEMS: QualityInspectionItem[] = [
  {
    id: 'qm-001',
    ticketFolio: 'QM-2026-0089',
    sscc: 'SSCC-175012345000000018',
    sku: 'SKU-773091',
    productName: 'Aceite Sintético 5W-30 Ultra (48 Cajas)',
    lotNumber: 'LOT-2026-X99',
    expirationDate: '2029-08-30',
    quantityTotal: 48,
    quantitySampled: 5,
    unit: 'Cajas (1 Pallet)',
    weightKg: 840,
    currentLocation: 'Buffer 03 (Zona Cuarentena QM)',
    originType: 'COCKPIT_INCIDENT',
    originLabel: 'Siniestro en Desembarque (Andén)',
    severity: 'CRITICAL',
    severityLabel: 'Crítica • Bloqueo Inmediato',
    retentionReason: 'Pallet inclinado con riesgo de colapso y 2 cajas inferiores con deformación por impacto.',
    reportedBy: 'Montacarguista Crown #07 (Roberto Sánchez)',
    reportedAt: '14:24',
    photoUrl: 'assets/mock-damaged-pallet.jpg',
    decision: 'PENDING_INSPECTION',
    decisionLabel: 'En Espera de Inspección QM',
    checklist: {
      packagingIntegrity: false,
      hermeticSeals: true,
      lotAndExpiryMatch: true,
      gs1BarcodeLegible: true,
    },
  },
  {
    id: 'qm-002',
    ticketFolio: 'QM-2026-0090',
    sscc: 'SSCC-175012345000000033',
    sku: 'SKU-LECHE-003',
    productName: 'Leche Entera UHT 1L (72 Cajas)',
    lotNumber: 'LOT-2026-L40',
    expirationDate: '2027-03-15',
    quantityTotal: 72,
    quantitySampled: 8,
    unit: 'Cajas (1 Pallet)',
    weightKg: 910,
    currentLocation: 'Rampa 02 (Muelle Frío QM)',
    originType: 'INBOUND_SAMPLE',
    originLabel: 'Muestreo QM Obligatorio (Inbound)',
    severity: 'MAJOR',
    severityLabel: 'Mayor • Muestreo Microbiológico',
    retentionReason: 'Muestreo aleatorio norma NOM-251 de lote lácteo recién ingresado de proveedor Alpura.',
    reportedBy: 'Oficial de Caseta / QM Supervisor',
    reportedAt: '14:10',
    decision: 'PENDING_INSPECTION',
    decisionLabel: 'Muestreo en Curso',
    checklist: {
      packagingIntegrity: true,
      hermeticSeals: true,
      lotAndExpiryMatch: true,
      gs1BarcodeLegible: true,
    },
  },
  {
    id: 'qm-003',
    ticketFolio: 'QM-2026-0091',
    sscc: 'SSCC-175012345000000067',
    sku: 'SKU-441029',
    productName: 'Líquido de Frenos DOT-4 Pro (60 Cajas)',
    lotNumber: 'LOT-2026-C01',
    expirationDate: '2028-11-20',
    quantityTotal: 60,
    quantitySampled: 4,
    unit: 'Cajas (1 Pallet)',
    weightKg: 960,
    currentLocation: 'Buffer 03 (Zona Cuarentena QM)',
    originType: 'COCKPIT_INCIDENT',
    originLabel: 'Siniestro en Maniobra de Pasillo',
    severity: 'CRITICAL',
    severityLabel: 'Crítica • Químico Peligroso',
    retentionReason: 'Caja superior perforada con posible derrame sobre tarima inferior en maniobra de rack.',
    reportedBy: 'Operador de Montacargas #04',
    reportedAt: '13:45',
    decision: 'PENDING_INSPECTION',
    decisionLabel: 'En Espera de Inspección QM',
    checklist: {
      packagingIntegrity: false,
      hermeticSeals: false,
      lotAndExpiryMatch: true,
      gs1BarcodeLegible: true,
    },
  },
  {
    id: 'qm-004',
    ticketFolio: 'QM-2026-0092',
    sscc: 'SSCC-175012345000000088',
    sku: 'SKU-ARROZ-003',
    productName: 'Arroz Súper Extra 24x900g (50 Bultos)',
    lotNumber: 'LOT-2026-A11',
    expirationDate: '2027-12-31',
    quantityTotal: 50,
    quantitySampled: 5,
    unit: 'Bultos (1 Pallet)',
    weightKg: 1080,
    currentLocation: 'Andén 04 (Inspección QM)',
    originType: 'SECURITY_GATE',
    originLabel: 'Caseta de Vigilancia (Sello Violado)',
    severity: 'MAJOR',
    severityLabel: 'Mayor • Trazabilidad',
    retentionReason: 'Tráiler ingresó con sello de seguridad no coincidente con carta porte. Requiere verificación.',
    reportedBy: 'Oficial de Seguridad Caseta Norte',
    reportedAt: '13:15',
    decision: 'PENDING_INSPECTION',
    decisionLabel: 'Verificación de Integridad',
    checklist: {
      packagingIntegrity: true,
      hermeticSeals: true,
      lotAndExpiryMatch: true,
      gs1BarcodeLegible: true,
    },
  },
];

@Injectable({
  providedIn: 'root',
})
export class QualityInspectionService {
  private readonly forkliftService = inject(ForkliftMissionService);
  private readonly audioService = inject(AudioFeedbackService);

  // ─── Estado Reactivo ───────────────────────────────────────────────────────
  private readonly rawItems = signal<QualityInspectionItem[]>(INITIAL_QM_ITEMS);
  private readonly activeItemId = signal<string | null>('qm-001');
  private readonly completedItems = signal<QualityInspectionItem[]>([]);
  private readonly activeFilter = signal<QmFilter>('ALL');

  // ─── Signals Computados ───────────────────────────────────────────────────

  /** Ítem activo en inspección (Hero Card) */
  readonly activeItem = computed<QualityInspectionItem | null>(() => {
    const list = this.rawItems();
    const id = this.activeItemId();
    if (id) {
      const found = list.find((item) => item.id === id);
      if (found) return found;
    }
    return list.length > 0 ? list[0] : null;
  });

  /** Cola de cuarentena filtrada */
  readonly queuedItems = computed<QualityInspectionItem[]>(() => {
    const list = this.rawItems();
    const active = this.activeItem();
    const filter = this.activeFilter();

    // Excluir la activa
    const queue = active ? list.filter((item) => item.id !== active.id) : list;

    if (filter === 'ALL') return queue;
    if (filter === 'INCIDENTS') return queue.filter((item) => item.originType === 'COCKPIT_INCIDENT');
    if (filter === 'INBOUND') return queue.filter((item) => item.originType === 'INBOUND_SAMPLE' || item.originType === 'SECURITY_GATE');
    return queue;
  });

  /** Contadores en tiempo real */
  readonly counts = computed(() => {
    const all = this.rawItems();
    const completed = this.completedItems();

    return {
      all: all.length,
      incidents: all.filter((item) => item.originType === 'COCKPIT_INCIDENT').length,
      inbound: all.filter((item) => item.originType === 'INBOUND_SAMPLE' || item.originType === 'SECURITY_GATE').length,
      completed: completed.length,
    };
  });

  readonly currentFilter = computed(() => this.activeFilter());
  readonly historyItems = computed(() => this.completedItems());

  // ─── Acciones Operativas QM ───────────────────────────────────────────────

  setFilter(filter: QmFilter): void {
    this.activeFilter.set(filter);
    this.audioService.playSuccess();
  }

  selectItemForInspection(id: string): void {
    this.activeItemId.set(id);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(30);
  }

  toggleChecklist(itemId: string, key: keyof QualityChecklist): void {
    this.rawItems.update((list) =>
      list.map((item) => {
        if (item.id === itemId) {
          const updatedChecklist = {
            ...item.checklist,
            [key]: !item.checklist[key],
          };
          return { ...item, checklist: updatedChecklist };
        }
        return item;
      })
    );
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(20);
  }

  /**
   * Dictamen y Disposición Final del Auditor QM
   */
  applyDisposition(
    itemId: string,
    decision: QmDecision,
    notes: string,
    inspectorName = 'Dra. Elena Ramos • Auditor Líder QM',
    photoUrl?: string
  ): QualityInspectionItem | null {
    const list = this.rawItems();
    const target = list.find((i) => i.id === itemId);
    if (!target) return null;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const actaFolio = `ACTA-QM-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let decisionLabel = '';
    switch (decision) {
      case 'RELEASED_TO_WAREHOUSE':
        decisionLabel = '✅ Liberado 100% para Guardado en Almacén';
        break;
      case 'CONDITIONAL_REPACK':
        decisionLabel = '🔄 Liberación Condicional / Reempaque & Retrabajo';
        break;
      case 'SCRAP_DESTRUCTION':
        decisionLabel = '🔥 Baja Inmediata por Merma / Destrucción (Estado 80)';
        break;
      case 'RETURN_TO_VENDOR':
        decisionLabel = '🚚 Rechazado para Devolución al Proveedor (RTV)';
        break;
      default:
        decisionLabel = 'Evaluado';
    }

    const completedRecord: QualityInspectionItem = {
      ...target,
      decision,
      decisionLabel,
      dispositionNotes: notes,
      inspectorName,
      inspectedAt: timeStr,
      actaFolio,
      photoUrl: photoUrl || target.photoUrl,
    };

    // Remover de la cola pendiente y archivar en historial
    const remaining = list.filter((i) => i.id !== itemId);
    this.rawItems.set(remaining);
    this.completedItems.update((prev) => [completedRecord, ...prev]);

    // Promover la siguiente si existe
    if (remaining.length > 0) {
      this.activeItemId.set(remaining[0].id);
    } else {
      this.activeItemId.set(null);
    }

    // ── INTEGRACIÓN CLAVE CON EL COCKPIT DEL MONTACARGUISTA ──────────────
    // Si se liberó la tarima, se inserta una misión en el Cockpit para guardarla en Rack
    if (decision === 'RELEASED_TO_WAREHOUSE') {
      this.audioService.playSuccess();
      if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    } else if (decision === 'SCRAP_DESTRUCTION') {
      this.audioService.playWarning();
      if (navigator.vibrate) navigator.vibrate([150, 100, 150]);
    } else {
      this.audioService.playSuccess();
    }

    return completedRecord;
  }

  /** Reiniciar dataset demo de Calidad */
  resetDemoData(): void {
    this.rawItems.set(JSON.parse(JSON.stringify(INITIAL_QM_ITEMS)));
    this.activeItemId.set('qm-001');
    this.completedItems.set([]);
    this.activeFilter.set('ALL');
    this.audioService.playSuccess();
  }
}
