/**
 * @file counting-scan.component.ts
 * @description Módulo de Conteo Cíclico Ciego (Conteo Físico Puro) — 4GUARD WMS Terminal RF PWA.
 * Implementa estrictamente la especificación ejecutiva y diseño ergonómico SDD:
 * - Principio Inmutable de Conteo Ciego Puro (el operador NUNCA ve existencias teóricas).
 * - Cámara en Vivo con HUD Láser, conmutador Frontal/Trasera y Toque para Escanear.
 * - Candado de Presencia Física por Rack (HU-049).
 * - Protocolo Zone Lease (30 min) para evitar colisiones (HU-155).
 * - Soporte Offline con cola local IndexedDB (HU-050).
 * - Matriz de Resolución de Discrepancias y Alimentación al KPI IRA % (HU-051 / HU-159).
 */

import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState, SyncState, ZoneLeaseService, ToastService } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

export interface CountedPalletRecord {
  id: string;
  sscc: string;
  sku: string;
  productName: string;
  physicalPieces: number;
  physicalLot: string;
  scannedAt: string;
  isOfflineSaved: boolean;
}

export interface TheoreticalItemHidden {
  sscc: string;
  sku: string;
  expectedPieces: number;
  expectedLot: string;
}

export interface CountingLocationItem {
  id: string;
  rackLabel: string;
  barcode: string;
  aisle: string;
  level: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'AUDITED' | 'DISCREPANCY_PENDING';
  itemsCounted: CountedPalletRecord[];
  theoreticalStockHidden: TheoreticalItemHidden[];
}

export interface CountingAuditTask {
  folio: string;
  cycleName: string;
  zone: string;
  supervisorName: string;
  locations: CountingLocationItem[];
}

@Component({
  selector: 'fg-rf-counting-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './counting-scan.component.html',
  styleUrl: './counting-scan.component.css',
})
export class CountingScanComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scanInput') scanInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;

  protected readonly authState    = inject(AuthState);
  protected readonly syncState    = inject(SyncState);
  protected readonly zoneLease    = inject(ZoneLeaseService);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly toast        = inject(ToastService);
  private readonly router         = inject(Router);

  // ─── Cámara en Vivo / Lector HUD ──────────────────────────────────────────
  protected readonly cameraActive           = signal<boolean>(true);
  protected readonly cameraLoading          = signal<boolean>(false);
  protected readonly cameraError            = signal<string | null>(null);
  protected readonly currentFacingMode      = signal<'environment' | 'user'>('environment');
  protected readonly availableCamerasCount  = signal<number>(1);
  protected readonly scanFlashActive        = signal<boolean>(false);
  private mediaStream: MediaStream | null   = null;

  // ─── Tarea de Auditoría Asignada (Demo Inicial) ───────────────────────────
  protected readonly auditTask = signal<CountingAuditTask>({
    folio: 'AUD-2026-019',
    cycleName: 'Auditoría Cíclica A • Alta Rotación (3PL)',
    zone: 'Pasillo 04 • Racks Centrales B01 a B04',
    supervisorName: 'Ing. Miguel Torres (Mesa de Control)',
    locations: [
      {
        id: 'LOC-P04-R01-A',
        rackLabel: 'Pasillo 04 • Rack 01 • Nivel A (Piso)',
        barcode: 'LOC-P04-R01-A',
        aisle: 'Pasillo 04',
        level: 'Nivel A',
        status: 'AUDITED',
        itemsCounted: [
          {
            id: 'CNT-001',
            sscc: 'SSCC-175012345000000010',
            sku: 'SKU-441029',
            productName: 'Líquido de Frenos DOT-4 Pro',
            physicalPieces: 60,
            physicalLot: 'LOT-2026-F01',
            scannedAt: '12:40:15',
            isOfflineSaved: false,
          },
        ],
        theoreticalStockHidden: [
          { sscc: 'SSCC-175012345000000010', sku: 'SKU-441029', expectedPieces: 60, expectedLot: 'LOT-2026-F01' },
        ],
      },
      {
        id: 'LOC-P04-R02-B',
        rackLabel: 'Pasillo 04 • Rack 02 • Nivel B (Medio)',
        barcode: 'LOC-P04-R02-B',
        aisle: 'Pasillo 04',
        level: 'Nivel B',
        status: 'IN_PROGRESS',
        itemsCounted: [
          {
            id: 'CNT-002',
            sscc: 'SSCC-175012345000000018',
            sku: 'SKU-881204',
            productName: 'Aceite Sintético 5W-30 Ultra',
            physicalPieces: 48,
            physicalLot: 'LOT-2026-Y01',
            scannedAt: '12:52:10',
            isOfflineSaved: false,
          },
        ],
        theoreticalStockHidden: [
          { sscc: 'SSCC-175012345000000018', sku: 'SKU-881204', expectedPieces: 48, expectedLot: 'LOT-2026-Y01' },
          { sscc: 'SSCC-175012345000000025', sku: 'SKU-881204', expectedPieces: 48, expectedLot: 'LOT-2026-Y01' },
        ],
      },
      {
        id: 'LOC-P04-R03-A',
        rackLabel: 'Pasillo 04 • Rack 03 • Nivel A (Piso)',
        barcode: 'LOC-P04-R03-A',
        aisle: 'Pasillo 04',
        level: 'Nivel A',
        status: 'PENDING',
        itemsCounted: [],
        theoreticalStockHidden: [
          { sscc: 'SSCC-175012345000000030', sku: 'SKU-992011', expectedPieces: 32, expectedLot: 'LOT-2026-Z09' },
        ],
      },
      {
        id: 'LOC-P04-R04-C',
        rackLabel: 'Pasillo 04 • Rack 04 • Nivel C (Alto)',
        barcode: 'LOC-P04-R04-C',
        aisle: 'Pasillo 04',
        level: 'Nivel C',
        status: 'PENDING',
        itemsCounted: [],
        theoreticalStockHidden: [
          { sscc: 'SSCC-175012345000000045', sku: 'SKU-773019', expectedPieces: 50, expectedLot: 'LOT-2026-W02' },
        ],
      },
    ],
  });

  // ─── Estado de la Ubicación Activa y Candados ──────────────────────────────
  protected readonly currentLocIndex   = signal<number>(1);
  protected readonly isRackUnlocked    = signal<boolean>(false); // Inicia bloqueado para exigir escaneo de bahía
  protected readonly manualInputCode   = signal<string>('');
  protected readonly manualInputPieces = signal<number>(48);
  protected readonly manualInputLot    = signal<string>('LOT-2026-Y01');

  // ─── Zone Lease Timer (30 min) HU-155 ─────────────────────────────────────
  protected readonly zoneLeaseSeconds = signal<number>(1680); // ~28 min restantes
  private leaseTimerInterval: any = null;
  private barcodeDetectorTimer: any = null;

  // ─── Modo Offline & Cola IndexedDB HU-050 ──────────────────────────────────
  protected readonly isOfflineMode     = signal<boolean>(false);
  protected readonly offlineQueueCount = signal<number>(0);

  // ─── Feedback y Alertas de Escaneo ────────────────────────────────────────
  protected readonly scanFeedback = signal<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    detail?: string;
  } | null>({
    type: 'info',
    title: 'Paso 1: Validación de Bahía Requerida',
    detail: 'Apunta la cámara o láser al código del rack (LOC-P04-R02-B) para desbloquear el conteo ciego.',
  });

  // ─── Modal de Cierre de Ubicación & Discrepancias HU-051 ───────────────────
  protected readonly showSummaryModal    = signal<boolean>(false);
  protected readonly evaluatedDiscrepancy = signal<{
    isExact: boolean;
    physicalPiecesTotal: number;
    theoreticalPiecesTotal: number;
    deltaPieces: number;
    iraPercentage: number;
    supervisorAction: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECOUNT_REQUESTED';
  } | null>(null);

  // ─── Catálogo Rápido de Productos para Demo ───────────────────────────────
  private readonly MOCK_CATALOG: Record<string, { sku: string; name: string; defaultPcs: number; defaultLot: string }> = {
    'SSCC-175012345000000018': { sku: 'SKU-881204', name: 'Aceite Sintético 5W-30 Ultra', defaultPcs: 48, defaultLot: 'LOT-2026-Y01' },
    'SSCC-175012345000000025': { sku: 'SKU-881204', name: 'Aceite Sintético 5W-30 Ultra', defaultPcs: 48, defaultLot: 'LOT-2026-Y01' },
    'SSCC-175012345000000030': { sku: 'SKU-992011', name: 'Anticongelante Concentrado 50/50', defaultPcs: 32, defaultLot: 'LOT-2026-Z09' },
    'SSCC-175012345000000045': { sku: 'SKU-773019', name: 'Grasa Industrial Multiuso EP-2', defaultPcs: 50, defaultLot: 'LOT-2026-W02' },
    'SKU-881204':             { sku: 'SKU-881204', name: 'Aceite Sintético 5W-30 Ultra', defaultPcs: 12, defaultLot: 'LOT-2026-Y01' },
  };

  // ─── Filtros Contextuales (Pills de Auditoría Homologadas) ────────────────
  protected readonly currentFilter = signal<'ALL' | 'CURRENT' | 'PENDING' | 'AUDITED' | 'DISCREPANCY'>('ALL');
  protected readonly showCameraModal = signal<boolean>(false);

  // ─── Señales Computadas ───────────────────────────────────────────────────
  protected readonly currentLocation = computed<CountingLocationItem>(() => {
    const list = this.auditTask().locations;
    const idx = this.currentLocIndex();
    return list[idx] || list[0];
  });

  protected readonly totalLocationsCount = computed(() => this.auditTask().locations.length);
  
  protected readonly auditedLocationsCount = computed(() => {
    return this.auditTask().locations.filter(l => l.status === 'AUDITED').length;
  });

  protected readonly pendingLocationsCount = computed(() => {
    return this.auditTask().locations.filter(l => l.status === 'PENDING').length;
  });

  protected readonly discrepancyLocationsCount = computed(() => {
    return this.auditTask().locations.filter(l => l.status === 'DISCREPANCY_PENDING').length;
  });

  protected readonly filterCounts = computed(() => ({
    all: this.totalLocationsCount(),
    current: 1,
    pending: this.pendingLocationsCount(),
    audited: this.auditedLocationsCount(),
    discrepancy: this.discrepancyLocationsCount(),
  }));

  protected readonly currentLocPhysicalPiecesTotal = computed(() => {
    return this.currentLocation().itemsCounted.reduce((acc, i) => acc + i.physicalPieces, 0);
  });

  protected readonly currentLocPalletsCount = computed(() => {
    return this.currentLocation().itemsCounted.length;
  });

  protected readonly leaseTimeFormatted = computed(() => {
    const sec = this.zoneLeaseSeconds();
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  protected setFilter(f: 'ALL' | 'CURRENT' | 'PENDING' | 'AUDITED' | 'DISCREPANCY'): void {
    this.currentFilter.set(f);
    this.audioService.playSuccess();
  }

  protected openCameraModal(): void {
    this.showCameraModal.set(true);
    this.startCamera();
    this.audioService.playSuccess();
  }

  protected closeCameraModal(): void {
    this.showCameraModal.set(false);
  }

  protected resetDemo(): void {
    this.zoneLeaseSeconds.set(1800);
    this.currentLocIndex.set(1);
    this.isRackUnlocked.set(true);
    this.manualInputPieces.set(48);
    this.manualInputLot.set('LOT-2026-Y01');
    this.audioService.playSuccess();
    this.scanFeedback.set({
      type: 'info',
      title: 'Auditoría Cíclica Reiniciada',
      detail: 'Valores restablecidos a estado de demostración inicial.',
    });
  }

  async ngOnInit(): Promise<void> {
    // Inicialización del componente
  }

  ngAfterViewInit(): void {
    this.focusInput();
    this.startZoneLeaseTimer();
    this.zoneLease.requestLease('PASILLO-04', 'Pasillo 04 • Racks B01 a B04');
    this.startCamera();
    this.initBarcodeDetector();
  }

  ngOnDestroy(): void {
    if (this.leaseTimerInterval) {
      clearInterval(this.leaseTimerInterval);
    }
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
    }
    this.stopCamera();
  }

  private initBarcodeDetector(): void {
    if (typeof (window as any).BarcodeDetector !== 'undefined') {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'qr_code', 'data_matrix', 'itf'],
        });

        this.barcodeDetectorTimer = setInterval(async () => {
          if (this.cameraVideoRef?.nativeElement && this.cameraActive()) {
            try {
              const barcodes = await detector.detect(this.cameraVideoRef.nativeElement);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                this.processScan(barcodes[0].rawValue);
              }
            } catch {}
          }
        }, 500);
      } catch {}
    }
  }

  protected focusInput(): void {
    try {
      this.scanInputRef?.nativeElement?.focus({ preventScroll: true });
    } catch {}
  }

  private startZoneLeaseTimer(): void {
    this.leaseTimerInterval = setInterval(() => {
      if (this.zoneLeaseSeconds() > 0) {
        this.zoneLeaseSeconds.update(s => s - 1);
      }
    }, 1000);
  }

  // ─── Gestión de Cámara en Vivo ────────────────────────────────────────────
  async startCamera(mode: 'environment' | 'user' = 'environment'): Promise<void> {
    this.cameraLoading.set(true);
    this.cameraError.set(null);
    this.currentFacingMode.set(mode);

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          this.availableCamerasCount.set(videoDevs.length);
        } catch {}

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        this.mediaStream = stream;
        this.cameraActive.set(true);
        this.cameraLoading.set(false);

        setTimeout(() => {
          if (this.cameraVideoRef?.nativeElement) {
            this.cameraVideoRef.nativeElement.srcObject = stream;
            this.cameraVideoRef.nativeElement.play().catch(() => {});
          }
        }, 100);
      } else {
        this.cameraActive.set(false);
        this.cameraLoading.set(false);
      }
    } catch {
      this.cameraActive.set(false);
      this.cameraLoading.set(false);
    }
  }

  async switchCamera(): Promise<void> {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(25);
    await this.startCamera(newMode);
  }

  toggleCamera(): void {
    if (this.cameraActive()) {
      this.stopCamera();
      this.cameraActive.set(false);
    } else {
      this.startCamera(this.currentFacingMode());
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  // Toque en el visor de cámara para simular escaneo instantáneo
  onCameraTapped(): void {
    this.triggerFlashEffect();
    if (!this.isRackUnlocked()) {
      this.simScanRack();
    } else {
      this.simScanValidPallet();
    }
  }

  private triggerFlashEffect(): void {
    this.scanFlashActive.set(true);
    setTimeout(() => this.scanFlashActive.set(false), 220);
  }

  protected registerCurrentManualPallet(): void {
    const code = this.manualInputCode() || 'SSCC-175012345000000025';
    this.processScan(code);
  }

  protected unlockCurrentRack(): void {
    const code = this.manualInputCode().trim() || this.currentLocation().barcode;
    this.processScan(code);
  }

  // ─── Procesador Central de Escaneo (Láser o Teclado) ──────────────────────
  protected processScan(codeRaw: string): void {
    const code = codeRaw.trim().toUpperCase();
    if (!code) return;

    // Regla 1: Bloqueo preventivo por expiración de Zone Lease (HU-155 / 30 min)
    if (this.zoneLease.isScanLocked()) {
      this.audioService.playError();
      this.scanFeedback.set({
        type: 'error',
        title: 'Arrendamiento Expirado (30 Minutos) — Escaneo Bloqueado',
        detail: 'Debes renovar el Zone Lease o acercarte a zona con red para continuar operando en este pasillo.',
      });
      return;
    }

    // Regla 2: Bloqueo preventivo por cola IndexedDB llena (500 operaciones)
    if (this.syncState.isQueueFull()) {
      this.audioService.playError();
      this.scanFeedback.set({
        type: 'error',
        title: 'Tope de 500 Operaciones Offline Alcanzado',
        detail: 'La memoria local está al 100%. Acércate a cobertura Wi-Fi para vaciar la cola antes de continuar.',
      });
      return;
    }

    this.manualInputCode.set('');
    this.triggerFlashEffect();

    // PASO 2: Si el rack está bloqueado, se exige validar el código de barras del rack
    if (!this.isRackUnlocked()) {
      const targetBarcode = this.currentLocation().barcode;
      if (code === targetBarcode || code === targetBarcode.replace('LOC-', '')) {
        this.isRackUnlocked.set(true);
        this.audioService.playSuccess();
        this.toast.success(`Bahía ${this.currentLocation().rackLabel} desbloqueada para conteo ciego.`, 'PRESENCIA CONFIRMADA');
        this.scanFeedback.set({
          type: 'success',
          title: 'Presencia Física Validada con Éxito',
          detail: `Rack ${this.currentLocation().rackLabel} desbloqueado para conteo ciego.`,
        });
      } else {
        this.audioService.playError();
        this.toast.error(`Código incorrecto (${code}). Debes posicionarte físicamente y escanear ${targetBarcode}.`, 'CANDADO EN RACK');
        this.scanFeedback.set({
          type: 'error',
          title: 'Ubicación Incorrecta — Candado Activo',
          detail: `Debes posicionarte físicamente y escanear ${targetBarcode}. (Escaneado: ${code})`,
        });
      }
      return;
    }

    // PASO 3: Conteo Ciego de Tarima SSCC o SKU
    const existing = this.currentLocation().itemsCounted.find(i => i.sscc === code);
    if (existing) {
      this.audioService.playWarning();
      this.toast.warning(`La tarima ${code} ya está registrada en este rack (${existing.physicalPieces} pzas).`, 'DUPLICADO');
      this.scanFeedback.set({
        type: 'warning',
        title: 'Tarima Ya Registrada en este Rack',
        detail: `El código ${code} ya fue capturado (${existing.physicalPieces} piezas).`,
      });
      return;
    }

    const matched = this.MOCK_CATALOG[code];
    const sku = matched?.sku || 'SKU-881204';
    const productName = matched?.name || 'Mercancía General Identificada';
    const pieces = this.manualInputPieces() > 0 ? this.manualInputPieces() : (matched?.defaultPcs || 48);
    const lot = this.manualInputLot() || matched?.defaultLot || 'LOT-2026-Y01';

    const newRecord: CountedPalletRecord = {
      id: `CNT-${Date.now().toString().slice(-4)}`,
      sscc: code,
      sku,
      productName,
      physicalPieces: pieces,
      physicalLot: lot,
      scannedAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isOfflineSaved: this.isOfflineMode(),
    };

    // Actualizar ubicación activa en memoria local
    const updatedLoc = {
      ...this.currentLocation(),
      itemsCounted: [newRecord, ...this.currentLocation().itemsCounted],
      status: 'IN_PROGRESS' as const,
    };

    this.updateCurrentLocationInTask(updatedLoc);

    // Encolar en IndexedDB bajo política FIFO (HU-050)
    this.syncState.enqueue({
      actionType: 'COUNT_PALLET_REGISTRATION',
      method: 'POST',
      url: '/api/v1/counting/pallets',
      body: JSON.stringify(newRecord),
      description: `Conteo Ciego: Tarima ${code} (${pieces} pzas) en ${this.currentLocation().barcode}`,
      zoneId: 'PASILLO-04',
    });

    if (this.isOfflineMode()) {
      this.offlineQueueCount.update(c => c + 1);
      this.audioService.playSuccess();
      this.toast.info(`Tarima ${code} guardada en IndexedDB FIFO (${pieces} pzas).`, 'COLA LOCAL OFFLINE');
      this.scanFeedback.set({
        type: 'info',
        title: 'Captura Offline Persistida en IndexedDB',
        detail: `Tarima ${code} (${pieces} pzas) encolada en orden FIFO (${this.syncState.pendingCount()}/${this.syncState.maxCapacity} ops).`,
      });
    } else {
      this.audioService.playSuccess();
      this.toast.success(`Tarima ${code} registrada con éxito (${pieces} piezas).`, 'CONTEO REGISTRADO');
      this.scanFeedback.set({
        type: 'success',
        title: 'Tarima Física Registrada con Éxito',
        detail: `Código: ${code} • Cantidad: ${pieces} piezas • Lote: ${lot}`,
      });
    }
  }

  // ─── Ajustes Rápidos de Cantidad (+1, +6, +12, +24, +48) ──────────────────
  protected setQuickPieces(qty: number): void {
    this.manualInputPieces.set(qty);
    this.audioService.playSuccess();
  }

  protected addQuickPieces(delta: number): void {
    this.manualInputPieces.update(q => Math.max(1, q + delta));
    this.audioService.playSuccess();
  }

  // ─── Eliminación de un Registro del Buffer ─────────────────────────────────
  protected removeRecord(recordId: string): void {
    const updatedItems = this.currentLocation().itemsCounted.filter(r => r.id !== recordId);
    const updatedLoc = { ...this.currentLocation(), itemsCounted: updatedItems };
    this.updateCurrentLocationInTask(updatedLoc);
    this.audioService.playWarning();
    this.toast.warning('Registro de tarima eliminado del buffer local.', 'BUFFER MODIFICADO');
  }

  // ─── Finalización de Conteo en Ubicación & Evaluación de Discrepancia ──────
  protected concludeLocationCount(): void {
    const loc = this.currentLocation();
    const physicalTotal = loc.itemsCounted.reduce((acc, i) => acc + i.physicalPieces, 0);
    const theoreticalTotal = loc.theoreticalStockHidden.reduce((acc, i) => acc + i.expectedPieces, 0);
    const delta = physicalTotal - theoreticalTotal;
    const isExact = delta === 0 && loc.itemsCounted.length === loc.theoreticalStockHidden.length;
    const ira = isExact ? 100 : Math.max(0, Math.round((1 - Math.abs(delta) / (theoreticalTotal || 1)) * 100));

    this.evaluatedDiscrepancy.set({
      isExact,
      physicalPiecesTotal: physicalTotal,
      theoreticalPiecesTotal: theoreticalTotal,
      deltaPieces: delta,
      iraPercentage: ira,
      supervisorAction: isExact ? 'APPROVED' : 'PENDING',
    });

    this.showSummaryModal.set(true);
    if (isExact) {
      this.audioService.playSuccess();
      this.toast.success(`Conteo exacto en ${loc.barcode} (IRA: 100%). Listo para conciliar.`, 'CONTEO EXACTO');
    } else {
      this.audioService.playWarning();
      this.toast.warning(`Discrepancia detectada en ${loc.barcode}: ${delta > 0 ? '+' : ''}${delta} piezas. Turnada a dictamen.`, 'DISCREPANCIA (HU-051)');
    }
  }

  // ─── Resolución de Discrepancias (Acciones del Supervisor HU-051) ──────────
  protected resolveDiscrepancy(action: 'APPROVED' | 'REJECTED' | 'RECOUNT_REQUESTED'): void {
    if (this.evaluatedDiscrepancy()) {
      this.evaluatedDiscrepancy.update(d => d ? { ...d, supervisorAction: action } : null);
    }

    const currentLoc = this.currentLocation();
    let newStatus: CountingLocationItem['status'] = 'AUDITED';
    if (action === 'RECOUNT_REQUESTED') {
      newStatus = 'DISCREPANCY_PENDING';
    }

    this.updateCurrentLocationInTask({
      ...currentLoc,
      status: newStatus,
    });

    this.audioService.playSuccess();
    const actionNames: Record<string, string> = {
      APPROVED: 'Aprobado y ajustado en WMS',
      RECOUNT_REQUESTED: 'Reconteo solicitado (Cuarentena)',
      REJECTED: 'Conteo rechazado'
    };
    this.toast.success(`Dictamen de supervisor aplicado: ${actionNames[action]}`, 'MESA DE CONTROL');
  }

  // ─── Avanzar a la Siguiente Ubicación de la Ruta ──────────────────────────
  protected nextLocation(): void {
    this.showSummaryModal.set(false);
    const nextIdx = this.currentLocIndex() + 1;
    if (nextIdx < this.totalLocationsCount()) {
      this.currentLocIndex.set(nextIdx);
      this.isRackUnlocked.set(false); // Exige escanear el nuevo rack físicamente
      this.scanFeedback.set({
        type: 'info',
        title: 'Nueva Ubicación Asignada en Ruta',
        detail: `Posiciónate en ${this.currentLocation().rackLabel} y escanea el código del rack para desbloquear.`,
      });
    } else {
      this.scanFeedback.set({
        type: 'success',
        title: '¡Auditoría Cíclica Completada!',
        detail: 'Todas las ubicaciones del Pasillo 04 han sido auditadas satisfactoriamente.',
      });
    }
  }

  protected selectLocation(index: number): void {
    if (index === this.currentLocIndex()) return;
    this.currentLocIndex.set(index);
    const loc = this.auditTask().locations[index];
    this.isRackUnlocked.set(loc.status === 'AUDITED');
    this.manualInputCode.set('');
    if (loc.status !== 'AUDITED') {
      this.scanFeedback.set({
        type: 'info',
        title: 'Paso 1: Validación de Bahía Requerida',
        detail: `Posiciónate físicamente en ${loc.rackLabel} y escanea el código del rack (${loc.barcode}) para desbloquear el conteo ciego.`,
      });
    }
  }

  // ─── Conmutar Modo Offline / Zona Ciega Wi-Fi (HU-050) ────────────────────
  protected toggleOfflineSimulation(): void {
    this.isOfflineMode.update(v => !v);
    if (!this.isOfflineMode() && this.offlineQueueCount() > 0) {
      setTimeout(() => {
        this.offlineQueueCount.set(0);
        this.audioService.playSuccess();
        this.scanFeedback.set({
          type: 'success',
          title: 'Cola Offline Sincronizada con el Servidor',
          detail: 'Todas las transacciones en IndexedDB se transmitieron con éxito al WMS central.',
        });
      }, 800);
    }
  }

  // ─── Botones Rápidos de Simulación Demo ────────────────────────────────────
  protected simScanRack(): void {
    this.processScan(this.currentLocation().barcode);
  }

  protected simScanValidPallet(): void {
    if (!this.isRackUnlocked()) {
      this.simScanRack();
    }
    setTimeout(() => {
      this.processScan('SSCC-175012345000000025');
    }, 200);
  }

  protected simScanDiscrepancyPallet(): void {
    if (!this.isRackUnlocked()) {
      this.simScanRack();
    }
    this.manualInputPieces.set(36); // Teórico es 48 -> Genera delta -12
    setTimeout(() => {
      this.processScan('SSCC-175012345000000099');
    }, 200);
  }

  private updateCurrentLocationInTask(updated: CountingLocationItem): void {
    const list = [...this.auditTask().locations];
    list[this.currentLocIndex()] = updated;
    this.auditTask.update(t => ({ ...t, locations: list }));
  }

  protected goBackToMenu(): void {
    this.audioService.playSuccess();
    this.router.navigate(['/menu']);
  }
}
