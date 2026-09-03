/**
 * @file quality-state.service.ts
 * @description Servicio de Estado Reactivo (Angular Signals) para el Módulo de Calidad QM.
 * Maneja datos locales y lógica reactiva de Bloqueos, Liberaciones y Verificaciones de Carga.
 */

import { Injectable, signal, computed } from '@angular/core';
import { UnitOfMeasure } from '@4guard/shared-core';
import {
  QualityBlockItem,
  QualityRelease,
  LoadVerification,
  VerificationCriterion,
  ReleaseDestination,
  ReleaseAuthorizerType,
  ReleaseSupportType
} from '../models/quality.models';

@Injectable({
  providedIn: 'root'
})
export class QualityStateService {

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
      reportedAt: '2026-08-30T10:35:00Z',
      notes: 'Tarima secundaria con filtración y cajas reblandecidas por ruptura interior.',
      evidenceFiles: [
        { id: 'ev-1', name: 'foto_caja_humedad_lala.jpg', size: '2.4 MB', type: 'image', uploadedAt: '2026-08-30T10:36:00Z' }
      ]
    },
    {
      id: 'blk-002',
      folio: 'BLQ-2026-0013',
      sku: 'BIMBO-BREAD-680G',
      description: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)',
      clientId: 'cli-03',
      clientName: 'Bimbo de México S.A.',
      batchNumber: 'LOT-BIM-2026-902',
      sscc: '375010080031200032',
      quantity: 80,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-ISO-01',
      stage: 'STORAGE',
      defectCategory: 'MATERIAL',
      defectCriteria: ['Material colapsado', 'Material visualmente inestable'],
      severity: 'WARNING',
      status: 'BLOCKED',
      reportedBy: 'Mario Morales (Montacarguista)',
      reportedAt: '2026-08-29T09:45:00Z',
      notes: 'Pallet colapsado en nivel 3 de rack por inclinación de emplaye.',
      evidenceFiles: [
        { id: 'ev-2', name: 'rack_inclinacion_bimbo.jpg', size: '1.9 MB', type: 'image', uploadedAt: '2026-08-29T09:46:00Z' }
      ]
    },
    {
      id: 'blk-003',
      folio: 'BLQ-2026-0014',
      sku: 'NESP-CAPS-10P',
      description: 'Cápsulas Nespresso Ristretto Intenso x10 (Caja Master)',
      clientId: 'cli-02',
      clientName: 'Nestlé México S.A.',
      batchNumber: 'LOT-NES-2026-883',
      sscc: '376130369876500025',
      quantity: 450,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-STG-04',
      stage: 'OUTBOUND_LOAD',
      defectCategory: 'TRANSPORT',
      defectCriteria: ['Paredes sucias', 'Piso sucio, con obstáculos o en malas condiciones'],
      severity: 'WARNING',
      status: 'UNDER_INSPECTION',
      reportedBy: 'Laura Valdés (Auditora QM)',
      reportedAt: '2026-08-30T11:20:00Z',
      notes: 'Unidad de transporte de Castores con piso astillado y polvo excesivo antes de carga.',
      evidenceFiles: [
        { id: 'ev-3', name: 'inspeccion_caja_trailer.pdf', size: '420 KB', type: 'pdf', uploadedAt: '2026-08-30T11:22:00Z' }
      ]
    },
    {
      id: 'blk-004',
      folio: 'BLQ-2026-0015',
      sku: 'PHARMA-VACC-SERUM',
      description: 'Suero Inmunológico Grado Médico 50ml (Caja Frío)',
      clientId: 'cli-04',
      clientName: 'PharmaCorp México S.A.',
      batchNumber: 'LOT-PHARMA-2026-77',
      sscc: '375099881122300044',
      quantity: 30,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-COLD-02',
      stage: 'TEST_MATERIAL',
      defectCategory: 'SPECIAL_TREATMENT',
      defectCriteria: ['Prueba QA.', 'Material para tratamiento especial.'],
      severity: 'INFO',
      status: 'UNDER_INSPECTION',
      reportedBy: 'Dr. Roberto Gómez (Laboratorio QM)',
      reportedAt: '2026-08-30T14:10:00Z',
      notes: 'Muestreo microbiológico normativo obligatorio según NOM-059-SSA1-2015.',
      evidenceFiles: [
        { id: 'ev-4', name: 'protocolo_analisis_cofepris.pdf', size: '1.2 MB', type: 'pdf', uploadedAt: '2026-08-30T14:12:00Z' }
      ]
    },
    {
      id: 'blk-005',
      folio: 'BLQ-2026-0016',
      sku: 'COCA-600ML',
      description: 'Refresco Coca-Cola Original 600ml (Pack 24)',
      clientId: 'cli-05',
      clientName: 'Coca-Cola FEMSA',
      batchNumber: 'LOT-KO-2026-114',
      sscc: '375011998877600012',
      quantity: 350,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-REC-DOCK-03',
      stage: 'INBOUND_UNLOAD',
      defectCategory: 'DOCUMENTATION',
      defectCriteria: ['Ausencia de certificado de calidad o es incorrecto.', 'Sin remisión o factura.'],
      severity: 'WARNING',
      status: 'BLOCKED',
      reportedBy: 'Carlos Mendoza (Supervisor Andén)',
      reportedAt: '2026-08-30T16:00:00Z',
      notes: 'Falta certificado de calidad del lote del proveedor en el manifiesto de entrega.',
      evidenceFiles: [
        { id: 'ev-5', name: 'remision_incompleta_coca.pdf', size: '310 KB', type: 'pdf', uploadedAt: '2026-08-30T16:05:00Z' }
      ]
    }
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 2. ESTADO REACTIVO: LIBERACIONES Y DICTÁMENES
  // ══════════════════════════════════════════════════════════════════

  readonly releases = signal<QualityRelease[]>([
    {
      id: 'rel-001',
      folio: 'LIB-2026-0081',
      blockId: 'blk-hist-01',
      blockFolio: 'BLQ-2026-0008',
      sku: 'LALA-YOG-250G',
      description: 'Yogurt Griego Lala Fresa 250g (Sixpack x8)',
      batchNumber: 'LOT-2026-LALA-889',
      clientName: 'Lala S.A. de C.V.',
      quantity: 200,
      unitOfMeasure: UnitOfMeasure.BOX,
      authorizerType: 'CLIENT',
      supportType: 'EMAIL',
      supportSubject: 'RE: Liberación y Vo.Bo. Lote Fresa - Ing. Mariana Garza',
      supportFileName: 'correo_aprobacion_lala_889.eml',
      authorizedByName: 'Ing. Mariana Garza',
      authorizedByPosition: 'Gerente de Aseguramiento de Calidad Cliente',
      destination: 'DISTRIBUTION',
      decisionNotes: 'Se valida dictamen de laboratorio con parámetros físico-químicos conformes. Se autoriza liberación para distribución.',
      releasedByUserId: 'usr-qm-01',
      releasedByUserName: 'Laura Valdés (Auditora QM)',
      releasedAt: '2026-08-29T15:30:00Z'
    },
    {
      id: 'rel-002',
      folio: 'LIB-2026-0082',
      blockId: 'blk-hist-02',
      blockFolio: 'BLQ-2026-0009',
      sku: 'BIMBO-TOST-300G',
      description: 'Tostadas Horneadas Sanissimo 300g (Caja 24U)',
      batchNumber: 'LOT-BIM-2026-701',
      clientName: 'Bimbo de México S.A.',
      quantity: 65,
      unitOfMeasure: UnitOfMeasure.BOX,
      authorizerType: 'QUALITY_4GUARD',
      supportType: 'FORMAL_ACT',
      supportSubject: 'Acta de Destrucción por Caducidad Vencida ACT-2026-094',
      supportFileName: 'acta_destruccion_sanissimo.pdf',
      authorizedByName: 'Ing. Fernando Treviño',
      authorizedByPosition: 'Superintendente de Calidad 4GUARD',
      destination: 'DESTRUCTION',
      decisionNotes: 'Producto con caducidad expirada hace >15 días. Se levanta acta de destrucción controlada.',
      releasedByUserId: 'usr-qm-02',
      releasedByUserName: 'Fernando Treviño (4GUARD QM)',
      releasedAt: '2026-08-28T12:00:00Z'
    },
    {
      id: 'rel-003',
      folio: 'LIB-2026-0083',
      blockId: 'blk-hist-03',
      blockFolio: 'BLQ-2026-0010',
      sku: 'NESP-COFFEE-BAG',
      description: 'Café en Grano Dolce Gusto 1kg (Caja 6 Bolsas)',
      batchNumber: 'LOT-NES-2026-550',
      clientName: 'Nestlé México S.A.',
      quantity: 110,
      unitOfMeasure: UnitOfMeasure.BOX,
      authorizerType: 'CLIENT',
      supportType: 'ELECTRONIC_MEDIA',
      supportSubject: 'Ticket Soporte Nestlé Supply Chain #NX-99812 - Devolución Planta',
      supportFileName: 'guia_retorno_planta_toluca.pdf',
      authorizedByName: 'Lic. Rodrigo Salgado',
      authorizedByPosition: 'Coordinador de Logística Inversa Nestlé',
      destination: 'RETURN',
      decisionNotes: 'Incompatibilidad de código de barras para mercado nacional. Se autoriza retorno inmediato a planta Toluca.',
      releasedByUserId: 'usr-qm-01',
      releasedByUserName: 'Laura Valdés (Auditora QM)',
      releasedAt: '2026-08-27T17:45:00Z'
    }
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 3. ESTADO REACTIVO: VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03)
  // ══════════════════════════════════════════════════════════════════

  readonly loadVerifications = signal<LoadVerification[]>([
    {
      id: 'ver-001',
      folio: 'VER-2026-0041',
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Liberación de carga',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: 'REM-2026-LALA-8812',
      productDescription: 'Leche Lala Entera UHT 1L (Tarima 80 Cajas)',
      clientName: 'Lala S.A. de C.V.',
      date: '2026-08-30',
      time: '11:30',
      ramp: 'Rampa 04 (Frío)',
      status: 'APROBADO',
      productCriteria: this.getDefaultProductCriteria('SI'),
      transportCriteria: this.getDefaultTransportCriteria('SI'),
      elaboratedBy: { name: 'Carlos Mendoza', position: 'Montacarguista / Andén', isSigned: true, signedAt: '2026-08-30 11:32' },
      reviewedBy: { name: 'Laura Valdés', position: 'Auditora QM', isSigned: true, signedAt: '2026-08-30 11:35' },
      approvedBy: { name: 'Ing. Fernando Treviño', position: 'Superintendente QM', isSigned: true, signedAt: '2026-08-30 11:38' },
      cleaningResponsible: { name: 'N/A (Pallet Limpio)', isSigned: true },
      releaseResponsible: { name: 'Laura Valdés', position: 'Auditora QM', isSigned: true, signedAt: '2026-08-30 11:40' },
      generalObservations: 'Embarque conforme en cadena de frío a 3.8°C. Sellos y flejado intactos.',
      evidencePhotos: [
        { id: 'ev-v1', name: 'foto_estiba_rampa_04.jpg', size: '1.5 MB', type: 'image', uploadedAt: '2026-08-30 11:30' }
      ],
      createdAt: '2026-08-30T11:30:00Z',
      updatedAt: '2026-08-30T11:40:00Z'
    },
    {
      id: 'ver-002',
      folio: 'VER-2026-0042',
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Liberación de carga',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: 'REM-2026-NES-4491',
      productDescription: 'Cápsulas Nespresso Ristretto Intenso Master Box',
      clientName: 'Nestlé México S.A.',
      date: '2026-08-30',
      time: '14:15',
      ramp: 'Rampa 02 (Secos)',
      status: 'LIMPIEZA_PENDIENTE',
      productCriteria: this.getDefaultProductCriteriaWithOverride({
        'crit-prod-4': { value: 'NO', observations: 'Exceso de polvo de madera en tarima base. Requiere aspirado y limpieza bajo IT01.' }
      }),
      transportCriteria: this.getDefaultTransportCriteria('SI'),
      elaboratedBy: { name: 'Alberto Ríos', position: 'Operador de Andén', isSigned: true, signedAt: '2026-08-30 14:16' },
      reviewedBy: { name: 'Laura Valdés', position: 'Auditora QM', isSigned: true, signedAt: '2026-08-30 14:20' },
      approvedBy: { name: 'Ing. Fernando Treviño', position: 'Superintendente QM', isSigned: false },
      cleaningResponsible: { name: '', isSigned: false }, // PENDIENTE DE FIRMA
      releaseResponsible: { name: '', isSigned: false },
      generalObservations: 'Se detecta tarima con polvo acumulado. Aplicando instructivo IT01-PO-GC-8.6-01 de limpieza de pallet.',
      evidencePhotos: [],
      createdAt: '2026-08-30T14:15:00Z',
      updatedAt: '2026-08-30T14:20:00Z'
    },
    {
      id: 'ver-003',
      folio: 'VER-2026-0043',
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Liberación de carga',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: 'REM-2026-BIM-9920',
      productDescription: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)',
      clientName: 'Bimbo de México S.A.',
      date: '2026-08-30',
      time: '15:40',
      ramp: 'Rampa 01',
      status: 'ACONDICIONAMIENTO_PENDIENTE',
      productCriteria: this.getDefaultProductCriteriaWithOverride({
        'crit-prod-1': { value: 'NO', observations: 'Tarima astillada en taco derecho. Se requiere trasvase de tarima según IT02.' }
      }),
      transportCriteria: this.getDefaultTransportCriteria('SI'),
      elaboratedBy: { name: 'Jorge Peña', position: 'Montacarguista', isSigned: true, signedAt: '2026-08-30 15:42' },
      reviewedBy: { name: 'Laura Valdés', position: 'Auditora QM', isSigned: true, signedAt: '2026-08-30 15:45' },
      approvedBy: { name: 'Ing. Fernando Treviño', position: 'Superintendente QM', isSigned: false },
      cleaningResponsible: { name: 'N/A', isSigned: true },
      releaseResponsible: { name: '', isSigned: false },
      generalObservations: 'Tarima dañada no apta para transporte foráneo. Acondicionamiento en curso.',
      evidencePhotos: [],
      createdAt: '2026-08-30T15:40:00Z',
      updatedAt: '2026-08-30T15:45:00Z'
    }
  ]);

  // ══════════════════════════════════════════════════════════════════
  // 4. COMPUTED KPIS (TOTALIZADORES EN TIEMPO REAL)
  // ══════════════════════════════════════════════════════════════════

  readonly kpiTotalActiveBlocks = computed(() =>
    this.blocks().filter(b => b.status !== 'RELEASED').length
  );

  readonly kpiTotalBlocked = computed(() =>
    this.blocks().filter(b => b.status === 'BLOCKED').length
  );

  readonly kpiTotalUnderInspection = computed(() =>
    this.blocks().filter(b => b.status === 'UNDER_INSPECTION').length
  );

  readonly kpiTotalReleases = computed(() =>
    this.releases().length
  );

  readonly kpiDistributionReleases = computed(() =>
    this.releases().filter(r => r.destination === 'DISTRIBUTION').length
  );

  readonly kpiDestructionReleases = computed(() =>
    this.releases().filter(r => r.destination === 'DESTRUCTION').length
  );

  readonly kpiReturnReleases = computed(() =>
    this.releases().filter(r => r.destination === 'RETURN').length
  );

  readonly kpiTotalVerifications = computed(() =>
    this.loadVerifications().length
  );

  readonly kpiApprovedVerifications = computed(() =>
    this.loadVerifications().filter(v => v.status === 'APROBADO').length
  );

  readonly kpiPendingVerifications = computed(() =>
    this.loadVerifications().filter(v => v.status !== 'APROBADO').length
  );

  // ══════════════════════════════════════════════════════════════════
  // 5. ACCIONES Y MUTACIONES DE ESTADO
  // ══════════════════════════════════════════════════════════════════

  createBlock(newBlock: Omit<QualityBlockItem, 'id' | 'folio' | 'reportedAt'>): QualityBlockItem {
    const id = `blk-${Date.now()}`;
    const folio = `BLQ-2026-${String(this.blocks().length + 1).padStart(4, '0')}`;
    const created: QualityBlockItem = {
      ...newBlock,
      id,
      folio,
      reportedAt: new Date().toISOString()
    };
    this.blocks.update(list => [created, ...list]);
    return created;
  }

  releaseBlock(
    blockId: string,
    releaseData: {
      authorizerType: ReleaseAuthorizerType;
      supportType: ReleaseSupportType;
      supportSubject: string;
      supportFileName?: string;
      authorizedByName: string;
      authorizedByPosition: string;
      destination: ReleaseDestination;
      decisionNotes: string;
    }
  ): QualityRelease | null {
    const block = this.blocks().find(b => b.id === blockId);
    if (!block) return null;

    // 1. Crear el registro formal de liberación
    const relId = `rel-${Date.now()}`;
    const relFolio = `LIB-2026-${String(this.releases().length + 1).padStart(4, '0')}`;

    const newRelease: QualityRelease = {
      id: relId,
      folio: relFolio,
      blockId: block.id,
      blockFolio: block.folio,
      sku: block.sku,
      description: block.description,
      batchNumber: block.batchNumber,
      clientName: block.clientName,
      quantity: block.quantity,
      unitOfMeasure: block.unitOfMeasure,
      authorizerType: releaseData.authorizerType,
      supportType: releaseData.supportType,
      supportSubject: releaseData.supportSubject,
      supportFileName: releaseData.supportFileName,
      authorizedByName: releaseData.authorizedByName,
      authorizedByPosition: releaseData.authorizedByPosition,
      destination: releaseData.destination,
      decisionNotes: releaseData.decisionNotes,
      releasedByUserId: 'usr-active-01',
      releasedByUserName: 'Laura Valdés (Auditora QM)',
      releasedAt: new Date().toISOString()
    };

    // 2. Actualizar estado del bloqueo a RELEASED
    this.blocks.update(list =>
      list.map(b => b.id === blockId ? { ...b, status: 'RELEASED' } : b)
    );

    // 3. Agregar a la lista de liberaciones
    this.releases.update(list => [newRelease, ...list]);

    return newRelease;
  }

  createLoadVerification(data: Omit<LoadVerification, 'id' | 'folio' | 'createdAt' | 'updatedAt'>): LoadVerification {
    const id = `ver-${Date.now()}`;
    const folio = `VER-2026-${String(this.loadVerifications().length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const created: LoadVerification = {
      ...data,
      id,
      folio,
      createdAt: now,
      updatedAt: now
    };

    this.loadVerifications.update(list => [created, ...list]);
    return created;
  }

  updateLoadVerification(updated: LoadVerification): void {
    this.loadVerifications.update(list =>
      list.map(v => v.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : v)
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. GENERADORES DE CRITERIOS DEFAULT (F01-PO-GC-8.6-03)
  // ══════════════════════════════════════════════════════════════════

  getDefaultProductCriteria(defaultValue: 'SI' | 'NO' | 'NA' = 'SI'): VerificationCriterion[] {
    return [
      {
        id: 'crit-prod-1',
        label: 'Tarima en buen estado (Habilitada para manipularse con montacargas).',
        value: defaultValue,
        actionIfNo: 'Se informa a las áreas correspondientes para su seguimiento y se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02',
        responsible: 'Mantenimiento, Calidad, Operaciones.',
        instructionCode: 'IT02-PO-GC-8.6-02',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-2',
        label: 'Pallet sin daños (Sin el producto expuesto y dañado).',
        value: defaultValue,
        actionIfNo: 'Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02',
        responsible: 'Calidad.',
        instructionCode: 'IT02-PO-GC-8.6-02',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-3',
        label: 'Embalaje en buen estado (sin aberturas o rasgaduras que afecte la inocuidad).',
        value: defaultValue,
        actionIfNo: 'Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02',
        responsible: 'Calidad.',
        instructionCode: 'IT02-PO-GC-8.6-02',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-4',
        label: 'Pallets limpios, (sin manchas en general, sustancia ajena al pallet, exceso de polvo etc.).',
        value: defaultValue,
        actionIfNo: 'Se realiza limpieza a pallet, en caso de exceso de polvo aplicando el instructivo IT01-PO-GC-8.6-01',
        responsible: 'Mantenimiento, Calidad.',
        instructionCode: 'IT01-PO-GC-8.6-01',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-5',
        label: 'Pallet visualmente estable o alineado.',
        value: defaultValue,
        actionIfNo: 'Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02',
        responsible: 'Calidad.',
        instructionCode: 'IT02-PO-GC-8.6-02',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-6',
        label: 'Producto coincide con lo solicitado por el cliente.',
        value: defaultValue,
        actionIfNo: 'Se reporta al líder en turno.',
        responsible: 'Calidad, operaciones.',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-7',
        label: 'Material identificado con UA de cliente.',
        value: defaultValue,
        actionIfNo: 'Se reporta al líder en turno.',
        responsible: 'Calidad, operaciones.',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-8',
        label: 'Producto libre de algún tipo de plaga.',
        value: defaultValue,
        actionIfNo: 'Se realiza un reporte, vía correo al cliente y dirección general, informando con evidencia fotográfica como respaldo del suceso, esperando respuesta por parte del cliente, para el seguimiento.',
        responsible: 'Calidad.',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-prod-9',
        label: 'Otros criterios específicos.',
        value: 'NA',
        actionIfNo: 'Evaluación puntual de calidad.',
        responsible: 'Calidad.',
        observations: '',
        isCritical: false
      }
    ];
  }

  getDefaultTransportCriteria(defaultValue: 'SI' | 'NO' | 'NA' = 'SI'): VerificationCriterion[] {
    return [
      {
        id: 'crit-trans-1',
        label: 'Camión cerrado o con lona en buenas condiciones.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-2',
        label: 'Paredes limpias.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-3',
        label: 'Puertas Limpias.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-4',
        label: 'Libre de indicios de plagas evidentes.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: '',
        isCritical: true
      },
      {
        id: 'crit-trans-5',
        label: 'Libre de aromas extraños.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-6',
        label: 'Piso limpio/Libre de obstáculos y en un buen estado.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-7',
        label: 'Libre de perforaciones.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-8',
        label: 'Llantas en buen estado.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad.',
        observations: ''
      },
      {
        id: 'crit-trans-9',
        label: 'Bloqueo de Seguridad (Uso de cartón, bolsa de aire, gatas, eslingas) Cuando la carga es foránea.',
        value: defaultValue,
        actionIfNo: 'Se toma evidencia de los criterios detectados y se comparte al cliente.',
        responsible: 'Calidad/Operaciones.',
        observations: ''
      }
    ];
  }

  private getDefaultProductCriteriaWithOverride(overrides: Record<string, Partial<VerificationCriterion>>): VerificationCriterion[] {
    return this.getDefaultProductCriteria('SI').map(c =>
      overrides[c.id] ? { ...c, ...overrides[c.id] } : c
    );
  }
}
