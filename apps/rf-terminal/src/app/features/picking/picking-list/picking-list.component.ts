/**
 * @file picking-list.component.ts
 * @description Módulo Operativo de Carga de Camión (Salida / Embarque FEFO) — Terminal RF 4GUARD WMS.
 * Misma anatomía operativa que Descarga (Topbar + Manifiesto/Hero + Cámara HD con anti-rebote + Pistola Láser + Barra Fija Inferior),
 * conservando todas las reglas de negocio de Salidas (FEFO estricto, Acuerdo Comercial, Alerta Roja y Pre-Certificación F03)
 * conectadas 100% a PostgreSQL (/api/v1/warehouse-outbounds).
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

export interface PickLine {
  lineId: string;
  itemId?: string;
  sku: string;
  description: string;
  qty: number;
  qtyDone: number;
  unit: string;
  location: string;
  sscc: string;
  lot: string;
  expiresAt: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  isManualOverride?: boolean;
  commercialAgreementFolio?: string;
}

export interface OutboundSummary {
  id: string;
  folio: string;
  status: string;
  clientName: string;
  carrierName: string;
  driverName: string;
  tractorPlates: string;
  boxPlates: string;
  rampNumber: number;
  rampCode: string;
  totalPallets: number;
  totalPieces: number;
  sealNumber?: string;
}

@Component({
  selector: 'fg-picking-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './picking-list.component.html',
  styleUrl: './picking-list.component.css',
})
export class PickingListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('pickScanInput') scanInput?: ElementRef<HTMLInputElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly toast = inject(ToastService);
  private readonly audioService = inject(AudioFeedbackService);

  protected readonly outbounds = signal<OutboundSummary[]>([]);
  protected readonly selectedOutbound = signal<OutboundSummary | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isConcluding = signal<boolean>(false);
  protected readonly showOutboundPicker = signal<boolean>(false);

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

  // ─── Escáner & Estado FEFO ────────────────────────────────────────────────
  protected readonly currentInput = signal('');
  protected readonly isProcessingScan = signal<boolean>(false);
  protected readonly fefoViolation = signal(false);
  protected readonly violationSSCC = signal('');
  protected readonly successFlash = signal(false);
  protected readonly currentLineIdx = signal(0);

  protected readonly dispatchRule = signal<'FEFO_AUTO' | 'MANUAL_OVERRIDE'>('FEFO_AUTO');
  protected readonly commercialOverrideReason = signal<string>(
    'Convenio comercial con cliente (Lote específico autorizado)'
  );
  protected readonly commercialAgreementFolio = signal<string>('AC-COMERCIAL');

  protected readonly pickLines = signal<PickLine[]>([]);
  protected readonly stagingChecklistPassed = signal<boolean>(false);

  protected readonly operatorName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Operador Montacargas';
  });

  protected readonly currentLine = computed(() => {
    const lines = this.pickLines();
    if (lines.length === 0) return null;
    return lines[this.currentLineIdx()] ?? lines.find((l) => l.status !== 'DONE') ?? null;
  });

  protected readonly completedCount = computed(() =>
    this.pickLines().filter((l) => l.status === 'DONE').length
  );

  protected readonly totalCount = computed(() => this.pickLines().length);

  protected readonly totalPiecesLoaded = computed(() =>
    this.pickLines()
      .filter((l) => l.status === 'DONE')
      .reduce((acc, l) => acc + (Number(l.qty) || 0), 0)
  );

  protected readonly progressPct = computed(() => {
    const total = this.totalCount();
    if (total <= 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  protected readonly isComplete = computed(() => {
    const total = this.totalCount();
    return total > 0 && this.completedCount() === total;
  });

  private pollTimer: any = null;
  private audioCtx: AudioContext | null = null;

  ngOnInit(): void {
    this.loadOutbounds();
    this.pollTimer = setInterval(() => {
      this.loadOutbounds(true);
    }, 5000);
  }

  ngAfterViewInit(): void {
    this.focusScan();
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

  // ─── 1. Carga de Embarques desde PostgreSQL ───────────────────────────────
  loadOutbounds(silent = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!silent) {
      this.isLoading.set(true);
    }

    const user = this.authState.user() as any;
    const orgId = user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const params = new HttpParams().set('organizationId', orgId);

    this.http
      .get<any>('/api/v1/warehouse-outbounds', { params })
      .pipe(timeout(15000))
      .subscribe({
        next: (res) => {
          if (!silent) this.isLoading.set(false);
          const rawList: any[] = res?.data?.content || res?.data || res || [];
          if (!Array.isArray(rawList)) return;

          const activeList: OutboundSummary[] = rawList
            .filter(
              (o) =>
                o &&
                o.status !== 'COMPLETED' &&
                o.status !== 'CANCELLED' &&
                o.status !== 'LOADED'
            )
            .map((o) => this.normalizeOutbound(o));

          this.outbounds.set(activeList);

          const current = this.selectedOutbound();
          if (current) {
            const match = activeList.find((o) => o.id === current.id || o.folio === current.folio);
            if (match) {
              this.selectedOutbound.set({ ...current, ...match });
            } else if (activeList.length > 0 && !silent) {
              this.selectOutbound(activeList[0], silent);
            } else if (activeList.length === 0) {
              this.selectedOutbound.set(null);
              this.pickLines.set([]);
            }
          } else if (activeList.length > 0) {
            this.selectOutbound(activeList[0], silent);
          }
        },
        error: () => {
          if (!silent) this.isLoading.set(false);
        },
      });
  }

  private normalizeOutbound(raw: any): OutboundSummary {
    const rampNum = Number(raw?.rampNumber || 1);
    return {
      id: String(raw?.id || ''),
      folio: String(raw?.folio || raw?.remisionNo || raw?.docNumber || 'S/F'),
      status: String(raw?.status || 'ASSIGNED'),
      clientName: String(raw?.clientName || raw?.destinationName || 'CLIENTE DESTINO'),
      carrierName: String(raw?.carrierName || raw?.carrierLine || 'TRANSPORTE'),
      driverName: String(raw?.driverName || 'OPERADOR'),
      tractorPlates: String(raw?.tractorPlates || 'S/P'),
      boxPlates: String(raw?.boxPlates || 'S/P'),
      rampNumber: rampNum,
      rampCode: raw?.rampCode || `LOC-RAMP-${String(rampNum).padStart(2, '0')}`,
      totalPallets: Number(raw?.totalPallets || 0),
      totalPieces: Number(raw?.totalPieces || 0),
      sealNumber: raw?.sealNumber || '',
    };
  }

  selectOutbound(out: OutboundSummary, silent = false): void {
    this.selectedOutbound.set(out);
    this.showOutboundPicker.set(false);
    this.currentLineIdx.set(0);
    this.stagingChecklistPassed.set(false);

    if (this.isUuid(out.id)) {
      this.loadOutboundDetail(out.id);
    }

    if (!silent) {
      this.audioService.playSuccess();
    }
  }

  private loadOutboundDetail(outboundId: string): void {
    this.http
      .get<any>(`/api/v1/warehouse-outbounds/${outboundId}`)
      .pipe(timeout(15000))
      .subscribe({
        next: (res) => {
          const detail = res?.data || res;
          if (!detail) return;
          const normalized = this.normalizeOutbound(detail);
          this.selectedOutbound.set(normalized);

          const rawItems: any[] = Array.isArray(detail.items) ? detail.items : [];
          const sorted = [...rawItems].sort((a, b) => {
            const da = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
            const db = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
            return da - db;
          });

          const existingDone = new Set(
            this.pickLines()
              .filter((l) => l.status === 'DONE')
              .map((l) => l.sscc.toUpperCase())
          );

          const mappedLines: PickLine[] = sorted.map((it, idx) => {
            const sscc = String(it.palletCode || it.sscc || `UA-${idx + 1}`).toUpperCase();
            const isDone = existingDone.has(sscc);
            const qty = Number(it.pieces ?? it.quantity ?? 0);
            return {
              lineId: String(it.id || `PL-${idx + 1}`),
              itemId: it.itemId ? String(it.itemId) : undefined,
              sku: String(it.skuCode || it.productId || 'SKU'),
              description: String(it.skuDescription || it.productName || 'Mercancía de Salida'),
              qty,
              qtyDone: isDone ? qty : 0,
              unit: String(it.unit || 'PZAS'),
              location: String(it.locationCode || 'ALMACÉN'),
              sscc,
              lot: String(it.lotNumber || 'S/L').toUpperCase(),
              expiresAt: String(it.expirationDate || 'N/A'),
              status: isDone ? 'DONE' : idx === 0 ? 'IN_PROGRESS' : 'PENDING',
            };
          });

          this.pickLines.set(mappedLines);
          const firstPending = mappedLines.findIndex((l) => l.status !== 'DONE');
          this.currentLineIdx.set(firstPending !== -1 ? firstPending : 0);
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
    this.audioService.playSuccess();
    this.toast.info(next === 'vertical' ? 'Escaneo Vertical activo (90°)' : 'Escaneo Horizontal activo');
  }

  async switchCamera(): Promise<void> {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.audioService.playSuccess();
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
          if (!this.cameraActive() || this.isProcessingScan() || this.fefoViolation()) return;
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
                this.validateScan(code);
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
          if (result && result.getText && !this.isProcessingScan() && !this.fefoViolation()) {
            const code = result.getText().trim();
            if (code && this.cameraDebounce.shouldProcess(code)) {
              this.validateScan(code);
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

  // ─── 3. Validación FEFO & Acuerdo Comercial ───────────────────────────────
  protected toggleDispatchRule(): void {
    const next = this.dispatchRule() === 'FEFO_AUTO' ? 'MANUAL_OVERRIDE' : 'FEFO_AUTO';
    this.dispatchRule.set(next);
    this.audioService.playSuccess();
  }

  protected toggleStagingChecklist(): void {
    this.stagingChecklistPassed.update((v) => !v);
    this.audioService.playSuccess();
  }

  protected focusScan(): void {
    setTimeout(() => this.scanInput?.nativeElement?.focus(), 80);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.currentInput().trim();
      if (val) {
        this.validateScan(val);
        this.currentInput.set('');
      }
    }
  }

  protected onManualSubmit(): void {
    const val = this.currentInput().trim();
    if (val) {
      this.validateScan(val);
      this.currentInput.set('');
    }
  }

  validateScan(rawSscc: string): void {
    const sscc = (rawSscc || '').trim().toUpperCase();
    const lines = this.pickLines();
    const current = this.currentLine();
    const out = this.selectedOutbound();
    if (!sscc || !current || !out || this.isProcessingScan()) return;

    this.isProcessingScan.set(true);

    if (this.isUuid(out.id) && (out.status === 'ASSIGNED' || out.status === 'REGISTERED')) {
      this.http
        .put<any>(`/api/v1/warehouse-outbounds/${out.id}`, { status: 'IN_PROGRESS' })
        .subscribe({
          next: () => {
            this.selectedOutbound.update((curr) => (curr ? { ...curr, status: 'IN_PROGRESS' } : curr));
          },
          error: () => {},
        });
    }

    if (this.dispatchRule() === 'MANUAL_OVERRIDE') {
      const matchIdx = lines.findIndex((l) => l.sscc.toUpperCase() === sscc && l.status !== 'DONE');
      if (matchIdx !== -1) {
        this.markLineDone(matchIdx, true);
        return;
      } else {
        this.triggerFefoViolation(sscc);
        return;
      }
    }

    if (sscc !== current.sscc.toUpperCase()) {
      this.triggerFefoViolation(sscc);
      return;
    }

    this.markLineDone(this.currentLineIdx(), false);
  }

  private markLineDone(targetIdx: number, isManual: boolean): void {
    this.pickLines.update((items) =>
      items.map((l, i) => {
        if (i === targetIdx) {
          return {
            ...l,
            qtyDone: l.qty,
            status: 'DONE' as const,
            isManualOverride: isManual,
            commercialAgreementFolio: isManual ? this.commercialAgreementFolio() : undefined,
          };
        }
        return l;
      })
    );

    this.audioService.playSuccess();
    this.successFlash.set(true);
    setTimeout(() => {
      this.successFlash.set(false);
      this.isProcessingScan.set(false);
      const nextIdx = this.pickLines().findIndex((l) => l.status !== 'DONE');
      if (nextIdx !== -1) {
        this.currentLineIdx.set(nextIdx);
      }
    }, 800);
  }

  private triggerFefoViolation(sscc: string): void {
    this.fefoViolation.set(true);
    this.violationSSCC.set(sscc);
    this.playBuzzer();
    setTimeout(() => {
      this.fefoViolation.set(false);
      this.violationSSCC.set('');
      this.isProcessingScan.set(false);
    }, 3000);
  }

  concludeOutboundLoad(): void {
    const out = this.selectedOutbound();
    if (!out || !this.isUuid(out.id)) return;

    this.isConcluding.set(true);
    const op = this.operatorName();
    const payload = {
      status: 'LOADED',
      forkliftOperatorName: op,
      observations: `Carga física completada en andén desde Terminal RF por ${op} (${this.completedCount()} tarimas / ${this.totalPiecesLoaded()} unidades). Lista para despacho F03.`,
    };

    this.http.put<any>(`/api/v1/warehouse-outbounds/${out.id}`, payload).subscribe({
      next: (res) => {
        this.isConcluding.set(false);
        this.stopCamera();
        this.audioService.playFriendlyArrivalChime(1.0);
        this.toast.success(
          `Embarque #${out.folio} reportado como CARGADO a Mesa de Control.`,
          '✅ CARGA CONCLUIDA'
        );
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('4guard_wms_events');
            bc.postMessage({ type: 'OUTBOUND_LOADED', data: res?.data || out });
            bc.close();
          }
        } catch {}
        this.loadOutbounds();
      },
      error: (err) => {
        this.isConcluding.set(false);
        this.toast.error(err?.error?.message || 'Error al concluir la carga en el servidor.');
      },
    });
  }

  goToMenu(): void {
    this.stopCamera();
    this.router.navigate(['/menu']);
  }

  private playBuzzer(): void {
    try {
      this.audioCtx ??= new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime);
      osc.frequency.setValueAtTime(200, this.audioCtx.currentTime + 0.15);
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);
      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.6);
    } catch {}
  }
}
