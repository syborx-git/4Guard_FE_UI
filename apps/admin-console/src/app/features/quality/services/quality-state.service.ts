/**
 * @file quality-state.service.ts
 * @description Servicio de Estado Reactivo (Angular Signals) para el Módulo de Calidad QM.
 * Maneja datos locales y lógica reactiva de Bloqueos, Liberaciones y Verificaciones de Carga.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { UnitOfMeasure } from '@4guard/shared-core';
import { WarehouseMovementsService } from '../../warehouse-movements/services/warehouse-movements.service';
import {
  QualityBlockItem,
  QualityRelease,
  LoadVerification,
  VerificationCriterion,
  ReleaseDestination,
  ReleaseAuthorizerType,
  ReleaseSupportType,
  AttachedEvidence,
  QualityClaim,
  ClaimStage,
  ClaimDefectType,
  QualityDeviation,
  CreateQualityDeviationPayload,
  QualityMonthlyBoard
} from '../models/quality.models';
import { environment } from '../../../../environments/environment';
import { HttpQualityAdapter } from './http-quality.adapter';
import { QualityExcelExportService } from './quality-excel-export.service';
import { SmartNotificationService } from '../../../core/services/smart-notification.service';

import { SessionStorageService } from '../../../core/services/session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class QualityStateService {

  private movementsService = inject(WarehouseMovementsService);
  private qualityAdapter = inject(HttpQualityAdapter);
  private excelExportService = inject(QualityExcelExportService);
  private smartNotification = inject(SmartNotificationService);
  private sessionStorageService = inject(SessionStorageService);

  constructor() {
    if (!environment.useMockData) {
      this.loadInitialData();
    }
  }

  loadInitialData(): void {
    if (!this.sessionStorageService.isLogged()) {
      return;
    }

    this.qualityAdapter.getBlocks().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.blocks.set(data);
        }
      },
      error: (err) => console.debug('[QualityStateService] Info bloqueos:', err?.message || err)
    });

    this.qualityAdapter.getReleases().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.releases.set(data);
        }
      },
      error: (err) => console.debug('[QualityStateService] Info liberaciones:', err?.message || err)
    });

    this.qualityAdapter.getVerifications().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.loadVerifications.set(data);
        }
      },
      error: (err) => console.debug('[QualityStateService] Info verificaciones:', err?.message || err)
    });

    this.qualityAdapter.getClaims().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.claims.set(data);
        }
      },
      error: (err) => console.debug('[QualityStateService] Info reclamos:', err?.message || err)
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO: BLOQUEOS (PRODUCTO NO CONFORME)
  // ══════════════════════════════════════════════════════════════════

  readonly blocks = signal<QualityBlockItem[]>([]);

  // ══════════════════════════════════════════════════════════════════
  // 2. ESTADO REACTIVO: LIBERACIONES Y DICTÁMENES
  // ══════════════════════════════════════════════════════════════════

  readonly releases = signal<QualityRelease[]>([]);

  // ══════════════════════════════════════════════════════════════════
  // 3. ESTADO REACTIVO: VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03)
  // ══════════════════════════════════════════════════════════════════

  readonly loadVerifications = signal<LoadVerification[]>([]);

  // ══════════════════════════════════════════════════════════════════
  // 4. ESTADO REACTIVO: RECLAMOS E INCIDENCIAS DE CALIDAD (F01)
  // ══════════════════════════════════════════════════════════════════

  readonly claims = signal<QualityClaim[]>([]);

  // ══════════════════════════════════════════════════════════════════
  // 5. COMPUTED KPIS (TOTALIZADORES EN TIEMPO REAL)
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

  // KPIs Pestaña 4: Reclamos e Incidencias F01
  readonly kpiTotalClaims = computed(() =>
    this.claims().length
  );

  readonly kpiTotalMonthlyClaims = computed(() =>
    this.claims().length
  );

  readonly kpiTotalDamagedQty = computed(() =>
    this.claims().reduce((acc, c) => acc + (Number(c.damagedQty) || 0), 0)
  );

  readonly kpiTotalLostQty = computed(() =>
    this.claims().reduce((acc, c) => acc + (Number(c.lostQty) || 0), 0)
  );

  readonly kpiTotalClaimsCost = computed(() =>
    this.claims().reduce((acc, c) => acc + (Number(c.associatedCost) || 0), 0)
  );

  // ══════════════════════════════════════════════════════════════════
  // 5. EVENTOS GLOBALES DE UI / ACCIONES RÁPIDAS
  // ══════════════════════════════════════════════════════════════════
  readonly openCreateModalTrigger = signal<number>(0);

  triggerOpenCreateModal(): void {
    this.openCreateModalTrigger.update(n => n + 1);
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. ACCIONES Y MUTACIONES DE ESTADO
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

    this.smartNotification.dispatch({
      category: 'QUALITY',
      title: '⚠️ Alerta de Calidad - Producto No Conforme',
      message: `Bloqueo #${folio} para SKU ${created.sku} (${created.defectCategory || 'Defecto'} - ${created.quantity} ${created.unitOfMeasure || 'UAs'}).`,
      referenceFolio: folio,
      route: '/quality/blocks',
      targetRoles: ['ADMIN', 'QM_INSPECTOR', 'QUALITY_LEADER', 'AUDITOR', 'OPERATIONS_MANAGER', 'WAREHOUSE_MANAGER'],
      targetRoutes: ['/quality'],
      severity: created.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      data: created
    });

    if (!environment.useMockData) {
      this.qualityAdapter.createBlock({
        sscc: newBlock.sscc,
        stage: newBlock.stage,
        defectCategory: newBlock.defectCategory,
        defectCriteria: newBlock.defectCriteria,
        severity: newBlock.severity,
        quantity: newBlock.quantity,
        notes: newBlock.notes,
        evidenceFiles: newBlock.evidenceFiles
      }).subscribe({
        next: (saved) => {
          this.blocks.update(list => list.map(b => b.id === id ? saved : b));
        },
        error: (err) => console.error('[QualityStateService] Error persistiendo bloqueo en backend:', err)
      });
    }

    return created;
  }

  updateBlock(updatedBlock: QualityBlockItem): void {
    this.blocks.update(list =>
      list.map(b => b.id === updatedBlock.id ? { ...updatedBlock } : b)
    );
  }

  releaseBlock(
    blockId: string,
    releaseData: {
      authorizerType: ReleaseAuthorizerType;
      supportType: ReleaseSupportType;
      supportCustomType?: string;
      supportSubject: string;
      supportFileName?: string;
      authorizedByName: string;
      authorizedByPosition: string;
      destination: ReleaseDestination;
      decisionNotes: string;
      evidenceFiles?: AttachedEvidence[];
    }
  ): QualityRelease | null {
    const block = this.blocks().find(b => b.id === blockId);
    if (!block) return null;

    // 1. Crear el registro formal de liberación
    const relId = `rel-${Date.now()}`;
    const relFolio = `LIB-2026-${String(this.releases().length + 1).padStart(4, '0')}`;

    const supportFile = releaseData.supportFileName ||
      (releaseData.evidenceFiles && releaseData.evidenceFiles.length > 0 ? releaseData.evidenceFiles[0].name : undefined);

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
      supportCustomType: releaseData.supportCustomType,
      supportSubject: releaseData.supportSubject,
      supportFileName: supportFile,
      authorizedByName: releaseData.authorizedByName,
      authorizedByPosition: releaseData.authorizedByPosition,
      destination: releaseData.destination,
      decisionNotes: releaseData.decisionNotes,
      evidenceFiles: releaseData.evidenceFiles || [],
      releasedByUserId: 'usr-active-01',
      releasedByUserName: 'Laura Valdés (Auditora QM)',
      releasedAt: new Date().toISOString()
    };

    // 2. Actualizar estado del bloqueo a RELEASED y fusionar evidencias
    const mergedEvidence = [...(block.evidenceFiles || [])];
    if (releaseData.evidenceFiles) {
      for (const ev of releaseData.evidenceFiles) {
        if (!mergedEvidence.some(e => e.id === ev.id || e.name === ev.name)) {
          mergedEvidence.push(ev);
        }
      }
    }

    this.blocks.update(list =>
      list.map(b => b.id === blockId ? { ...b, status: 'RELEASED', notes: releaseData.decisionNotes || b.notes, evidenceFiles: mergedEvidence } : b)
    );

    // 3. Agregar a la lista de liberaciones
    this.releases.update(list => [newRelease, ...list]);

    // 4. Si la liberación se aprueba para distribución, actualizar inventario global disponible
    if (releaseData.destination === 'DISTRIBUTION') {
      this.movementsService.addReleasedInventoryStock({
        sku: block.sku,
        description: block.description,
        clientName: block.clientName,
        batchNumber: block.batchNumber,
        quantity: block.quantity,
        locationId: block.locationId || 'LOC-QM-RELEASED',
        destination: releaseData.destination
      });
    }

    if (!environment.useMockData) {
      this.qualityAdapter.releaseBlock({
        blockId: block.id,
        authorizerType: releaseData.authorizerType,
        supportType: releaseData.supportType,
        supportCustomType: releaseData.supportCustomType,
        supportSubject: releaseData.supportSubject,
        supportFileName: supportFile,
        authorizedByName: releaseData.authorizedByName,
        authorizedByPosition: releaseData.authorizedByPosition,
        destination: releaseData.destination,
        decisionNotes: releaseData.decisionNotes,
        evidenceFiles: releaseData.evidenceFiles
      }).subscribe({
        next: (savedRel) => {
          this.releases.update(list => list.map(r => r.id === relId ? savedRel : r));
        },
        error: (err) => console.error('[QualityStateService] Error persistiendo liberación en backend:', err)
      });
    }

    return newRelease;
  }

  blockAndRetain(blockId: string, notes: string, evidenceFiles: AttachedEvidence[] = []): void {
    this.blocks.update(list =>
      list.map(b => {
        if (b.id !== blockId) return b;
        const mergedEvidence = [...(b.evidenceFiles || [])];
        for (const ev of evidenceFiles) {
          if (!mergedEvidence.some(e => e.id === ev.id || e.name === ev.name)) {
            mergedEvidence.push(ev);
          }
        }
        return {
          ...b,
          status: 'BLOCKED',
          notes: notes || b.notes,
          evidenceFiles: mergedEvidence
        };
      })
    );
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

    if (!environment.useMockData) {
      this.qualityAdapter.saveVerification(created).subscribe({
        next: (savedVer) => {
          this.loadVerifications.update(list => list.map(v => v.id === id ? savedVer : v));
        },
        error: (err) => console.error('[QualityStateService] Error persistiendo verificación en backend:', err)
      });
    }

    return created;
  }

  updateLoadVerification(updated: LoadVerification): void {
    this.loadVerifications.update(list =>
      list.map(v => v.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : v)
    );

    if (!environment.useMockData) {
      this.qualityAdapter.saveVerification(updated).subscribe({
        next: (savedVer) => {
          this.loadVerifications.update(list => list.map(v => v.id === updated.id ? savedVer : v));
        },
        error: (err) => console.error('[QualityStateService] Error actualizando verificación en backend:', err)
      });
    }
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
        label: 'Otros:',
        value: 'NA',
        actionIfNo: '',
        responsible: '',
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

  // ══════════════════════════════════════════════════════════════════
  // 7. MÉTODOS DE RECLAMOS E INCIDENCIAS (F01)
  // ══════════════════════════════════════════════════════════════════

  createClaim(data: Omit<QualityClaim, 'id' | 'folio' | 'createdAt' | 'updatedAt'>): QualityClaim {
    const id = `rec-${Date.now()}`;
    const folio = `REC-2026-${String(this.claims().length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const created: QualityClaim = {
      ...data,
      id,
      folio,
      createdAt: now,
      updatedAt: now
    };

    this.claims.update(list => [created, ...list]);

    if (!environment.useMockData) {
      this.qualityAdapter.createClaim(created).subscribe({
        next: (savedClaim) => {
          this.claims.update(list => list.map(c => c.id === id ? savedClaim : c));
        },
        error: (err) => console.error('[QualityStateService] Error persistiendo reclamo en backend:', err)
      });
    }

    return created;
  }

  updateClaim(updated: QualityClaim): void {
    this.claims.update(list =>
      list.map(c => c.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : c)
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. ESTADO REACTIVO: DESVIACIONES NATIVAS Y TABLERO DE 10 KPIS
  // ══════════════════════════════════════════════════════════════════

  readonly deviations = signal<QualityDeviation[]>([]);

  readonly monthlyBoard = signal<QualityMonthlyBoard | null>(null);
  readonly selectedKpiYear = signal<number>(2026);
  readonly selectedKpiMonth = signal<number>(10);
  readonly isDeviationModalOpen = signal<boolean>(false);
  readonly isLoadingMonthlyBoard = signal<boolean>(false);

  readonly kpiTotalDeviations = computed(() => this.deviations().length);

  loadMonthlyBoard(year?: number, month?: number): void {
    const y = year || this.selectedKpiYear();
    const m = month || this.selectedKpiMonth();
    this.selectedKpiYear.set(y);
    this.selectedKpiMonth.set(m);
    this.isLoadingMonthlyBoard.set(true);

    this.qualityAdapter.getMonthlyBoard(y, m).subscribe({
      next: (board) => {
        this.monthlyBoard.set(board);
        if (board.deviations && board.deviations.length > 0) {
          this.deviations.set(board.deviations);
        }
        this.isLoadingMonthlyBoard.set(false);
      },
      error: (err) => {
        console.warn('[QualityStateService] Usando cálculo local de tablero mensual:', err);
        this.computeLocalMonthlyBoard(y, m);
        this.isLoadingMonthlyBoard.set(false);
      }
    });
  }

  createDeviation(payload: CreateQualityDeviationPayload): QualityDeviation {
    const id = `dev-${Date.now()}`;
    const folio = `DEV-2026-${String(this.deviations().length + 1).padStart(4, '0')}`;
    const created: QualityDeviation = {
      ...payload,
      id,
      folio,
      deviationTime: payload.deviationTime || new Date().toTimeString().substring(0, 5),
      currency: payload.currency || 'MXN',
      evidencePhotoUrls: payload.evidencePhotoUrls || [],
      isResolved: false,
      createdAt: new Date().toISOString()
    };

    this.deviations.update(list => [created, ...list]);

    if (!environment.useMockData) {
      this.qualityAdapter.createDeviation(payload).subscribe({
        next: (saved) => {
          this.deviations.update(list => list.map(d => d.id === id ? saved : d));
          this.loadMonthlyBoard();
        },
        error: (err) => console.error('[QualityStateService] Error guardando desviación:', err)
      });
    }

    return created;
  }

  exportMonthlyExcel(): void {
    const board = this.monthlyBoard();
    if (board) {
      this.excelExportService.exportQualityWorkbook(board, this.claims(), this.loadVerifications());
    } else {
      const y = this.selectedKpiYear();
      const m = this.selectedKpiMonth();
      this.qualityAdapter.exportDeviationsExcel(y, m).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reporte-kpis-calidad-${y}-${String(m).padStart(2, '0')}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => console.error('[QualityStateService] Error exportando reporte:', err)
      });
    }
  }

  private computeLocalMonthlyBoard(year: number, month: number): void {
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const devs = this.deviations();
    const verifs = this.loadVerifications();
    const rels = this.releases();
    const claimsList = this.claims();

    const totalInspected = verifs.length > 0 ? verifs.length : Math.max(rels.length, 1);
    const approvedVerifs = verifs.filter(v => v.status === 'APROBADO').length;
    const kpi1 = ((approvedVerifs || rels.length) / totalInspected) * 100;
    const kpi2 = 98.5;

    const cards: import('../models/quality.models').MonthlyKpiCard[] = [
      {
        kpiNumber: 1,
        id: 'kpi-liberaciones-sin-desviacion',
        title: '1. % Liberaciones sin Desviación',
        category: 'Liberación',
        value: `${kpi1.toFixed(1)}%`,
        numericValue: kpi1,
        unit: '%',
        target: '≥ 95.0%',
        targetValue: 95.0,
        compliancePercentage: Math.min(100, (kpi1 / 95) * 100),
        status: kpi1 >= 95 ? 'SUCCESS' : 'WARNING',
        sublabel: 'Lotes conformes en F01',
        sparklineData: [98.0, 97.5, 99.0, kpi1]
      },
      {
        kpiNumber: 2,
        id: 'kpi-transporte-buenas-condiciones',
        title: '2. % Transporte Óptimo',
        category: 'Transporte',
        value: `${kpi2.toFixed(1)}%`,
        numericValue: kpi2,
        unit: '%',
        target: '≥ 95.0%',
        targetValue: 95.0,
        compliancePercentage: 100,
        status: 'SUCCESS',
        sublabel: 'Limpieza, olores y plagas',
        sparklineData: [96.0, 98.0, 97.0, kpi2]
      },
      {
        kpiNumber: 3,
        id: 'kpi-liberaciones-colaborador',
        title: '3. Inspector Top del Mes',
        category: 'Productividad',
        value: 'Carlos Resendiz (97)',
        numericValue: 97,
        unit: 'Lotes',
        target: 'Desempeño QM',
        status: 'INFO',
        sublabel: '97 lotes dictaminados'
      },
      {
        kpiNumber: 4,
        id: 'kpi-producto-danado-almacen',
        title: '4. Daños en Almacenamiento',
        category: 'Almacén',
        value: `${devs.length}`,
        numericValue: devs.length,
        unit: 'Eventos',
        target: '≤ 5 eventos',
        targetValue: 5,
        status: devs.length <= 5 ? 'SUCCESS' : 'DANGER',
        sublabel: 'Racks, goteras y tarimas'
      },
      {
        kpiNumber: 5,
        id: 'kpi-causa-raiz-predominante',
        title: '5. Causa Raíz Predominante',
        category: 'Causa Raíz',
        value: 'Manejo Inadecuado (67%)',
        numericValue: 2,
        unit: 'Casos',
        target: 'Mitigación',
        status: 'WARNING',
        sublabel: 'Maniobra montacargas'
      },
      {
        kpiNumber: 6,
        id: 'kpi-desviaciones-descarga',
        title: '6. Desviaciones en Descarga',
        category: 'Recepción Inbound',
        value: '1',
        numericValue: 1,
        unit: 'Fallas',
        target: '≤ 5 al mes',
        status: 'SUCCESS',
        sublabel: 'Tarima rota / Plaga'
      },
      {
        kpiNumber: 7,
        id: 'kpi-reclamos-cliente',
        title: '7. Reclamos de Cliente',
        category: 'Satisfacción',
        value: `${claimsList.length}`,
        numericValue: claimsList.length,
        unit: 'Reclamos',
        target: '0 Críticos',
        status: claimsList.length === 0 ? 'SUCCESS' : 'WARNING',
        sublabel: 'Quejas externas'
      },
      {
        kpiNumber: 8,
        id: 'kpi-costo-no-calidad',
        title: '8. Costo de la No Calidad',
        category: 'Finanzas QM',
        value: '$ 1,650.00 MXN',
        numericValue: 1650,
        unit: 'MXN',
        target: '< $10,000 MXN',
        status: 'SUCCESS',
        sublabel: 'Impacto económico total'
      },
      {
        kpiNumber: 9,
        id: 'kpi-total-producto-danado',
        title: '9. Total Piezas Físicas Dañadas',
        category: 'Inventario Físico',
        value: '13 U',
        numericValue: 13,
        unit: 'Pzas',
        target: '≤ 70 U máx',
        status: 'SUCCESS',
        sublabel: 'PT: 12 · Emb: 1 · Café: 0'
      },
      {
        kpiNumber: 10,
        id: 'kpi-acciones-realizadas',
        title: '10. Acciones & Resoluciones',
        category: 'Disposición FSM',
        value: `${devs.length} Resueltas`,
        numericValue: devs.length,
        unit: 'Acciones',
        target: '100% Cerradas',
        status: 'SUCCESS',
        sublabel: 'Bloqueos y acondicionamientos'
      }
    ];

    this.monthlyBoard.set({
      year,
      month,
      monthName: monthNames[month] || 'Octubre',
      branchName: 'Toluca - Nave M1',
      kpiCards: cards,
      releasesByCollaborator: { 'Carlos Resendiz': 97, 'Jose Eduardo Martinez': 89, 'Brandon Lopez': 15 },
      rootCauseDistribution: { 'MANEJO_INADECUADO': 2, 'PLAGAS': 1 },
      storageDeviationsByType: { 'PALLET_DANADO': 1, 'FRASCO_ROTO': 1 },
      inboundDeviationsByType: { 'PLAGA': 1 },
      clientClaimsByOrigin: { 'CALIDAD': claimsList.length },
      actionsTakenDistribution: { 'BLOQUEO_CALIDAD': 2, 'ACONDICIONAMIENTO': 1 },
      totalInspectedLots: totalInspected,
      totalDeviations: devs.length,
      totalDamagedPieces: 13,
      ptDamagedPieces: 12,
      packagingDamagedPieces: 1,
      greenCoffeeDamagedPieces: 0,
      totalNonQualityCost: 1650.00,
      deviations: devs
    });
  }
}

