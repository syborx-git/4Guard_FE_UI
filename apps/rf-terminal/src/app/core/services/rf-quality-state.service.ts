/**
 * @file rf-quality-state.service.ts
 * @description Servicio de Estado Reactivo de Calidad (QM) para la Terminal RF de 4GUARD WMS.
 * Maneja Bloqueos de Producto No Conforme (PNC), Liberaciones con 3 destinos,
 * Verificaciones de Carga en Andén F01 (F01-PO-GC-8.6-03), y Reclamaciones a Proveedor.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { UnitOfMeasure, ToastService } from '@4guard/shared-core';
import { AudioFeedbackService } from './audio-feedback.service';
import {
  QualityBlockItem,
  QualityRelease,
  LoadVerification,
  VerificationCriterion,
  QualityClaim,
  ReleaseDestination,
  DetectionStage,
  DefectCategory,
} from '../../features/quality/models/quality.models';

@Injectable({
  providedIn: 'root',
})
export class RfQualityStateService {
  private readonly toast = inject(ToastService);
  private readonly audio = inject(AudioFeedbackService);

  // ══════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO: BLOQUEOS (PRODUCTO NO CONFORME)
  // ══════════════════════════════════════════════════════════════════

  readonly blocks = signal<QualityBlockItem[]>([
    {
      id: 'blk-001',
      folio: 'BLQ-2026-0012',
      sku: 'LALA-MILK-1L',
      description: 'Leche Lala Entera UHT 1L (Caja 12 pzas)',
      clientId: 'cli-01',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-901',
      sscc: '375010203040500018',
      quantity: 120,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-DOCK-02',
      stage: 'INBOUND_UNLOAD',
      defectCategory: 'MATERIAL',
      defectCriteria: ['Material con humedad', 'Embalaje en malas condiciones'],
      severity: 'CRITICAL',
      status: 'BLOCKED',
      reportedBy: 'Carlos Mendoza (Supervisor Andén)',
      reportedAt: '2026-09-30 08:30',
      notes: 'Tarima inferior aplastada durante maniobra de descarga en andén 02.',
      evidenceFiles: [],
    },
    {
      id: 'blk-002',
      folio: 'BLQ-2026-0014',
      sku: 'ARROZ-VERDE-VALLE-900G',
      description: 'Arroz Súper Extra Verde Valle 900g',
      clientId: 'cli-02',
      clientName: 'Verde Valle S.A.',
      batchNumber: 'LOT-2026-VV-440',
      sscc: '375010203040500025',
      quantity: 80,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-A-04-12',
      stage: 'STORAGE',
      defectCategory: 'MATERIAL',
      defectCriteria: ['Saco rasgado', 'Fuga de grano'],
      severity: 'WARNING',
      status: 'UNDER_INSPECTION',
      reportedBy: 'Roberto Sánchez (Montacarguista)',
      reportedAt: '2026-09-30 11:15',
      notes: 'Detectado derrame menor en pasillo 04 al realizar reubicación.',
      evidenceFiles: [],
    },
    {
      id: 'blk-003',
      folio: 'BLQ-2026-0016',
      sku: 'ACEITE-NUTRIOLI-1L',
      description: 'Aceite Vegetal Comestible Nutrioli 1L',
      clientId: 'cli-03',
      clientName: 'Ragasa Industrias',
      batchNumber: 'LOT-2026-NUT-112',
      sscc: '375010203040500039',
      quantity: 200,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-HOLD-01',
      stage: 'INBOUND_UNLOAD',
      defectCategory: 'DOCUMENTATION',
      defectCriteria: ['Discrepancia en certificado de calidad COA'],
      severity: 'INFO',
      status: 'BLOCKED',
      reportedBy: 'Dra. Elena Ramos (Auditor QM)',
      reportedAt: '2026-09-30 13:00',
      notes: 'Falta sello de laboratorio acreditado en remisión de transporte.',
      evidenceFiles: [],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 2. ESTADO REACTIVO: LIBERACIONES
  // ══════════════════════════════════════════════════════════════════

  readonly releases = signal<QualityRelease[]>([
    {
      id: 'rel-001',
      folio: 'LIB-2026-0034',
      blockId: 'blk-000',
      blockFolio: 'BLQ-2026-0008',
      sku: 'MASECA-HARINA-1KG',
      description: 'Harina de Maíz Nixtamalizado Maseca 1kg',
      batchNumber: 'LOT-2026-GRUMA-88',
      clientName: 'Gruma S.A.B. de C.V.',
      quantity: 150,
      unitOfMeasure: UnitOfMeasure.UNIT,
      authorizerType: 'CLIENT',
      supportType: 'EMAIL',
      supportSubject: 'AUT-GRUMA-LIB-2026-44: Liberación aprobada por análisis microbiológico',
      authorizedByName: 'Ing. Fernando Garza',
      authorizedByPosition: 'Gerente de Calidad Planta',
      destination: 'DISTRIBUTION',
      decisionNotes: 'Lote cumple al 100% con tabla de inocuidad tras reinspección.',
      releasedByUserId: 'usr-001',
      releasedByUserName: 'Roberto Sánchez',
      releasedAt: '2026-09-30 12:00',
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 3. ESTADO REACTIVO: VERIFICACIONES DE CARGA F01 (ANDÉN)
  // ══════════════════════════════════════════════════════════════════

  readonly loadVerifications = signal<LoadVerification[]>([
    {
      id: 'ver-001',
      folio: 'VER-2026-0089',
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Liberación e Inspección de Transporte en Andén',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: 'REM-78401',
      productDescription: 'Lácteos Refrigerados UHT & Quesos',
      clientName: 'Lala S.A. de C.V.',
      date: '2026-09-30',
      time: '14:20',
      ramp: 'Andén 02 (Refrigerado)',
      status: 'APROBADO',
      generalObservations: 'Caja térmica limpia, termo-registrador a 3.8°C constante. Sellos fiscales íntegros.',
      evidencePhotos: [],
      createdAt: '2026-09-30 14:20',
      updatedAt: '2026-09-30 14:35',
      elaboratedBy: { name: 'Roberto Sánchez', position: 'Operador / Auditor RF', isSigned: true, signedAt: '14:35' },
      reviewedBy: { name: 'Carlos Mendoza', position: 'Supervisor Andén', isSigned: true, signedAt: '14:36' },
      approvedBy: { name: 'Dra. Elena Ramos', position: 'Auditor Líder QM', isSigned: true, signedAt: '14:38' },
      cleaningResponsible: { name: 'N/A', isSigned: false },
      releaseResponsible: { name: 'Roberto Sánchez', position: 'Operador RF', isSigned: true, signedAt: '14:35' },
      transportCriteria: [
        { id: 't1', label: 'Caja limpia, seca y libre de olores extraños', value: 'SI', actionIfNo: 'Rechazar o solicitar lavado', responsible: 'Transportista', observations: 'Caja impecable', isCritical: true },
        { id: 't2', label: 'Ausencia de plagas, insectos o roedores', value: 'SI', actionIfNo: 'Rechazo inmediato del camión', responsible: 'Calidad 4GUARD', observations: 'Sin evidencia de plagas', isCritical: true },
        { id: 't3', label: 'Temperatura de termoking dentro de rango (2°C a 6°C)', value: 'SI', actionIfNo: 'Detener descarga y avisar a QA', responsible: 'Supervisor Andén', observations: '3.8°C registrado', isCritical: true },
        { id: 't4', label: 'Sellos fiscales y marchamos coinciden con remisión', value: 'SI', actionIfNo: 'Levantar acta de no conformidad', responsible: 'Seguridad Caseta', observations: 'Sello MX-99281 verificado', isCritical: true },
        { id: 't5', label: 'Paredes y piso sin clavos salientes o astillas', value: 'SI', actionIfNo: 'Acondicionar piso con cartón', responsible: 'Cuadrilla descarga', observations: 'Piso acanalado de aluminio limpio' },
      ],
      productCriteria: [
        { id: 'p1', label: 'Tarimas estandarizadas y libres de humedad', value: 'SI', actionIfNo: 'Reestibar en tarima plástica', responsible: 'Montacarguista', observations: 'Pallets tipo Chep en buen estado' },
        { id: 'p2', label: 'Empaque primario y secundario sellado sin fugas', value: 'SI', actionIfNo: 'Separar piezas dañadas', responsible: 'Operador RF', observations: 'Cajas selladas herméticamente', isCritical: true },
        { id: 'p3', label: 'Código GS1 / EAN legible por escáner láser', value: 'SI', actionIfNo: 'Reetiquetar con marbete interno', responsible: 'Operador RF', observations: 'Lectura a primera pasada' },
        { id: 'p4', label: 'Fecha de caducidad con vida útil mayor a 90 días', value: 'SI', actionIfNo: 'Rechazar lote por caducidad corta', responsible: 'Calidad', observations: 'Vence Noviembre 2026', isCritical: true },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 4. ESTADO REACTIVO: RECLAMOS E INCIDENCIAS (F01)
  // ══════════════════════════════════════════════════════════════════

  readonly claims = signal<QualityClaim[]>([
    {
      id: 'clm-001',
      folio: 'REC-2026-0007',
      date: '2026-09-30',
      time: '10:00',
      stage: 'INBOUND_UNLOAD',
      sku: 'LALA-MILK-1L',
      productDescription: 'Leche Lala Entera UHT 1L (Caja 12 pzas)',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-901',
      remisionNumber: 'REM-78401',
      defectType: 'BAD_CONDITIONS',
      damagedQty: 24,
      lostQty: 12,
      associatedCost: 2880.0,
      currency: 'MXN',
      authorizedByName: 'Dra. Elena Ramos',
      authorizedByPosition: 'Auditor QM',
      observations: 'Cajas con aplastamiento severo por estiba deficiente desde planta de origen.',
      evidenceFiles: [],
      status: 'OPEN',
      createdAt: '2026-09-30 10:00',
      updatedAt: '2026-09-30 10:15',
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 5. KPIS COMPUTADOS GLOBALES
  // ══════════════════════════════════════════════════════════════════

  readonly kpiTotalBlocked = computed(() => {
    return this.blocks().filter(b => b.status === 'BLOCKED' || b.status === 'UNDER_INSPECTION').length;
  });

  readonly kpiTotalReleases = computed(() => {
    return this.releases().length;
  });

  readonly kpiTotalVerifications = computed(() => {
    return this.loadVerifications().length;
  });

  readonly kpiTotalClaims = computed(() => {
    return this.claims().filter(c => c.status === 'OPEN' || c.status === 'IN_REVIEW').length;
  });

  // ══════════════════════════════════════════════════════════════════
  // 6. ACCIONES OPERACIONALES EN PISO (TERMINAL RF)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Registra un nuevo Bloqueo de Producto No Conforme y lo envía a Cuarentena
   */
  createBlock(item: Omit<QualityBlockItem, 'id' | 'folio' | 'reportedAt' | 'status'>): QualityBlockItem {
    const id = `blk-${Date.now()}`;
    const folio = `BLQ-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const now = new Date();
    const reportedAt = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;

    const newBlock: QualityBlockItem = {
      ...item,
      id,
      folio,
      reportedAt,
      status: 'BLOCKED',
    };

    this.blocks.update(list => [newBlock, ...list]);
    this.toast.error(`Producto bloqueado y retenido: ${folio} (${item.sku})`, 'BLOQUEO REGISTRADO');
    this.audio.playError();
    return newBlock;
  }

  /**
   * Registra una liberación formal de producto retenido
   */
  createRelease(data: {
    blockId: string;
    destination: ReleaseDestination;
    authorizerType: 'CLIENT' | 'QUALITY_4GUARD';
    supportType: 'EMAIL' | 'ELECTRONIC_MEDIA' | 'FORMAL_ACT' | 'OTHER';
    supportSubject: string;
    authorizedByName: string;
    authorizedByPosition: string;
    decisionNotes: string;
    releasedByUserName: string;
  }): QualityRelease | null {
    const block = this.blocks().find(b => b.id === data.blockId);
    if (!block) return null;

    const id = `rel-${Date.now()}`;
    const folio = `LIB-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const now = new Date();
    const releasedAt = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;

    const newRelease: QualityRelease = {
      id,
      folio,
      blockId: block.id,
      blockFolio: block.folio,
      sku: block.sku,
      description: block.description,
      batchNumber: block.batchNumber,
      clientName: block.clientName,
      quantity: block.quantity,
      unitOfMeasure: block.unitOfMeasure,
      authorizerType: data.authorizerType,
      supportType: data.supportType,
      supportSubject: data.supportSubject,
      authorizedByName: data.authorizedByName,
      authorizedByPosition: data.authorizedByPosition,
      destination: data.destination,
      decisionNotes: data.decisionNotes,
      releasedByUserId: 'usr-rf-01',
      releasedByUserName: data.releasedByUserName,
      releasedAt,
    };

    // Actualizar estado del bloqueo original a 'RELEASED'
    this.blocks.update(list =>
      list.map(b => (b.id === block.id ? { ...b, status: 'RELEASED' } : b))
    );

    this.releases.update(list => [newRelease, ...list]);
    this.toast.success(`Lote liberado formalmente: ${folio} → Destino: ${data.destination}`, 'LIBERACIÓN EXITOSA');
    this.audio.playSuccess();
    return newRelease;
  }

  /**
   * Guarda o actualiza una verificación de transporte en andén F01
   */
  createLoadVerification(data: {
    remisionNumber: string;
    productDescription: string;
    clientName: string;
    ramp: string;
    generalObservations: string;
    status: 'APROBADO' | 'RECHAZADO' | 'ACONDICIONAMIENTO_PENDIENTE' | 'LIMPIEZA_PENDIENTE';
    transportCriteria: VerificationCriterion[];
    productCriteria: VerificationCriterion[];
    inspectorName: string;
  }): LoadVerification {
    const id = `ver-${Date.now()}`;
    const folio = `VER-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);

    const newVerif: LoadVerification = {
      id,
      folio,
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Inspección de Transporte en Andén',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: data.remisionNumber || 'REM-S/N',
      productDescription: data.productDescription,
      clientName: data.clientName,
      date,
      time,
      ramp: data.ramp,
      status: data.status,
      generalObservations: data.generalObservations,
      evidencePhotos: [],
      createdAt: `${date} ${time}`,
      updatedAt: `${date} ${time}`,
      elaboratedBy: { name: data.inspectorName, position: 'Auditor RF', isSigned: true, signedAt: time },
      reviewedBy: { name: 'Carlos Mendoza', position: 'Supervisor Andén', isSigned: true, signedAt: time },
      approvedBy: { name: 'Dra. Elena Ramos', position: 'Auditor Líder QM', isSigned: true, signedAt: time },
      cleaningResponsible: { name: 'N/A', isSigned: false },
      releaseResponsible: { name: data.inspectorName, position: 'Operador / Auditor RF', isSigned: true, signedAt: time },
      transportCriteria: data.transportCriteria,
      productCriteria: data.productCriteria,
    };

    this.loadVerifications.update(list => [newVerif, ...list]);

    if (data.status === 'APROBADO') {
      this.toast.success(`Inspección F01 Conforme (${folio}) — Transporte Aprobado para maniobra`, 'TRANSPORTE APROBADO');
      this.audio.playSuccess();
    } else {
      this.toast.error(`Inspección F01 Rechazada (${folio}) — Transporte No Conforme`, 'RECHAZO EN ANDÉN');
      this.audio.playError();
    }

    return newVerif;
  }

  /**
   * Registra un reclamo a proveedor en piso
   */
  createClaim(data: {
    stage: DetectionStage;
    sku: string;
    productDescription: string;
    clientName: string;
    batchNumber: string;
    remisionNumber: string;
    defectType: any;
    damagedQty: number;
    lostQty: number;
    associatedCost: number;
    authorizedByName: string;
    authorizedByPosition: string;
    observations: string;
  }): QualityClaim {
    const id = `clm-${Date.now()}`;
    const folio = `REC-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);

    const newClaim: QualityClaim = {
      id,
      folio,
      date,
      time,
      stage: data.stage as any,
      sku: data.sku,
      productDescription: data.productDescription,
      clientName: data.clientName,
      batchNumber: data.batchNumber,
      remisionNumber: data.remisionNumber,
      defectType: data.defectType,
      damagedQty: data.damagedQty,
      lostQty: data.lostQty,
      associatedCost: data.associatedCost,
      currency: 'MXN',
      authorizedByName: data.authorizedByName,
      authorizedByPosition: data.authorizedByPosition,
      observations: data.observations,
      evidenceFiles: [],
      status: 'OPEN',
      createdAt: `${date} ${time}`,
      updatedAt: `${date} ${time}`,
    };

    this.claims.update(list => [newClaim, ...list]);
    this.toast.warning(`Reclamo registrado: ${folio} ($${data.associatedCost.toLocaleString('es-MX')} MXN)`, 'RECLAMO GENERADO');
    this.audio.playWarning();
    return newClaim;
  }
}
