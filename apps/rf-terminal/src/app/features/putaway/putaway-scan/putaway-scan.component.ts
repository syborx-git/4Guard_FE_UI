/**
 * @file putaway-scan.component.ts
 * @description Módulo Operativo de Acomodo en Racks / Cambios de Almacén — Terminal RF 4GUARD WMS.
 * Misma anatomía operativa que Descarga (Topbar + Manifiesto/Hero + Cámara HD con anti-rebote + Pistola Láser + Barra Fija Inferior),
 * conservando el flujo guiado en 2 pasos (1. Escanear UA en Origen -> /start, 2. Validar Rack Destino -> /complete)
 * conectado 100% a PostgreSQL (/api/v1/warehouse-transfers).
 */

import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { timeout } from 'rxjs';
import { AuthState, ToastService } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import {
  BarcodeDebounceGuard,
  buildCameraConstraintsLadder,
  applyCameraEnhancements,
  createEnhancedZxingReader,
} from '../../../core/utils/barcode-scanner-guard';

export type PutawayStep = 'SCAN_PALLET' | 'SCAN_RACK' | 'BATCH_COMPLETED';

export interface AssignedPutawayTask {
  id: string;
  folio: string;
  status: string;
  rampCode: string;
  destinationCode: string;
  destinationLocationId?: string;
  assignedBy: string;
  totalPallets: number;
  totalPieces: number;
}

export interface PutawayItem {
  id: string;
  transferId: string;
  destinationLocationId?: string;
  sscc: string;
  sku: string;
  description: string;
  pieces: number;
  unit: string;
  originCode: string;
  assignedRack: string;
  levelInfo: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'STORED';
  scannedAt?: Date;
}

@Component({
  selector: 'fg-rf-putaway-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './putaway-scan.component.html',
  styleUrl: './putaway-scan.component.css',
})
export class PutawayScanComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly toast = inject(ToastService);
  private readonly audio = inject(AudioFeedbackService);

  protected readonly transfers = signal<AssignedPutawayTask[]>([]);
  protected readonly assignedTask = signal<AssignedPutawayTask | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly showTransferPicker = signal<boolean>(false);

  // ─── Cámara en Vivo (Tableta / Móvil) con Anti-Rebote 3s ──────────────────
  protected readonly cameraActive = signal<boolean>(false);
  protected readonly cameraLoading = signal<boolean>(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly currentFacingMode = signal<'environment' | 'user'>('environment');
  protected readonly scanOrientation = signal<'horizontal' | 'vertical'>('horizontal');
  private mediaStream: MediaStream | null = null;
  private barcodeDetectorTimer: any = null;
  private zxingReader: any = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private readonly cameraDebounce = new BarcodeDebounceGuard(3000);

  // ─── Flujo 2 Pasos ────────────────────────────────────────────────────────
  protected readonly currentStep = signal<PutawayStep>('SCAN_PALLET');
  protected readonly currentInput = signal('');
  protected readonly isProcessing = signal(false);
  protected readonly lastError = signal<string | null>(null);
  protected readonly activePallet = signal<PutawayItem | null>(null);

  protected readonly pendingPallets = signal<PutawayItem[]>([]);
  protected readonly storedBuffer = signal<PutawayItem[]>([]);

  protected readonly operatorName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Operador Montacargas';
  });

  protected readonly storedCount = computed(() => this.storedBuffer().length);
  protected readonly totalCount = computed(
    () => this.storedBuffer().length + this.pendingPallets().length
  );

  private pollTimer: any = null;

  ngOnInit(): void {
    this.loadTransfers();
    this.pollTimer = setInterval(() => {
      this.loadTransfers(true);
    }, 5000);
  }

  ngAfterViewInit(): void {
    this.focusScanInput();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private isUuid(val?: string | null): boolean {
    if (!val) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      val.trim()
    );
  }

  // ─── 1. Carga de Traspasos desde PostgreSQL ───────────────────────────────
  loadTransfers(silent = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!silent) {
      this.isLoading.set(true);
    }

    const user = this.authState.user() as any;
    const orgId = user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const params = new HttpParams().set('organizationId', orgId).set('scope', 'CURRENT');

    this.http
      .get<any>('/api/v1/warehouse-transfers', { params })
      .pipe(timeout(15000))
      .subscribe({
        next: (res) => {
          if (!silent) this.isLoading.set(false);
          const rawList: any[] = res?.data?.content || res?.data || res || [];
          if (!Array.isArray(rawList)) return;

          const activeList: AssignedPutawayTask[] = rawList
            .filter((t) => t && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
            .map((t) => this.normalizeTransferTask(t));

          this.transfers.set(activeList);

          const current = this.assignedTask();
          if (current) {
            const match = activeList.find((t) => t.id === current.id || t.folio === current.folio);
            if (match) {
              this.assignedTask.set({ ...current, ...match });
            } else if (activeList.length > 0 && !silent) {
              this.selectTransferTask(activeList[0], silent);
            } else if (activeList.length === 0 && this.currentStep() !== 'BATCH_COMPLETED') {
              this.assignedTask.set(null);
              this.pendingPallets.set([]);
            }
          } else if (activeList.length > 0) {
            this.selectTransferTask(activeList[0], silent);
          }
        },
        error: () => {
          if (!silent) this.isLoading.set(false);
        },
      });
  }

  private normalizeTransferTask(raw: any): AssignedPutawayTask {
    return {
      id: String(raw?.id || ''),
      folio: String(raw?.folio || 'S/F'),
      status: String(raw?.status || 'ASSIGNED'),
      rampCode: String(raw?.originLocationCode || raw?.originLocationName || 'ANDÉN / STAGING'),
      destinationCode: String(
        raw?.destinationLocationCode || raw?.destinationLocationName || 'RACK ASIGNADO'
      ),
      destinationLocationId: raw?.destinationLocationId ? String(raw.destinationLocationId) : undefined,
      assignedBy: String(raw?.createdBy || raw?.forkliftOperatorName || 'Coordinación WMS'),
      totalPallets: Number(raw?.totalPallets || 0),
      totalPieces: Number(raw?.totalPieces || 0),
    };
  }

  selectTransferTask(task: AssignedPutawayTask, silent = false): void {
    this.assignedTask.set(task);
    this.showTransferPicker.set(false);
    this.lastError.set(null);
    this.activePallet.set(null);
    this.currentStep.set('SCAN_PALLET');

    if (this.isUuid(task.id)) {
      this.loadTransferDetail(task.id);
    }

    if (!silent) {
      this.audio.playSuccess();
    }
  }

  private loadTransferDetail(transferId: string): void {
    this.http
      .get<any>(`/api/v1/warehouse-transfers/${transferId}`)
      .pipe(timeout(15000))
      .subscribe({
        next: (res) => {
          const detail = res?.data || res;
          if (!detail) return;
          const task = this.normalizeTransferTask(detail);
          this.assignedTask.set(task);

          const rawItems: any[] = Array.isArray(detail.items) ? detail.items : [];
          const storedSet = new Set(this.storedBuffer().map((s) => s.sscc.toUpperCase()));

          const mapped: PutawayItem[] = rawItems
            .filter((it) => !storedSet.has(String(it.palletCode || it.sscc || '').toUpperCase()))
            .map((it, idx) => ({
              id: String(it.id || it.itemId || `item-${idx + 1}`),
              transferId: task.id,
              destinationLocationId: task.destinationLocationId,
              sscc: String(it.palletCode || it.sscc || `UA-${idx + 1}`).toUpperCase(),
              sku: String(it.skuCode || it.productId || 'SKU'),
              description: String(it.skuDescription || it.productName || 'Mercancía en Traspaso'),
              pieces: Number(it.pieces ?? it.quantity ?? 0),
              unit: String(it.unit || 'PZAS'),
              originCode: task.rampCode,
              assignedRack: task.destinationCode,
              levelInfo: `Origen: ${task.rampCode} ➔ Destino: ${task.destinationCode}`,
              status: 'PENDING' as const,
            }));

          this.pendingPallets.set(mapped);
        },
        error: () => {},
      });
  }

  // ─── 2. Cámara en Vivo con BarcodeDetector + ZXing TRY_HARDER ────────────
  async startCamera(facingMode?: 'environment' | 'user'): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const mode = facingMode || this.currentFacingMode();
    this.currentFacingMode.set(mode);
    this.cameraError.set(null);
    this.cameraLoading.set(true);

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.mediaStream = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraLoading.set(false);
      this.cameraActive.set(false);
      const msg = 'Acceso a cámara no disponible. Verifica que estás navegando por HTTPS.';
      this.cameraError.set(msg);
      this.toast.error(msg);
      return;
    }

    let stream: MediaStream | null = null;
    let lastError: any = null;
    for (const constraint of buildCameraConstraintsLadder(mode)) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (stream && stream.getVideoTracks().length > 0) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!stream) {
      this.cameraLoading.set(false);
      this.cameraActive.set(false);
      const errorMsg =
        lastError?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Permite el acceso a la cámara en Chrome.'
          : `No se pudo iniciar la cámara (${lastError?.name || 'Error'}).`;
      this.cameraError.set(errorMsg);
      this.toast.error(errorMsg);
      return;
    }

    this.mediaStream = stream;
    applyCameraEnhancements(stream);
    this.cameraActive.set(true);
    this.cameraLoading.set(false);

    setTimeout(async () => {
      const video = this.cameraVideoRef?.nativeElement;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        try {
          await video.play();
        } catch {}
        this.initBarcodeDetector();
      }
    }, 150);
  }

  stopCamera(): void {
    this.cameraDebounce.reset();
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
      this.barcodeDetectorTimer = null;
    }
    if (this.zxingReader) {
      try {
        this.zxingReader.reset();
      } catch {}
      this.zxingReader = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
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

  toggleScanOrientation(): void {
    const next = this.scanOrientation() === 'horizontal' ? 'vertical' : 'horizontal';
    this.scanOrientation.set(next);
    this.audio.playSuccess();
    this.toast.info(next === 'vertical' ? 'Escaneo Vertical activo (90°)' : 'Escaneo Horizontal activo');
  }

  async switchCamera(): Promise<void> {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.audio.playSuccess();
    await this.startCamera(newMode);
  }

  private getRotatedCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
    if (!video.videoWidth || !video.videoHeight) return null;
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    const canvas = this.offscreenCanvas;
    canvas.width = video.videoHeight;
    canvas.height = video.videoWidth;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
    ctx.restore();
    return canvas;
  }

  private initBarcodeDetector(): void {
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
      this.barcodeDetectorTimer = null;
    }

    if (typeof (window as any).BarcodeDetector !== 'undefined') {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'qr_code', 'data_matrix', 'itf', 'upc_a', 'upc_e'],
        });

        this.barcodeDetectorTimer = setInterval(async () => {
          if (!this.cameraActive() || this.isProcessing()) return;
          const video = this.cameraVideoRef?.nativeElement;
          if (!video || video.readyState < 2) return;

          try {
            let barcodes = await detector.detect(video);
            if ((!barcodes || barcodes.length === 0) && this.scanOrientation() === 'vertical') {
              const rotated = this.getRotatedCanvas(video);
              if (rotated) barcodes = await detector.detect(rotated);
            }
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              if (code && this.cameraDebounce.shouldProcess(code)) {
                this.handleScannedCode(code);
              }
            }
          } catch {}
        }, 280);
        return;
      } catch {}
    }

    this.initZXingFallbackScanner();
  }

  private initZXingFallbackScanner(): void {
    const video = this.cameraVideoRef?.nativeElement;
    if (!video) return;

    const startReader = (ZXing: any) => {
      try {
        if (this.zxingReader) {
          try {
            this.zxingReader.reset();
          } catch {}
        }
        const reader = createEnhancedZxingReader(ZXing);
        this.zxingReader = reader;
        reader.decodeFromVideoElement(video, (result: any) => {
          if (result && result.getText && !this.isProcessing()) {
            const code = result.getText().trim();
            if (code && this.cameraDebounce.shouldProcess(code)) {
              this.handleScannedCode(code);
            }
          }
        });
      } catch {}
    };

    if (typeof (window as any).ZXing !== 'undefined') {
      startReader((window as any).ZXing);
    } else if (!document.getElementById('zxing-cdn-script')) {
      const script = document.createElement('script');
      script.id = 'zxing-cdn-script';
      script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
      script.async = true;
      script.onload = () => {
        if (typeof (window as any).ZXing !== 'undefined') startReader((window as any).ZXing);
      };
      document.head.appendChild(script);
    }
  }

  // ─── 3. Flujo Guiado en 2 Pasos (Origen -> Rack Destino) ─────────────────
  protected focusScanInput(): void {
    setTimeout(() => this.scanInput?.nativeElement?.focus(), 100);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.currentInput().trim();
      if (val) {
        this.handleScannedCode(val);
        this.currentInput.set('');
      }
    }
  }

  protected onManualSubmit(): void {
    const val = this.currentInput().trim();
    if (val) {
      this.handleScannedCode(val);
      this.currentInput.set('');
    }
  }

  protected handleScannedCode(rawCode: string): void {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || this.isProcessing()) return;
    this.lastError.set(null);
    const step = this.currentStep();

    if (step === 'SCAN_PALLET') {
      this.processPalletScan(code);
    } else if (step === 'SCAN_RACK') {
      this.processRackScan(code);
    }
  }

  private processPalletScan(code: string): void {
    if (this.storedBuffer().some((item) => item.sscc.toUpperCase() === code)) {
      this.lastError.set(`⚠️ Tarima Duplicada: La UA ${code} ya fue ubicada en su rack destino.`);
      this.audio.playError();
      return;
    }

    const found = this.pendingPallets().find((item) => item.sscc.toUpperCase() === code);
    if (!found) {
      this.lastError.set(
        `❌ La tarima ${code} no pertenece a esta orden de acomodo/traspaso (#${this.assignedTask()?.folio || ''}).`
      );
      this.audio.playError();
      return;
    }

    this.isProcessing.set(true);
    if (this.isUuid(found.transferId)) {
      this.http.post<any>(`/api/v1/warehouse-transfers/${found.transferId}/start`, {}).subscribe({
        next: () => {},
        error: () => {},
      });
    }

    setTimeout(() => {
      this.activePallet.set({ ...found, status: 'IN_TRANSIT' });
      this.currentStep.set('SCAN_RACK');
      this.isProcessing.set(false);
      this.audio.playSuccess();
      this.focusScanInput();
    }, 150);
  }

  private processRackScan(code: string): void {
    const pallet = this.activePallet();
    if (!pallet) {
      this.currentStep.set('SCAN_PALLET');
      return;
    }

    const normalizedScanned = code.toUpperCase().replace(/\s+/g, '-');
    const normalizedExpected = pallet.assignedRack.toUpperCase().replace(/\s+/g, '-');

    if (
      normalizedScanned !== normalizedExpected &&
      !normalizedScanned.includes(normalizedExpected.replace('RACK-', ''))
    ) {
      this.lastError.set(
        `❌ UBICACIÓN INCORRECTA: Escaneaste '${code}'. La orden exige colocar la tarima en: ${pallet.assignedRack}.`
      );
      this.audio.playError();
      return;
    }

    this.isProcessing.set(true);
    const remainingAfterThis = this.pendingPallets().filter(
      (p) => p.sscc.toUpperCase() !== pallet.sscc.toUpperCase()
    );

    const finalizeLocalStore = () => {
      const storedItem: PutawayItem = {
        ...pallet,
        status: 'STORED',
        scannedAt: new Date(),
      };
      this.pendingPallets.set(remainingAfterThis);
      this.storedBuffer.update((list) => [storedItem, ...list]);
      this.activePallet.set(null);
      this.isProcessing.set(false);
      this.audio.playSuccess();

      if (remainingAfterThis.length === 0) {
        this.currentStep.set('BATCH_COMPLETED');
      } else {
        this.currentStep.set('SCAN_PALLET');
      }
      this.focusScanInput();
    };

    if (remainingAfterThis.length === 0 && this.isUuid(pallet.transferId)) {
      const payload: Record<string, any> = {};
      if (this.isUuid(pallet.destinationLocationId)) {
        payload['destinationLocationId'] = pallet.destinationLocationId;
      }
      this.http
        .post<any>(`/api/v1/warehouse-transfers/${pallet.transferId}/complete`, payload)
        .subscribe({
          next: (res) => {
            finalizeLocalStore();
            this.toast.success(
              `Traspaso #${this.assignedTask()?.folio} completado en PostgreSQL y Kardex.`,
              '✅ ACOMODO COMPLETADO'
            );
            try {
              if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                const bc = new BroadcastChannel('4guard_wms_events');
                bc.postMessage({ type: 'TRANSFER_COMPLETED', data: res?.data || pallet });
                bc.close();
              }
            } catch {}
          },
          error: (err) => {
            this.isProcessing.set(false);
            this.toast.error(
              err?.error?.message || 'Error al completar el acomodo en la base de datos.'
            );
          },
        });
    } else {
      finalizeLocalStore();
    }
  }

  protected cancelCurrentTransit(): void {
    this.activePallet.set(null);
    this.lastError.set(null);
    this.currentStep.set('SCAN_PALLET');
    this.audio.playWarning();
    this.focusScanInput();
  }

  protected goBack(): void {
    this.stopCamera();
    this.router.navigate(['/menu']);
  }

  protected formatTime(date?: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
