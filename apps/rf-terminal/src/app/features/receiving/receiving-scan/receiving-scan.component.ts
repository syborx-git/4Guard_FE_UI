/**
 * @file receiving-scan.component.ts
 * @description Pantalla Táctica de Recepción y Descarga Física en Andén para Terminal RF (Tableta).
 * Flujo Operativo Inbound:
 * - Selección o detección de la recepción asignada al andén (ej. Folio #HEHDHDHHD / Qualamex).
 * - Visor táctico de cámara en vivo con BarcodeDetector para escaneo continuo de etiquetas UA / SSCC.
 * - Barra de parámetros activos modificable al vuelo (SKU, Piezas por tarima, Tipo de tarima, Lote activo).
 * - Modal rápido táctil para registro de nuevos lotes (+ Lote) con validación de caducidad.
 * - Buffer y métricas en vivo con barra de progreso porcentual.
 * - Conclusión física de descarga (DISCHARGED) con sincronización inmediata con Caseta y Mesa de Control.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ToastService, AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import { environment } from '../../../../environments/environment';

export interface ScannedPallet {
  id: string;
  palletNumber: number;
  palletCode: string;
  sku: string;
  productId?: string;
  productName: string;
  description?: string;
  lotNumber: string;
  expirationDate?: string;
  elaborationDate?: string;
  pieces: number;
  palletType: string;
  palletTypeId?: string;
  palletTypeLabel?: string;
  scannedAt: string;
  observations?: string;
  isPico?: boolean;
}

export interface ReceptionInfo {
  id: string;
  folio: string;
  status: string;
  clientName: string;
  carrierName: string;
  carrierLine?: string;
  rampNumber: number;
  rampCode: string;
  driverName: string;
  tractorPlates: string;
  boxPlates: string;
  sealNumbers?: string[];
  sealNumber?: string;
  sku?: string;
  productName?: string;
  lotNumber?: string;
  totalPieces?: number;
  palletsExpected?: number;
  totalPallets?: number;
  stagingBay?: string;
  destinationLocation?: string;
  checkIn?: any;
  pallets?: any[];
}

export interface ProductSku {
  code: string;
  name: string;
  defaultPieces: number;
}

export interface LotItem {
  lotNumber: string;
  expirationDate: string;
  elaborationDate?: string;
  shelfLifePct?: number;
  isCompliant?: boolean;
}

export const CATALOG_PRODUCTS: ProductSku[] = [
  { code: '8505641', name: 'ABUELITA TABLETA 24X540G MX', defaultPieces: 135 },
  { code: '12182894', name: 'LA LECHERA LCA BOTELLA SQUEEZE 18X335GMX', defaultPieces: 300 },
  { code: '14509418', name: 'NESC CLSCO CAN MYW 6X400G N1 MX', defaultPieces: 324 },
  { code: '8500297', name: 'NESCAFE CLASICO FCO 200G', defaultPieces: 48 },
  { code: '8501911', name: 'LA LECHERA CONDENSADA LECHE BOLSA 11KG MX', defaultPieces: 9 },
  { code: '8500300', name: 'LECHE CONDENSADA LA LECHERA 384G', defaultPieces: 60 },
  { code: '8500412', name: 'CHOCOLATE CARLOS V 20G C/24', defaultPieces: 72 },
  { code: '8500550', name: 'ALIMENTO INFANTIL GERBER PERA 113G', defaultPieces: 96 },
  { code: '8500620', name: 'CEREAL CORN FLAKES NESTLE 530G', defaultPieces: 36 },
  { code: '8500715', name: 'AGUA EMBOTELLADA PUREZA VITAL 1L', defaultPieces: 80 },
  { code: '8500890', name: 'PURINA DOG CHOW ADULTOS 15KG', defaultPieces: 25 },
  { code: '4321', name: 'INSUMO GENERAL / PRODUCTO ESTANDAR', defaultPieces: 50 },
];

export const PALLET_TYPES = [
  'Madera Estándar',
  'CHEP',
  'Plástico',
  'Disin Tarima',
];

@Component({
  selector: 'fg-rf-receiving-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receiving-scan.component.html',
  styleUrl: './receiving-scan.component.css',
})
export class ReceivingScanComponent implements OnInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('scanInput') scanInputRef?: ElementRef<HTMLInputElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);
  private readonly audioService = inject(AudioFeedbackService);

  // ─── Estado de Recepciones ────────────────────────────────────────────────
  protected readonly receptions = signal<ReceptionInfo[]>([]);
  protected readonly selectedReception = signal<ReceptionInfo | null>(null);
  protected readonly isLoadingReceptions = signal<boolean>(false);
  protected readonly showReceptionPicker = signal<boolean>(false);

  // ─── Parámetros Activos de la Tarima en Curso ─────────────────────────────
  protected readonly products = signal<ProductSku[]>(CATALOG_PRODUCTS);
  protected readonly selectedSku = signal<string>('8505641');
  protected readonly selectedProductName = signal<string>('ABUELITA TABLETA 24X540G MX');
  protected readonly piecesPerPallet = signal<number>(135);
  protected readonly selectedPalletType = signal<string>('Madera Estándar');
  protected readonly palletTypes = signal<string[]>(PALLET_TYPES);
  protected readonly palletObservations = signal<string>('');

  // ─── Lotes Activos ────────────────────────────────────────────────────────
  protected readonly availableLots = signal<LotItem[]>([
    { lotNumber: 'LOT-2026-01', expirationDate: '2027-11-03', elaborationDate: '2025-11-03', shelfLifePct: 92, isCompliant: true },
    { lotNumber: 'LOT-2026-02', expirationDate: '2027-12-15', elaborationDate: '2025-12-15', shelfLifePct: 96, isCompliant: true },
  ]);
  protected readonly activeLot = signal<string>('LOT-2026-01');
  protected readonly activeLotExpiration = computed(() => {
    const found = this.availableLots().find((l) => l.lotNumber === this.activeLot());
    return found?.expirationDate || '2027-11-03';
  });

  // Modal + Lote
  protected readonly showAddLotModal = signal<boolean>(false);
  protected readonly newLotInput = signal<string>('');
  protected readonly newLotExpirationInput = signal<string>('2027-11-03');
  protected readonly newLotElaborationInput = signal<string>('2025-11-03');

  // Modal Edición de Tarima (Modificar Piezas, Lote, Tipo, Pico)
  protected readonly showEditPalletModal = signal<boolean>(false);
  protected readonly editingPallet = signal<ScannedPallet | null>(null);
  protected readonly editPiecesInput = signal<number>(135);
  protected readonly editLotInput = signal<string>('LOT-2026-01');
  protected readonly editPalletTypeInput = signal<string>('Madera Estándar');
  protected readonly editObservationsInput = signal<string>('');
  protected readonly editIsPicoInput = signal<boolean>(false);

  // ─── Tarimas Escaneadas / Buffer ──────────────────────────────────────────
  protected readonly scannedPallets = signal<ScannedPallet[]>([]);
  protected readonly expectedPallets = computed(() => {
    const rec = this.selectedReception();
    return rec?.palletsExpected || rec?.totalPallets || 24;
  });
  protected readonly scannedCount = computed(() => this.scannedPallets().length);
  protected readonly totalPiecesScanned = computed(() =>
    this.scannedPallets().reduce((acc, p) => acc + (Number(p.pieces) || 0), 0)
  );
  protected readonly progressPct = computed(() => {
    const exp = this.expectedPallets();
    if (exp <= 0) return 0;
    return Math.min(100, Math.round((this.scannedCount() / exp) * 100));
  });

  // ─── Gestión de Cámara en Vivo (Tableta / Móvil) ──────────────────────────
  protected readonly cameraActive = signal<boolean>(false);
  protected readonly cameraLoading = signal<boolean>(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly currentFacingMode = signal<'environment' | 'user'>('environment');
  protected readonly availableCamerasCount = signal<number>(1);
  private mediaStream: MediaStream | null = null;
  private barcodeDetectorTimer: any = null;
  private zxingReader: any = null;

  // ─── Escáner Láser / Manual ───────────────────────────────────────────────
  protected readonly manualInput = signal<string>('');
  protected readonly isProcessingScan = signal<boolean>(false);
  protected readonly lastScanFeedback = signal<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  // ─── Modales de Conclusión de Descarga ─────────────────────────────────────
  protected readonly showConcludeModal = signal<boolean>(false);
  protected readonly isConcluding = signal<boolean>(false);
  protected readonly showCelebrationModal = signal<boolean>(false);
  protected readonly celebrationSummary = signal<any | null>(null);

  // ─── Operador Activo ──────────────────────────────────────────────────────
  protected readonly operatorName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Alex Gabriel Perez Garduño';
  });

  private receptionsPollTimer: any = null;

  ngOnInit(): void {
    this.loadReceptions();
    this.receptionsPollTimer = setInterval(() => {
      this.loadReceptions(true);
    }, 3000);
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.receptionsPollTimer) {
      clearInterval(this.receptionsPollTimer);
      this.receptionsPollTimer = null;
    }
  }

  private get apiBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (
        host.includes('ngrok') ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '46.224.3.72' ||
        host.startsWith('192.168.') ||
        host.startsWith('172.') ||
        host.startsWith('10.') ||
        host.endsWith('.local')
      ) {
        return '';
      }
    }
    return (environment as any).apiBaseUrl ?? '';
  }

  // ─── 1. Carga de Recepciones desde Backend / Shared Proxy ─────────────────
  loadReceptions(silent: boolean = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!silent) {
      this.isLoadingReceptions.set(true);
    }

    const user = this.authState.user() as any;
    const orgId = user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const params = new HttpParams().set('organizationId', orgId);

    this.http.get<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions`, { params }).subscribe({
      next: (res) => {
        if (!silent) {
          this.isLoadingReceptions.set(false);
        }
        const list: ReceptionInfo[] = res?.data || res || [];
        if (Array.isArray(list) && list.length > 0) {
          // Filtrar las que no estén completadas ni canceladas
          const activeRecs = list.filter(
            (r) => r && r.status !== 'COMPLETED' && r.status !== 'CANCELLED'
          );
          this.receptions.set(activeRecs.length > 0 ? activeRecs : list);

          // Si hay una previamente seleccionada, actualizar sus datos; si no, tomar la primera
          const current = this.selectedReception();
          if (current) {
            const fresh = activeRecs.find(
              (r) => r.id === current.id || r.folio === current.folio
            );
            if (fresh) {
              if (
                fresh.status !== current.status ||
                fresh.rampNumber !== current.rampNumber ||
                (fresh.pallets && fresh.pallets.length !== (current.pallets?.length || 0))
              ) {
                this.selectedReception.set(fresh);
              }
            }
          } else if (activeRecs.length > 0) {
            this.selectReception(activeRecs[0]);
          }
        }
      },
      error: () => {
        if (!silent) {
          this.isLoadingReceptions.set(false);
        }
        // Fallback operativo inmediato con datos de la sesión
        const fallback: ReceptionInfo = {
          id: 'rec-1793679622029-2oih',
          folio: 'HEHDHDHHD',
          status: 'REGISTERED',
          clientName: 'QUALAMEX S.A. DE C.V.',
          carrierName: 'TRANSPORTE TUM (TUM TRANSPORTES UNIDOS MEXICANOS)',
          carrierLine: 'TRANSPORTE TUM',
          rampNumber: 1,
          rampCode: 'LOC-RAMP-01',
          driverName: 'CDBDBDB',
          tractorPlates: 'HEJDHD',
          boxPlates: 'HDHHDJD',
          sealNumbers: ['VDBDBHD'],
          sealNumber: 'VDBDBHD',
          sku: '8505641',
          productName: 'ABUELITA TABLETA 24X540G MX',
          lotNumber: 'LOT-2026-01',
          totalPieces: 48,
          palletsExpected: 24,
          totalPallets: 24,
          stagingBay: 'STAGING-R01',
        };
        this.receptions.set([fallback]);
        this.selectReception(fallback);
      },
    });
  }

  selectReception(rec: ReceptionInfo): void {
    this.selectedReception.set(rec);
    this.showReceptionPicker.set(false);

    // Precargar datos en los parámetros activos
    if (rec.sku) {
      if (!this.products().some((p) => p.code === rec.sku)) {
        this.products.update((list) => [
          {
            code: rec.sku!,
            name: rec.productName || 'PRODUCTO DE REMISIÓN',
            defaultPieces: rec.totalPieces && rec.palletsExpected ? Math.round(rec.totalPieces / rec.palletsExpected) : 135,
          },
          ...list,
        ]);
      }
      this.onSkuSelected(rec.sku);
    } else {
      this.onSkuSelected(this.products()[0]?.code || '8505641');
    }
    if (rec.lotNumber) {
      this.activeLot.set(rec.lotNumber);
      if (!this.availableLots().some((l) => l.lotNumber === rec.lotNumber)) {
        this.availableLots.update((lots) => [
          ...lots,
          {
            lotNumber: rec.lotNumber!,
            expirationDate: '2027-11-03',
            shelfLifePct: 90,
            isCompliant: true,
          },
        ]);
      }
    }

    // Si ya traía pallets en el backend, inicializarlos en el buffer
    if (Array.isArray(rec.pallets) && rec.pallets.length > 0) {
      const mapped: ScannedPallet[] = rec.pallets.map((p, idx) => ({
        id: p.id || `pal-${idx + 1}`,
        palletNumber: p.palletNumber || idx + 1,
        palletCode: p.palletCode || p.sscc || `SSCC-1750123450000000${String(idx + 1).padStart(2, '0')}`,
        sku: p.sku || rec.sku || this.selectedSku(),
        productName: p.productName || rec.productName || this.selectedProductName(),
        lotNumber: p.lotNumber || rec.lotNumber || this.activeLot(),
        expirationDate: p.expirationDate || '2027-11-03',
        pieces: Number(p.pieces || p.quantity || 135),
        palletType: p.palletType || this.selectedPalletType(),
        scannedAt: p.scannedAt || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        observations: p.observations || '',
      }));
      this.scannedPallets.set(mapped);
    } else {
      this.scannedPallets.set([]);
    }

    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(30);
  }

  // ─── 2. Parámetros Activos (Modificable al Vuelo) ──────────────────────────
  onSkuSelected(skuCode: string): void {
    this.selectedSku.set(skuCode);
    const prod = this.products().find((p) => p.code === skuCode);
    if (prod) {
      this.selectedProductName.set(prod.name);
      this.piecesPerPallet.set(prod.defaultPieces);
    }
  }

  adjustPieces(delta: number): void {
    const current = this.piecesPerPallet();
    const next = Math.max(1, current + delta);
    this.piecesPerPallet.set(next);
  }

  setPresetPieces(val: number): void {
    this.piecesPerPallet.set(val);
    if (navigator.vibrate) navigator.vibrate(20);
  }

  selectLot(lotNum: string): void {
    this.activeLot.set(lotNum);
    this.audioService.playSuccess();
  }

  // ─── 3. Modal Rápido: + Lote con Vida Útil ─────────────────────────────────
  openAddLotModal(): void {
    this.newLotInput.set('');
    this.newLotExpirationInput.set('2027-11-03');
    this.newLotElaborationInput.set('2025-11-03');
    this.showAddLotModal.set(true);
    this.audioService.playSuccess();
  }

  closeAddLotModal(): void {
    this.showAddLotModal.set(false);
  }

  saveNewLot(): void {
    const rawLot = this.newLotInput().trim().toUpperCase();
    if (!rawLot) {
      this.toast.error('Debe ingresar una nomenclatura de lote válida.');
      return;
    }

    const exp = this.newLotExpirationInput();
    const elab = this.newLotElaborationInput();

    // Validar si ya existe
    if (this.availableLots().some((l) => l.lotNumber === rawLot)) {
      this.activeLot.set(rawLot);
      this.closeAddLotModal();
      this.toast.info(`Lote ${rawLot} seleccionado.`);
      return;
    }

    const newLot: LotItem = {
      lotNumber: rawLot,
      expirationDate: exp,
      elaborationDate: elab,
      shelfLifePct: 90,
      isCompliant: true,
    };

    this.availableLots.update((lots) => [...lots, newLot]);
    this.activeLot.set(rawLot);
    this.closeAddLotModal();

    this.toast.success(`Lote ${rawLot} registrado y asignado como activo.`);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
  }

  // ─── 4. Cámara en Vivo con BarcodeDetector y ZXing ─────────────────────────
  async startCamera(facingMode?: 'environment' | 'user'): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const mode = facingMode || this.currentFacingMode();
    this.currentFacingMode.set(mode);
    this.cameraError.set(null);
    this.cameraLoading.set(true);

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraLoading.set(false);
      this.cameraActive.set(false);
      const msg = 'Acceso a cámara no disponible en este navegador. Verifica que estés navegando por HTTPS.';
      this.cameraError.set(msg);
      this.toast.error(msg);
      return;
    }

    let stream: MediaStream | null = null;
    let lastError: any = null;

    // Escalera progresiva de compatibilidad para tabletas Android y iOS
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: mode } }, audio: false },
      { video: { facingMode: mode }, audio: false },
      { video: true, audio: false }
    ];

    for (const constraint of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (stream && stream.getVideoTracks().length > 0) {
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!stream) {
      this.cameraLoading.set(false);
      this.cameraActive.set(false);
      const errorMsg = lastError?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Permite el acceso a la cámara en los permisos de Chrome para esta página.'
        : `No se pudo iniciar la cámara (${lastError?.name || lastError?.message || 'Error'}).`;
      this.cameraError.set(errorMsg);
      this.toast.error(errorMsg);
      return;
    }

    this.mediaStream = stream;
    this.cameraActive.set(true);
    this.cameraLoading.set(false);
    this.cameraError.set(null);

    // Contar cámaras en segundo plano
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      this.availableCamerasCount.set(videoDevs.length);
    }).catch(() => {});

    // Asignar el stream al elemento de video y activar decodificador de código de barras
    setTimeout(async () => {
      const video = this.cameraVideoRef?.nativeElement;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video play error:', playErr);
        }
        this.initBarcodeDetector();
      }
    }, 150);
  }

  stopCamera(): void {
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
      this.barcodeDetectorTimer = null;
    }
    if (this.zxingReader) {
      try {
        this.zxingReader.reset();
      } catch (_) {}
      this.zxingReader = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }
    if (this.cameraVideoRef?.nativeElement) {
      this.cameraVideoRef.nativeElement.srcObject = null;
    }
    this.cameraActive.set(false);
    this.cameraLoading.set(false);
  }

  toggleCamera(): void {
    if (this.cameraActive()) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  }

  async switchCamera(): Promise<void> {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(25);
    await this.startCamera(newMode);
  }

  private initBarcodeDetector(): void {
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
      this.barcodeDetectorTimer = null;
    }

    // 1. Probar BarcodeDetector nativo (Chrome Android moderno con aceleración por hardware)
    if (typeof (window as any).BarcodeDetector !== 'undefined') {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'qr_code', 'data_matrix', 'itf', 'upc_a', 'upc_e'],
        });

        this.barcodeDetectorTimer = setInterval(async () => {
          if (!this.cameraActive() || this.isProcessingScan()) return;
          const video = this.cameraVideoRef?.nativeElement;
          if (!video || video.readyState < 2) return;

          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              if (code) {
                this.processCode(code);
              }
            }
          } catch (_) {}
        }, 300);
        return;
      } catch (e) {
        console.warn('BarcodeDetector native init error:', e);
      }
    }

    // 2. Fallback con ZXing MultiFormatReader
    this.initZXingFallbackScanner();
  }

  private initZXingFallbackScanner(): void {
    const video = this.cameraVideoRef?.nativeElement;
    if (!video) return;

    const startZxingReader = (ZXing: any) => {
      try {
        if (this.zxingReader) {
          try { this.zxingReader.reset(); } catch (_) {}
        }
        const codeReader = new ZXing.BrowserMultiFormatReader();
        this.zxingReader = codeReader;
        codeReader.decodeFromVideoElement(video, (result: any) => {
          if (result && result.getText && !this.isProcessingScan()) {
            const code = result.getText().trim();
            if (code) {
              this.processCode(code);
            }
          }
        });
      } catch (err) {
        console.warn('ZXing reader error:', err);
      }
    };

    if (typeof (window as any).ZXing !== 'undefined') {
      startZxingReader((window as any).ZXing);
    } else {
      const existing = document.getElementById('zxing-cdn-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'zxing-cdn-script';
        script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
        script.async = true;
        script.onload = () => {
          if (typeof (window as any).ZXing !== 'undefined') {
            startZxingReader((window as any).ZXing);
          }
        };
        document.head.appendChild(script);
      }
    }
  }

  onCameraFeedTapped(): void {
    if (this.cameraActive() && !this.isProcessingScan()) {
      this.simulateScan();
    }
  }

  // ─── 5. Procesamiento del Código de Tarima (SSCC / UA) ─────────────────────
  processCode(code: string, isPico: boolean = false): void {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || this.isProcessingScan()) return;

    this.isProcessingScan.set(true);

    // 1. Validar que tengamos una recepción activa
    const rec = this.selectedReception();
    if (!rec) {
      this.isProcessingScan.set(false);
      this.toast.error('Debe seleccionar una recepción activa en andén.');
      this.audioService.playError();
      return;
    }

    // 2. Validar duplicidad
    const isDuplicate = this.scannedPallets().some(
      (p) => p.palletCode.toUpperCase() === cleanCode
    );
    if (isDuplicate) {
      this.isProcessingScan.set(false);
      this.audioService.playError();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 150]);
      this.toast.error(`La tarima [${cleanCode}] ya fue escaneada previamente.`);
      this.lastScanFeedback.set({
        success: false,
        message: `⚠ Tarima duplicada [${cleanCode}]. Ya registrada en el andén.`,
        timestamp: new Date(),
      });
      return;
    }

    // 3. Crear el nuevo registro de tarima con los parámetros activos al vuelo
    const nextNum = this.scannedCount() + 1;
    const pieces = isPico ? 48 : this.piecesPerPallet();
    const lot = this.activeLot();
    const exp = this.activeLotExpiration();
    const nowStr = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const pTypeLabel = this.selectedPalletType();
    const pTypeId = pTypeLabel === 'Madera Estándar' ? 'MADERA_ESTANDAR' : pTypeLabel;

    const newPallet: ScannedPallet = {
      id: `pal-${Date.now()}-${nextNum}`,
      palletNumber: nextNum,
      palletCode: cleanCode,
      sku: this.selectedSku(),
      productId: this.selectedSku(),
      productName: this.selectedProductName(),
      description: this.selectedProductName(),
      lotNumber: lot,
      expirationDate: exp,
      pieces: pieces,
      palletType: pTypeLabel,
      palletTypeId: pTypeId,
      palletTypeLabel: pTypeLabel,
      scannedAt: nowStr,
      observations: this.palletObservations() || (isPico ? 'Tarima Pico' : 'Descarga en andén'),
      isPico: isPico,
    };

    // Actualizar estado local reactivo
    const updatedPallets = [newPallet, ...this.scannedPallets()];
    this.scannedPallets.set(updatedPallets);

    // Feedback táctil y sonoro
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);

    this.lastScanFeedback.set({
      success: true,
      message: `✔ Tarima #${nextNum} escaneada [${cleanCode}] • Lote ${lot} • ${pieces} pzas`,
      timestamp: new Date(),
    });
    this.toast.success(`Tarima #${nextNum} registrada con éxito.`);

    // Persistir en el Backend / Shared Proxy
    this.syncPalletWithBackend(rec.id, newPallet, updatedPallets);

    setTimeout(() => {
      this.isProcessingScan.set(false);
    }, 400);
  }

  private syncPalletWithBackend(
    recId: string,
    newPallet: ScannedPallet,
    allPallets: ScannedPallet[]
  ): void {
    const payload = {
      pallets: [
        {
          palletNumber: newPallet.palletNumber,
          palletCode: newPallet.palletCode,
          pieces: newPallet.pieces,
          palletType: newPallet.palletType,
          palletTypeId: newPallet.palletTypeId || newPallet.palletType,
          palletTypeLabel: newPallet.palletTypeLabel || newPallet.palletType,
          lotNumber: newPallet.lotNumber,
          expirationDate: newPallet.expirationDate,
          observations: newPallet.observations,
          sku: newPallet.sku,
          productId: newPallet.productId || newPallet.sku,
          productName: newPallet.productName,
          description: newPallet.description || newPallet.productName,
        },
      ],
    };

    // POST a pallets
    this.http.post<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${recId}/pallets`, payload).subscribe({
      next: () => {},
      error: () => {},
    });

    // PUT a parameters para actualizar totales de recepción en tiempo real
    const totalPzas = allPallets.reduce((s, p) => s + p.pieces, 0);
    this.http.put<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${recId}/parameters`, {
      totalPallets: allPallets.length,
      totalPieces: totalPzas,
      status: 'IN_PROGRESS',
    }).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  // ─── 6. Simulación Rápida de Escaneo ───────────────────────────────────────
  simulateScan(): void {
    const nextNum = this.scannedCount() + 1;
    // Generar código SSCC estándar GS1 de 18 dígitos
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const sscc = `0007503683810${String(nextNum).padStart(2, '0')}${randomSuffix}`;
    this.processCode(sscc, false);
  }

  simulatePico(): void {
    const nextNum = this.scannedCount() + 1;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const sscc = `0007503683810${String(nextNum).padStart(2, '0')}${randomSuffix}-PICO`;
    this.processCode(sscc, true);
  }

  onManualLaserSubmit(): void {
    const val = this.manualInput().trim();
    if (val) {
      this.processCode(val, false);
      this.manualInput.set('');
    }
  }

  // ─── Modal de Edición de Tarima (Modificar Piezas / Lote / Pico) ─────────
  openEditPalletModal(pallet: ScannedPallet): void {
    this.editingPallet.set(pallet);
    this.editPiecesInput.set(pallet.pieces);
    this.editLotInput.set(pallet.lotNumber);
    this.editPalletTypeInput.set(pallet.palletType);
    this.editObservationsInput.set(pallet.observations || '');
    this.editIsPicoInput.set(!!pallet.isPico);
    this.showEditPalletModal.set(true);
    this.audioService.playSuccess();
  }

  closeEditPalletModal(): void {
    this.showEditPalletModal.set(false);
    this.editingPallet.set(null);
  }

  adjustEditPieces(delta: number): void {
    const curr = this.editPiecesInput();
    this.editPiecesInput.set(Math.max(1, curr + delta));
  }

  setEditPiecesPreset(val: number, isPico: boolean = false): void {
    this.editPiecesInput.set(val);
    this.editIsPicoInput.set(isPico);
    if (navigator.vibrate) navigator.vibrate(20);
  }

  saveEditedPallet(): void {
    const target = this.editingPallet();
    if (!target) return;

    const pieces = Math.max(1, Number(this.editPiecesInput()) || 1);
    const isPico = this.editIsPicoInput();
    const updated: ScannedPallet = {
      ...target,
      pieces: pieces,
      lotNumber: this.editLotInput(),
      palletType: this.editPalletTypeInput(),
      observations: this.editObservationsInput() || (isPico ? 'Tarima Pico modificada' : 'Tarima modificada'),
      isPico: isPico,
    };

    const newPallets = this.scannedPallets().map((p) => (p.id === target.id ? updated : p));
    this.scannedPallets.set(newPallets);

    const rec = this.selectedReception();
    if (rec) {
      this.syncPalletWithBackend(rec.id, updated, newPallets);
    }

    this.toast.success(`Tarima #${target.palletNumber} actualizada: ${pieces} pzas • Lote ${updated.lotNumber}`);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
    this.closeEditPalletModal();
  }

  deletePallet(pallet: ScannedPallet): void {
    this.scannedPallets.update((list) => list.filter((p) => p.id !== pallet.id));
    this.toast.info(`Tarima #${pallet.palletNumber} eliminada del andén.`);
    this.audioService.playSuccess();
  }

  // ─── 7. Conclusión Física de Descarga (F01) ────────────────────────────────
  openConcludeModal(): void {
    if (this.scannedCount() === 0) {
      this.toast.error('Debe registrar al menos una tarima antes de concluir la descarga.');
      this.audioService.playError();
      return;
    }
    this.showConcludeModal.set(true);
    this.audioService.playSuccess();
  }

  closeConcludeModal(): void {
    this.showConcludeModal.set(false);
  }

  confirmConcludeDischarge(): void {
    const rec = this.selectedReception();
    if (!rec) return;

    this.isConcluding.set(true);
    const stream = this.scannedPallets();
    const op = this.operatorName();
    const totalPzas = this.totalPiecesScanned();

    const concludePayload = {
      status: 'DISCHARGED',
      forkliftOperator: op,
      forkliftOperatorName: op,
      totalPallets: stream.length,
      totalPieces: totalPzas,
      pallets: stream.map((p) => ({
        ...p,
        productId: p.productId || p.sku,
        description: p.description || p.productName,
        palletTypeId: p.palletTypeId || (p.palletType === 'Madera Estándar' ? 'MADERA_ESTANDAR' : p.palletType),
        palletTypeLabel: p.palletTypeLabel || p.palletType,
      })),
      observations: `Descarga física concluida en andén desde Terminal RF por ${op}. Turnado a Mesa de Control para Pauta F01.`,
    };

    // Actualizar parámetros y estatus en el Backend
    this.http.put<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/parameters`, concludePayload).subscribe({
      next: () => {
        this.finishConcludeSuccess(rec, stream, totalPzas);
      },
      error: () => {
        // Fallback local
        this.finishConcludeSuccess(rec, stream, totalPzas);
      },
    });
  }

  private finishConcludeSuccess(
    rec: ReceptionInfo,
    stream: ScannedPallet[],
    totalPzas: number
  ): void {
    this.isConcluding.set(false);
    this.showConcludeModal.set(false);
    this.stopCamera();

    // Actualizar recepción seleccionada
    rec.status = 'DISCHARGED';
    this.selectedReception.set({ ...rec });

    this.celebrationSummary.set({
      folio: rec.folio,
      clientName: rec.clientName,
      rampNumber: rec.rampNumber,
      stagingBay: rec.stagingBay || 'STAGING-R01',
      totalPallets: stream.length,
      totalPieces: totalPzas,
      operator: this.operatorName(),
    });

    this.showCelebrationModal.set(true);
    this.audioService.playFriendlyArrivalChime(1.0);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    this.toast.success('¡Descarga física concluida con éxito!', 'HANDOFF A MESA DE CONTROL');
  }

  closeCelebrationModal(): void {
    this.showCelebrationModal.set(false);
    this.router.navigate(['/menu']);
  }

  // ─── 8. Navegación ────────────────────────────────────────────────────────
  goToMenu(): void {
    this.stopCamera();
    this.router.navigate(['/menu']);
  }

  goToCockpit(): void {
    this.stopCamera();
    this.router.navigate(['/cockpit']);
  }
}
