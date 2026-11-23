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
import {
  BarcodeDebounceGuard,
  buildCameraConstraintsLadder,
  applyCameraEnhancements,
  createEnhancedZxingReader,
} from '../../../core/utils/barcode-scanner-guard';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { timeout } from 'rxjs';
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
  protected readonly scanOrientation = signal<'horizontal' | 'vertical'>('horizontal');
  private mediaStream: MediaStream | null = null;
  private barcodeDetectorTimer: any = null;
  private zxingReader: any = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private readonly cameraDebounce = new BarcodeDebounceGuard(3000);

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
    this.loadCatalogProducts();
    this.loadReceptions();
    this.receptionsPollTimer = setInterval(() => {
      this.loadReceptions(true);
    }, 4000);
  }

  private isUuid(val?: string | null): boolean {
    if (!val) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val.trim());
  }

  private toBackendPalletType(labelOrKey?: string): string {
    const clean = (labelOrKey || '').trim().toUpperCase();
    if (!clean) return 'MADERA_ESTANDAR';
    if (clean.includes('CHEP') && clean.includes('EXP')) return 'TARIMA_CHEP_EXPORTACION';
    if (clean.includes('CHEP')) return 'TARIMA_CHEP_NACIONAL';
    if (clean.includes('OWENS') && clean.includes('PLAST')) return 'PLASTICO_NEGRO_OWENS';
    if (clean.includes('OWENS')) return 'MADERA_OWENS';
    if (clean.includes('AZUL')) return 'PLASTICO_AZUL';
    if (clean.includes('PLAST') || clean.includes('PLÁST')) return 'TARIMA_PLASTICO_NEGRO_ESTANDAR';
    if (clean.includes('SIN') || clean.includes('DISIN') || clean.includes('GRANEL')) return 'SIN_TARIMA';
    if (
      [
        'MADERA_ESTANDAR',
        'MADERA_OWENS',
        'TARIMA_CHEP_NACIONAL',
        'TARIMA_CHEP_EXPORTACION',
        'PLASTICO_NEGRO_OWENS',
        'PLASTICO_AZUL',
        'TARIMA_PLASTICO_NEGRO_ESTANDAR',
        'SIN_TARIMA',
      ].includes(clean)
    ) {
      return clean;
    }
    return 'MADERA_ESTANDAR';
  }

  private extractRampNumber(raw: any): number {
    if (typeof raw?.rampNumber === 'number' && raw.rampNumber > 0) return raw.rampNumber;
    const str = String(raw?.rampCode || raw?.rampName || raw?.checkIn?.rampNumber || '');
    const m = str.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  private normalizeReception(raw: any): ReceptionInfo {
    const rampNum = this.extractRampNumber(raw);
    const rampCode = raw?.rampCode || `LOC-RAMP-${String(rampNum).padStart(2, '0')}`;
    const stagingBay =
      raw?.stagingBay ||
      raw?.storageLocationCode ||
      raw?.destinationLocation ||
      `STAGING-R${String(rampNum).padStart(2, '0')}`;
    const seals = Array.isArray(raw?.sealNumbers)
      ? raw.sealNumbers
      : Array.isArray(raw?.checkIn?.sealNumbers)
        ? raw.checkIn.sealNumbers
        : raw?.sealNumber
          ? [raw.sealNumber]
          : [];
    return {
      ...raw,
      id: String(raw?.id || ''),
      folio: String(raw?.folio || raw?.docNumber || 'S/F'),
      status: String(raw?.status || 'REGISTERED'),
      clientName: String(raw?.clientName || raw?.checkIn?.client || 'CLIENTE REGISTRADO'),
      carrierName: String(raw?.carrierName || raw?.carrierLine || raw?.checkIn?.carrierLine || 'TRANSPORTE'),
      carrierLine: String(raw?.carrierLine || raw?.carrierName || raw?.checkIn?.carrierLine || 'TRANSPORTE'),
      rampNumber: rampNum,
      rampCode,
      driverName: String(raw?.driverName || raw?.checkIn?.driverName || 'OPERADOR'),
      tractorPlates: String(raw?.tractorPlates || raw?.checkIn?.tractorPlates || 'S/P'),
      boxPlates: String(raw?.boxPlates || raw?.checkIn?.boxPlates || 'S/P'),
      sealNumbers: seals,
      sealNumber: seals[0] || '',
      sku: raw?.sku || raw?.skuCode || '',
      productName: raw?.productName || '',
      lotNumber: raw?.lotNumber || '',
      totalPieces: Number(raw?.totalPieces || 0),
      palletsExpected: Number(raw?.palletsExpected || raw?.totalPallets || 24),
      totalPallets: Number(raw?.totalPallets || 0),
      stagingBay,
      pallets: Array.isArray(raw?.pallets) ? raw.pallets : undefined,
    };
  }

  private loadCatalogProducts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this.authState.user() as any;
    const orgId = user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const params = new HttpParams().set('organizationId', orgId);
    this.http.get<any>(`${this.apiBaseUrl}/api/v1/catalogs/products`, { params }).subscribe({
      next: (res) => {
        const items = res?.data?.content || res?.data || res || [];
        if (Array.isArray(items) && items.length > 0) {
          const mapped: ProductSku[] = items.map((p: any) => ({
            code: String(p.code || p.sku || p.id),
            name: String(p.name || p.description || 'Producto'),
            defaultPieces: Number(p.piecesPerPallet || p.defaultPieces || 135),
          }));
          const existingCodes = new Set(mapped.map((m) => m.code));
          const merged = [...mapped, ...CATALOG_PRODUCTS.filter((c) => !existingCodes.has(c.code))];
          this.products.set(merged);
        }
      },
      error: () => {},
    });
  }

  private broadcastWmsEvent(type: string, data: any): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('4g_cross_tab_event', JSON.stringify({ type, data, timestamp: Date.now() }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('4guard_wms_events');
          bc.postMessage({ type, data });
          bc.close();
        }
      }
    } catch {}
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
        host === '65.21.255.53' ||
        host === '46.224.3.72' ||
        host.startsWith('192.168.') ||
        host.startsWith('172.') ||
        host.startsWith('10.') ||
        host.endsWith('.local') ||
        !host.includes('onrender.com')
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

    this.http.get<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions`, { params }).pipe(
      timeout(15000)
    ).subscribe({
      next: (res) => {
        if (!silent) {
          this.isLoadingReceptions.set(false);
        }
        const rawList: any[] = res?.data?.content || res?.data || res || [];
        if (Array.isArray(rawList)) {
          const list = rawList.map((r) => this.normalizeReception(r));
          // Filtrar las recepciones activas en andén (no completadas ni canceladas)
          const activeRecs = list.filter(
            (r) => r && r.status !== 'COMPLETED' && r.status !== 'CANCELLED'
          );
          this.receptions.set(activeRecs);

          const current = this.selectedReception();
          if (current && this.isUuid(current.id)) {
            const fresh = activeRecs.find(
              (r) => r.id === current.id || r.folio === current.folio
            );
            if (fresh) {
              this.selectedReception.set({
                ...current,
                ...fresh,
                pallets: current.pallets,
              });
              // Si el conteo de tarimas en BD cambió externamente y no estamos procesando un escaneo local, sincronizar detalle
              if (!this.isProcessingScan() && fresh.totalPallets !== this.scannedPallets().length) {
                this.loadReceptionDetail(current.id, true);
              }
            } else if (activeRecs.length > 0 && !silent) {
              this.selectReception(activeRecs[0], silent);
            }
          } else if (activeRecs.length > 0) {
            this.selectReception(activeRecs[0], silent);
          }
        }
      },
      error: () => {
        if (!silent) {
          this.isLoadingReceptions.set(false);
        }
      },
    });
  }

  selectReception(rec: ReceptionInfo, silent = false): void {
    const normalized = this.normalizeReception(rec);
    const prev = this.selectedReception();
    const isSameReception = prev && (prev.id === normalized.id || prev.folio === normalized.folio);

    this.selectedReception.set(normalized);
    this.showReceptionPicker.set(false);

    // Precargar datos en los parámetros activos
    if (normalized.sku) {
      if (!this.products().some((p) => p.code === normalized.sku)) {
        this.products.update((list) => [
          {
            code: normalized.sku!,
            name: normalized.productName || 'PRODUCTO DE REMISIÓN',
            defaultPieces:
              normalized.totalPieces && normalized.palletsExpected
                ? Math.round(normalized.totalPieces / normalized.palletsExpected)
                : 135,
          },
          ...list,
        ]);
      }
      this.onSkuSelected(normalized.sku);
    }

    if (normalized.lotNumber) {
      this.activeLot.set(normalized.lotNumber);
      if (!this.availableLots().some((l) => l.lotNumber === normalized.lotNumber)) {
        this.availableLots.update((lots) => [
          ...lots,
          {
            lotNumber: normalized.lotNumber!,
            expirationDate: (rec as any).expirationDate || '2027-11-03',
            shelfLifePct: 90,
            isCompliant: true,
          },
        ]);
      }
    }

    // Si el resumen ya incluye pallets, mapearlos; si es la misma recepción, NUNCA borrar el buffer local
    if (Array.isArray(normalized.pallets) && normalized.pallets.length > 0) {
      this.hydratePalletsFromBackend(normalized.pallets, normalized);
    } else if (!isSameReception) {
      this.scannedPallets.set([]);
    }

    // Cargar detalle completo (pallets + lots + parámetros) desde GET /api/v1/warehouse-receptions/{id}
    if (this.isUuid(normalized.id)) {
      this.loadReceptionDetail(normalized.id, true);
    }

    if (!silent) {
      this.audioService.playSuccess();
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  private loadReceptionDetail(receptionId: string, preserveLocalUnsaved = true): void {
    if (!this.isUuid(receptionId)) return;
    this.http
      .get<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${receptionId}`)
      .pipe(timeout(15000))
      .subscribe({
        next: (res) => {
          const detail = res?.data || res;
          if (!detail) return;
          const normalized = this.normalizeReception(detail);
          this.selectedReception.set(normalized);

          // Hidratar SKU y piezas por tarima si vienen configurados en la recepción
          if (normalized.sku) {
            if (!this.products().some((p) => p.code === normalized.sku)) {
              this.products.update((list) => [
                {
                  code: normalized.sku!,
                  name: normalized.productName || 'PRODUCTO DE REMISIÓN',
                  defaultPieces: Number(detail.piecesPerPallet || 135),
                },
                ...list,
              ]);
            }
            this.selectedSku.set(normalized.sku);
            if (normalized.productName) {
              this.selectedProductName.set(normalized.productName);
            }
          }
          if (detail.piecesPerPallet && Number(detail.piecesPerPallet) > 0) {
            this.piecesPerPallet.set(Number(detail.piecesPerPallet));
          }

          // Hidratar lotes reales desde warehouse_reception_lots
          if (Array.isArray(detail.lots) && detail.lots.length > 0) {
            const mappedLots: LotItem[] = detail.lots.map((l: any) => ({
              lotNumber: String(l.lotNumber || '').toUpperCase(),
              expirationDate: String(l.expirationDate || '2027-11-03'),
              elaborationDate: l.elaborationDate ? String(l.elaborationDate) : undefined,
              shelfLifePct: 95,
              isCompliant: l.shelfLifeStatus !== 'REJECTED_SHELF_LIFE_POLICY',
            }));
            this.availableLots.set(mappedLots);
            if (normalized.lotNumber && mappedLots.some((l) => l.lotNumber === normalized.lotNumber)) {
              this.activeLot.set(normalized.lotNumber);
            } else if (mappedLots.length > 0 && !mappedLots.some((l) => l.lotNumber === this.activeLot())) {
              this.activeLot.set(mappedLots[0].lotNumber);
            }
          } else if (normalized.lotNumber) {
            this.activeLot.set(normalized.lotNumber);
          }

          // Hidratar tarimas reales desde warehouse_reception_pallets preservando escaneos locales en vuelo
          if (Array.isArray(detail.pallets)) {
            this.hydratePalletsFromBackend(detail.pallets, normalized, preserveLocalUnsaved);
          }
        },
        error: () => {},
      });
  }

  private hydratePalletsFromBackend(
    backendPallets: any[],
    rec: ReceptionInfo,
    preserveLocalUnsaved = true
  ): void {
    const mappedBackend: ScannedPallet[] = backendPallets.map((p, idx) => ({
      id: String(p.id || `pal-${idx + 1}`),
      palletNumber: Number(p.palletNumber || idx + 1),
      palletCode: String(p.palletCode || p.sscc || p.supplierUaCode || '').toUpperCase(),
      sku: String(p.skuCode || p.sku || rec.sku || this.selectedSku()),
      productId: String(p.skuCode || p.sku || rec.sku || this.selectedSku()),
      productName: String(p.productName || rec.productName || this.selectedProductName()),
      description: String(p.productName || rec.productName || this.selectedProductName()),
      lotNumber: String(p.lotNumber || rec.lotNumber || this.activeLot()),
      expirationDate: String(p.expirationDate || this.activeLotExpiration()),
      pieces: Number(p.pieces ?? p.quantity ?? 135),
      palletType: String(p.palletTypeLabel || p.palletType || this.selectedPalletType()),
      palletTypeId: this.toBackendPalletType(p.palletType || this.selectedPalletType()),
      palletTypeLabel: String(p.palletTypeLabel || p.palletType || this.selectedPalletType()),
      scannedAt: p.createdAt
        ? new Date(p.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      observations: p.observations || '',
    }));

    if (preserveLocalUnsaved) {
      const backendCodes = new Set(mappedBackend.map((b) => b.palletCode.toUpperCase()));
      const inFlightLocal = this.scannedPallets().filter(
        (local) => !this.isUuid(local.id) && !backendCodes.has(local.palletCode.toUpperCase())
      );
      const combined = [...inFlightLocal, ...mappedBackend].sort(
        (a, b) => (b.palletNumber || 0) - (a.palletNumber || 0)
      );
      this.scannedPallets.set(combined);
    } else {
      const sorted = [...mappedBackend].sort((a, b) => (b.palletNumber || 0) - (a.palletNumber || 0));
      this.scannedPallets.set(sorted);
    }
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

    const rec = this.selectedReception();
    if (rec && this.isUuid(rec.id)) {
      this.http
        .post<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/lots`, {
          lotNumber: rawLot,
          elaborationDate: elab || null,
          expirationDate: exp || null,
          notes: 'Registrado desde Terminal RF en andén',
        })
        .subscribe({
          next: () => {
            this.broadcastWmsEvent('RECEPTION_LOT_ADDED', { receptionId: rec.id, lotNumber: rawLot });
          },
          error: (err) => {
            const msg = err?.error?.message || 'Error al persistir lote en el servidor.';
            this.toast.warning(msg);
          },
        });
    }

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

    // Escalera progresiva de compatibilidad (1080p -> 720p -> fallback) para nitidez de códigos 1D/2D
    const attempts = buildCameraConstraintsLadder(mode);

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
    applyCameraEnhancements(stream);
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
    this.cameraDebounce.reset();
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

  toggleScanOrientation(): void {
    const next = this.scanOrientation() === 'horizontal' ? 'vertical' : 'horizontal';
    this.scanOrientation.set(next);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(30);
    this.toast.info(next === 'vertical' ? 'Escaneo Vertical activo (haz rotado 90°)' : 'Escaneo Horizontal activo (haz estándar)');
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
            let barcodes = await detector.detect(video);
            // Si no detectó y estamos en modo vertical, rotar frame 90° para decodificar códigos 1D verticales
            if ((!barcodes || barcodes.length === 0) && this.scanOrientation() === 'vertical') {
              const rotated = this.getRotatedCanvas(video);
              if (rotated) {
                barcodes = await detector.detect(rotated);
              }
            }

            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              if (code && this.cameraDebounce.shouldProcess(code)) {
                this.processCode(code);
              }
            }
          } catch (_) {}
        }, 280);
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
        const codeReader = createEnhancedZxingReader(ZXing);
        this.zxingReader = codeReader;
        codeReader.decodeFromVideoElement(video, (result: any) => {
          if (result && result.getText && !this.isProcessingScan()) {
            const code = result.getText().trim();
            if (code && this.cameraDebounce.shouldProcess(code)) {
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
      setTimeout(() => this.isProcessingScan.set(false), 1500);
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
    }, 1000);
  }

  private syncPalletWithBackend(
    recId: string,
    newPallet: ScannedPallet,
    allPallets: ScannedPallet[]
  ): void {
    if (!this.isUuid(recId)) return;

    const backendPalletType = this.toBackendPalletType(newPallet.palletTypeId || newPallet.palletType);
    const paramsPayload = {
      status: 'IN_PROGRESS',
      skuCode: newPallet.sku,
      productName: newPallet.productName,
      lotNumber: newPallet.lotNumber,
      expirationDate: newPallet.expirationDate || null,
      piecesPerPallet: newPallet.pieces,
      palletType: backendPalletType,
      forkliftOperatorName: this.operatorName(),
    };

    const palletPayload = {
      pallets: [
        {
          palletNumber: newPallet.palletNumber,
          palletCode: newPallet.palletCode,
          pieces: newPallet.pieces,
          palletType: backendPalletType,
          lotNumber: newPallet.lotNumber,
          expirationDate: newPallet.expirationDate || null,
          observations: newPallet.observations || 'Escaneada desde Terminal RF',
        },
      ],
    };

    // 1. Asegurar parámetros y estatus IN_PROGRESS en la recepción y luego persistir la tarima en BD
    this.http
      .put<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${recId}/parameters`, paramsPayload)
      .subscribe({
        next: () => {
          this.postPalletToBackend(recId, newPallet, palletPayload);
        },
        error: () => {
          // Intentar persistir la tarima aun si parameters devolvió advertencia
          this.postPalletToBackend(recId, newPallet, palletPayload);
        },
      });
  }

  private postPalletToBackend(
    recId: string,
    localPallet: ScannedPallet,
    palletPayload: any
  ): void {
    this.http
      .post<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${recId}/pallets`, palletPayload)
      .subscribe({
        next: (res) => {
          const savedList: any[] = res?.data || res || [];
          const match = Array.isArray(savedList)
            ? savedList.find(
                (p) =>
                  String(p.palletCode || '').toUpperCase() === localPallet.palletCode.toUpperCase()
              ) || savedList[savedList.length - 1]
            : null;
          if (match && match.id) {
            this.scannedPallets.update((list) =>
              list.map((p) =>
                p.palletCode.toUpperCase() === localPallet.palletCode.toUpperCase()
                  ? {
                      ...p,
                      id: String(match.id),
                      palletNumber: Number(match.palletNumber || p.palletNumber),
                    }
                  : p
              )
            );
          }
          this.broadcastWmsEvent('RECEPTION_PALLET_SCANNED', {
            receptionId: recId,
            palletCode: localPallet.palletCode,
          });
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo guardar la tarima en la base de datos.';
          this.toast.error(msg);
        },
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
    if (rec && this.isUuid(rec.id)) {
      if (this.isUuid(target.id)) {
        this.http
          .put<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/pallets/${target.id}`, {
            pieces: updated.pieces,
            palletType: this.toBackendPalletType(updated.palletType),
            lotNumber: updated.lotNumber,
            expirationDate: updated.expirationDate || null,
            observations: updated.observations,
          })
          .subscribe({
            next: () => {
              this.broadcastWmsEvent('RECEPTION_PALLET_UPDATED', { receptionId: rec.id, palletId: target.id });
            },
            error: (err) => {
              this.toast.error(err?.error?.message || 'Error al actualizar tarima en el servidor.');
            },
          });
      } else {
        this.syncPalletWithBackend(rec.id, updated, newPallets);
      }
    }

    this.toast.success(`Tarima #${target.palletNumber} actualizada: ${pieces} pzas • Lote ${updated.lotNumber}`);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
    this.closeEditPalletModal();
  }

  deletePallet(pallet: ScannedPallet): void {
    this.scannedPallets.update((list) => list.filter((p) => p.id !== pallet.id));
    const rec = this.selectedReception();
    if (rec && this.isUuid(rec.id) && this.isUuid(pallet.id)) {
      this.http
        .delete<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/pallets/${pallet.id}`)
        .subscribe({
          next: () => {
            this.broadcastWmsEvent('RECEPTION_PALLET_DELETED', { receptionId: rec.id, palletId: pallet.id });
          },
          error: (err) => {
            this.toast.error(err?.error?.message || 'No se pudo eliminar la tarima en la base de datos.');
          },
        });
    }
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
      forkliftOperatorName: op,
      skuCode: this.selectedSku(),
      productName: this.selectedProductName(),
      lotNumber: this.activeLot(),
      expirationDate: this.activeLotExpiration() || null,
      piecesPerPallet: this.piecesPerPallet(),
      palletType: this.toBackendPalletType(this.selectedPalletType()),
      observations: `Descarga física concluida en andén desde Terminal RF por ${op}. Turnado a Mesa de Control para Pauta F01.`,
    };

    const unsaved = stream.filter((p) => !this.isUuid(p.id));
    const finalizeParams = () => {
      this.http
        .put<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/parameters`, concludePayload)
        .subscribe({
          next: (res) => {
            this.broadcastWmsEvent('RECEPTION_DISCHARGED', res?.data || rec);
            this.finishConcludeSuccess(rec, stream, totalPzas);
          },
          error: (err) => {
            this.isConcluding.set(false);
            this.toast.error(err?.error?.message || 'Error al concluir la descarga en el servidor.');
          },
        });
    };

    if (this.isUuid(rec.id) && unsaved.length > 0) {
      this.http
        .post<any>(`${this.apiBaseUrl}/api/v1/warehouse-receptions/${rec.id}/pallets`, {
          pallets: unsaved.map((p) => ({
            palletNumber: p.palletNumber,
            palletCode: p.palletCode,
            pieces: p.pieces,
            palletType: this.toBackendPalletType(p.palletTypeId || p.palletType),
            lotNumber: p.lotNumber,
            expirationDate: p.expirationDate || null,
            observations: p.observations || 'Escaneada desde Terminal RF',
          })),
        })
        .subscribe({
          next: () => finalizeParams(),
          error: () => finalizeParams(),
        });
    } else {
      finalizeParams();
    }
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
