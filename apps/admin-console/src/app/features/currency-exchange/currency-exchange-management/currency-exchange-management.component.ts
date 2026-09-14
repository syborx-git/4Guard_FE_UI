/**
 * @file currency-exchange-management.component.ts
 * @description Componente principal HU-148 — Gestión de Divisas y Tipos de Cambio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISEÑO & ARQUITECTURA (Homologado con Transportistas y Licencias WMS)
 * ═══════════════════════════════════════════════════════════════════════════
 * - Hero compacto + 4 KPI cards financieras
 * - Split View 35% / 65% (Directorio de monedas / Editor + Historial + Paridades)
 * - Formulario de moneda con ReactiveFormsModule + validadores reactivos
 * - Formulario de tipo de cambio con validaciones financieras
 * - Calculadora / simulador de conversión en tiempo real
 * - Panel de auditoría forense con trail completo
 * - Soporte nativo Dark/Light Mode + micro-animaciones
 * - ChangeDetectionStrategy.OnPush + signals para máximo rendimiento
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ToastService } from '../../../core/services/toast.service';
import { AuthState } from '../../../core/auth/auth.state';
import { CurrencyExchangeService } from '../currency-exchange.service';

import {
  Currency,
  ExchangeRate,
  CurrencyAuditEntry,
  CurrencyStatus,
  RateSourceType,
  RATE_SOURCE_LABELS,
  EXCHANGE_RATE_STATUS_LABELS,
  AUDIT_ACTION_LABELS,
  ConvertCurrencyResult,
  BanxicoLiveRateData,
} from '../currency-exchange.models';

import {
  positiveFiniteNumberValidator,
  maximumDecimalPlacesValidator,
  noWhitespaceOnlyValidator,
} from '../currency-exchange.validators';

type PanelView = 'CURRENCY_FORM' | 'RATE_FORM' | 'CONVERTER' | 'AUDIT';
type FormMode = 'CREATE' | 'EDIT';

@Component({
  selector: 'fg-currency-exchange-management',
  standalone: true,
  imports: [CommonModule, DecimalPipe, ReactiveFormsModule],
  templateUrl: './currency-exchange-management.component.html',
  styleUrl: './currency-exchange-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyExchangeManagementComponent implements OnInit, OnDestroy {
  // ─── Servicios ──────────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);
  protected readonly ceService = inject(CurrencyExchangeService);

  // ─── Destroy subject ────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ─── Catálogos de etiquetas ─────────────────────────────────────────────
  protected readonly sourceLabelMap = RATE_SOURCE_LABELS;
  protected readonly statusLabelMap = EXCHANGE_RATE_STATUS_LABELS;
  protected readonly auditActionMap = AUDIT_ACTION_LABELS;

  // ─── Estado de UI ────────────────────────────────────────────────────────
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly panelView = signal<PanelView>('CURRENCY_FORM');
  protected readonly formMode = signal<FormMode>('CREATE');
  protected readonly selectedCurrency = signal<Currency | null>(null);
  protected readonly showConfirmModal = signal(false);
  protected readonly confirmModalConfig = signal<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => void;
  } | null>(null);
  protected readonly showAuditDrawer = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<'ALL' | CurrencyStatus>('ALL');

  // ─── Banxico Live State ───────────────────────────────────────────────
  protected readonly isFetchingBanxico = signal(false);
  protected readonly isSyncingBanxico = signal(false);
  protected readonly banxicoLiveInfo = signal<BanxicoLiveRateData | null>(null);

  // ─── Calculadora de conversión ─────────────────────────────────────────
  protected readonly simAmount = signal<number>(1);
  protected readonly simSource = signal<string>('USD');
  protected readonly simTarget = signal<string>('MXN');
  protected readonly isConverting = signal(false);
  protected readonly liveConversion = signal<ConvertCurrencyResult | null>(null);

  // ─── Monedas filtradas para el directorio ───────────────────────────────
  protected readonly filteredCurrencies = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const sf = this.statusFilter();
    return this.ceService.currencies().filter((c) => {
      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q);
      const matchStatus = sf === 'ALL' || c.status === sf;
      return matchSearch && matchStatus;
    });
  });

  // ─── Tipos de cambio del par seleccionado ──────────────────────────────
  protected readonly selectedCurrencyRates = computed(() => {
    const sel = this.selectedCurrency();
    if (!sel) return [];
    return this.ceService
      .exchangeRates()
      .filter((r) => r.fromCurrencyCode === sel.code || r.toCurrencyCode === sel.code);
  });

  // ─── KPIs computados ────────────────────────────────────────────────────
  protected readonly kpis = computed(() => {
    const currencies = this.ceService.currencies();
    const rates = this.ceService.exchangeRates();
    const base = currencies.find((c) => c.isBase);

    const usdRates = rates
      .filter(
        (r) =>
          r.status === 'ACTIVE' &&
          ((r.fromCurrencyCode === 'USD' && r.toCurrencyCode === 'MXN') ||
            (r.fromCurrencyCode === 'MXN' && r.toCurrencyCode === 'USD'))
      )
      .sort((a, b) => {
        const dateDiff = new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return timeB - timeA;
      });

    const latestUsd = usdRates[0];
    const latestRateUsdMxn = latestUsd
      ? latestUsd.fromCurrencyCode === 'USD'
        ? latestUsd.rate
        : latestUsd.inverseRate
      : 17.0147;

    return {
      baseCurrencyCode: base?.code ?? '—',
      activeCurrencies: currencies.filter((c) => c.status === 'ACTIVE').length,
      totalRates: rates.length,
      latestRateUsdMxn,
    };
  });

  // ─── Usuario actual ─────────────────────────────────────────────────────
  protected get currentUserEmail(): string {
    return this.authState.currentUser()?.email ?? 'admin';
  }

  // ─── Formularios ────────────────────────────────────────────────────────
  protected currencyForm!: FormGroup;
  protected rateForm!: FormGroup;

  // ─── Fuentes de tasa disponibles ─────────────────────────────────────────
  protected readonly rateSources: RateSourceType[] = [
    'CENTRAL_BANK',
    'API_AUTO',
    'MANUAL',
    'CUSTOM',
  ];

  // ─── Auditoría filtrada ──────────────────────────────────────────────────
  protected readonly auditEntries = computed<CurrencyAuditEntry[]>(() => {
    return this.ceService.auditEntries();
  });

  // ════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this._buildCurrencyForm();
    this._buildRateForm();
    this._loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ════════════════════════════════════════════════════════════════════════
  // FORMULARIOS
  // ════════════════════════════════════════════════════════════════════════

  private _buildCurrencyForm(): void {
    this.currencyForm = this.fb.group({
      code: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(3),
          Validators.pattern(/^[A-Za-z]{3}$/),
          noWhitespaceOnlyValidator(),
        ],
      ],
      name: [
        '',
        [Validators.required, Validators.maxLength(80), noWhitespaceOnlyValidator()],
      ],
      symbol: [
        '',
        [Validators.required, Validators.maxLength(8), noWhitespaceOnlyValidator()],
      ],
      decimalPlaces: [2, [Validators.required, Validators.min(0), Validators.max(6)]],
      isBase: [false],
      status: ['ACTIVE', Validators.required],
    });
  }

  private _buildRateForm(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.rateForm = this.fb.group({
      toCurrencyId: ['', Validators.required],
      rate: [
        '',
        [
          Validators.required,
          positiveFiniteNumberValidator(),
          maximumDecimalPlacesValidator(6),
        ],
      ],
      effectiveDate: [today, Validators.required],
      sourceType: ['MANUAL', Validators.required],
      notes: ['', [Validators.maxLength(255)]],
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // CARGA INICIAL
  // ════════════════════════════════════════════════════════════════════════

  private _loadInitialData(): void {
    this.isLoading.set(true);
    const orgId = this.authState.currentUser()?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

    this.ceService.getCurrencies(orgId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isLoading.set(false);
        const list = this.ceService.currencies();
        if (list.length > 0) {
          const nonBase = list.find((c) => !c.isBase);
          this.selectCurrency(nonBase || list[0]);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
    });

    this.ceService.getExchangeRates({ organizationId: orgId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const rates = res.data || [];
        const todayStr = new Date().toISOString().slice(0, 10);
        const hasTodayRate = rates.some(
          (r) =>
            r.effectiveDate === todayStr &&
            r.status === 'ACTIVE' &&
            r.sourceType === 'CENTRAL_BANK'
        );

        // Si las paridades oficiales no están al día, sincronizar automáticamente con Banxico
        if (!hasTodayRate) {
          this.syncBanxicoAll(true);
        } else {
          this.executeLiveConversion();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.executeLiveConversion();
        this.cdr.markForCheck();
      },
    });

    this.ceService.getAuditLog({ organizationId: orgId }).pipe(takeUntil(this.destroy$)).subscribe();
  }

  // ════════════════════════════════════════════════════════════════════════
  // SELECCIÓN DE MONEDA
  // ════════════════════════════════════════════════════════════════════════

  protected selectCurrency(currency: Currency): void {
    this.selectedCurrency.set(currency);
    this.panelView.set('CURRENCY_FORM');
    this.formMode.set('EDIT');
    this._patchCurrencyForm(currency);
    this.cdr.markForCheck();
  }

  protected createNewCurrency(): void {
    this.selectedCurrency.set(null);
    this.panelView.set('CURRENCY_FORM');
    this.formMode.set('CREATE');
    this.currencyForm.reset({ decimalPlaces: 2, status: 'ACTIVE', isBase: false });
    this.currencyForm.get('code')?.enable();
    this.cdr.markForCheck();
  }

  private _patchCurrencyForm(c: Currency): void {
    this.currencyForm.patchValue({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      decimalPlaces: c.decimalPlaces,
      isBase: c.isBase,
      status: c.status,
    });
    this.currencyForm.get('code')?.disable();
    this.currencyForm.markAsPristine();
  }

  // ════════════════════════════════════════════════════════════════════════
  // VISTAS DEL PANEL
  // ════════════════════════════════════════════════════════════════════════

  protected openRateForm(): void {
    if (!this.selectedCurrency()) return;
    this.panelView.set('RATE_FORM');
    const today = new Date().toISOString().slice(0, 10);
    this.banxicoLiveInfo.set(null);
    const targets = this.availableTargetCurrencies;
    const defaultTargetId = targets.length > 0 ? targets[0].id : '';
    this.rateForm.reset({
      toCurrencyId: defaultTargetId,
      sourceType: 'CENTRAL_BANK',
      effectiveDate: today,
    });
    this.fetchBanxicoLive();
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════════════════
  // CONSULTA LIVE BANXICO (GET /api/v1/exchange-rates/banxico/live/{seriesId})
  // ════════════════════════════════════════════════════════════════════════

  protected fetchBanxicoLive(): void {
    const fromCode = this.selectedCurrency()?.code?.toUpperCase() || 'USD';
    const targetId = this.rateForm.get('toCurrencyId')?.value;
    const targetCurrency = this.ceService.currencies().find((c) => c.id === targetId);
    const toCode = targetCurrency?.code?.toUpperCase() || 'MXN';

    // Determinar la serie de Banxico según el par (USD/MXN o EUR/MXN)
    let seriesId = 'SF57805'; // Dólar FIX
    let foreignCode = 'USD';

    if (fromCode === 'EUR' || toCode === 'EUR') {
      seriesId = 'SF46410';
      foreignCode = 'EUR';
    } else {
      seriesId = 'SF57805';
      foreignCode = 'USD';
    }

    this.isFetchingBanxico.set(true);

    this.ceService
      .getBanxicoLiveRate(seriesId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isFetchingBanxico.set(false);
          if (res.success && res.data) {
            this.banxicoLiveInfo.set(res.data);
            const spotRate = Number(res.data.rate);
            
            // Si el origen es MXN y el destino es divisa extranjera, la tasa directa es 1 / spotRate
            let appliedRate = spotRate;
            if (fromCode === 'MXN' && toCode !== 'MXN' && spotRate > 0) {
              appliedRate = Number((1 / spotRate).toFixed(6));
            }

            // Auto-poblar el formulario permitiendo edición
            this.rateForm.patchValue({
              rate: appliedRate,
              sourceType: 'CENTRAL_BANK',
              notes: `Cotización oficial Banxico (${res.data.seriesId}) pub: ${res.data.publicationDate} [1 ${foreignCode} = ${spotRate} MXN]`,
            });
            this.rateForm.markAsDirty();

            this.toast.success(
              `Cotización Banxico aplicada: ${appliedRate} para ${fromCode} → ${toCode} (Oficial: 1 ${foreignCode} = ${spotRate} MXN).`
            );
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isFetchingBanxico.set(false);
          const msg = err?.error?.message || 'Error al conectar con la API de Banxico SIE. Verifique la conexión con el servidor.';
          this.toast.error(msg);
          this.cdr.markForCheck();
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // SINCRONIZACIÓN COMPLETA BANXICO SIE (POST /api/v1/exchange-rates/sync/banxico)
  // ════════════════════════════════════════════════════════════════════════

  protected syncBanxicoAll(silent = false): void {
    const orgId = this.authState.currentUser()?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    this.isSyncingBanxico.set(true);

    this.ceService
      .syncBanxicoRates(orgId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSyncingBanxico.set(false);
          if (!silent) {
            this.toast.success(res.message || 'Sincronización con Banxico SIE completada con éxito.');
          }
          this.ceService.getExchangeRates({ organizationId: orgId }).pipe(takeUntil(this.destroy$)).subscribe();
          this.ceService.getAuditLog({ organizationId: orgId }).pipe(takeUntil(this.destroy$)).subscribe();
          this.executeLiveConversion();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSyncingBanxico.set(false);
          if (!silent) {
            const msg = err?.error?.message || 'Error al sincronizar con la API de Banxico. Verifique el token de integración.';
            this.toast.error(msg);
          }
          this.executeLiveConversion();
          this.cdr.markForCheck();
        },
      });
  }

  protected openConverter(): void {
    this.panelView.set('CONVERTER');
    this.executeLiveConversion();
    this.cdr.markForCheck();
  }

  protected openAudit(): void {
    this.showAuditDrawer.set(true);
    this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
    this.cdr.markForCheck();
  }

  protected closeAudit(): void {
    this.showAuditDrawer.set(false);
    this.cdr.markForCheck();
  }

  protected backToCurrencyForm(): void {
    this.panelView.set('CURRENCY_FORM');
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════════════════
  // ACCIONES CON MONEDAS
  // ════════════════════════════════════════════════════════════════════════

  protected saveCurrency(): void {
    if (this.currencyForm.invalid || this.isSaving()) return;

    const raw = this.currencyForm.getRawValue();

    if (this.formMode() === 'CREATE') {
      if (this.ceService.isDuplicateCode(raw.code)) {
        this.toast.error(`El código de divisa ${raw.code.toUpperCase()} ya existe.`);
        return;
      }
      this._doCreateCurrency(raw);
    } else {
      this._doUpdateCurrency(raw);
    }
  }

  private _doCreateCurrency(raw: any): void {
    this.isSaving.set(true);

    this.ceService
      .createCurrency({
        organizationId: this.selectedCurrency()?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        code: String(raw.code).toUpperCase(),
        name: String(raw.name),
        symbol: String(raw.symbol),
        isBase: Boolean(raw.isBase),
        decimalPlaces: Number(raw.decimalPlaces),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message || 'Divisa creada con éxito en la base de datos.');
          if (res.data) this.selectCurrency(res.data);
          this.ceService.getCurrencies().pipe(takeUntil(this.destroy$)).subscribe();
          this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || 'Error al registrar la divisa en el servidor.';
          this.toast.error(msg);
          this.cdr.markForCheck();
        },
      });
  }

  private _doUpdateCurrency(raw: any): void {
    const currency = this.selectedCurrency();
    if (!currency) return;

    this.isSaving.set(true);

    this.ceService
      .updateCurrency(currency.id, {
        name: String(raw.name),
        symbol: String(raw.symbol),
        decimalPlaces: Number(raw.decimalPlaces),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message || 'Divisa actualizada con éxito en la base de datos.');
          if (res.data) this.selectedCurrency.set(res.data);
          this.currencyForm.markAsPristine();
          this.ceService.getCurrencies().pipe(takeUntil(this.destroy$)).subscribe();
          this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || 'Error al actualizar la divisa en el servidor.';
          this.toast.error(msg);
          this.cdr.markForCheck();
        },
      });
  }

  protected toggleCurrencyStatus(currency: Currency): void {
    if (currency.isBase) {
      this.toast.error('La divisa base principal no puede inactivarse.');
      return;
    }

    const newStatus: CurrencyStatus = currency.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.confirmModalConfig.set({
      title: `${newStatus === 'INACTIVE' ? 'Inactivar' : 'Activar'} divisa`,
      message: `¿Deseas ${newStatus === 'INACTIVE' ? 'inactivar' : 'activar'} la divisa <strong>${currency.code} — ${currency.name}</strong>?`,
      confirmLabel: newStatus === 'INACTIVE' ? 'Inactivar' : 'Activar',
      action: () => {
        this.ceService
          .updateCurrencyStatus(currency.id, newStatus)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.toast.success(res.message || 'Estatus de divisa actualizado con éxito.');
              if (this.selectedCurrency()?.id === currency.id) {
                this.selectedCurrency.set({ ...currency, status: newStatus });
              }
              this.ceService.getCurrencies().pipe(takeUntil(this.destroy$)).subscribe();
              this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
              this.cdr.markForCheck();
            },
            error: (err) => {
              const msg = err?.error?.message || 'Error al actualizar el estatus de la divisa.';
              this.toast.error(msg);
              this.cdr.markForCheck();
            },
          });
      },
    });

    this.showConfirmModal.set(true);
    this.cdr.markForCheck();
  }

  protected setAsBaseCurrency(currency: Currency): void {
    if (currency.isBase) return;

    this.confirmModalConfig.set({
      title: 'Asignar Divisa Base Principal',
      message: `¿Confirmas establecer <strong>${currency.code} — ${currency.name}</strong> como la Divisa Base de la Organización? Esto desmarcará la divisa base anterior.`,
      confirmLabel: 'Establecer como Base',
      action: () => {
        this.ceService
          .setBaseCurrency(currency.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.toast.success(res.message || 'Divisa base establecida con éxito.');
              if (this.selectedCurrency()?.id === currency.id) {
                this.selectedCurrency.set({ ...currency, isBase: true });
              }
              this.ceService.getCurrencies().pipe(takeUntil(this.destroy$)).subscribe();
              this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
              this.cdr.markForCheck();
            },
            error: (err) => {
              const msg = err?.error?.message || 'Error al establecer la divisa base principal.';
              this.toast.error(msg);
              this.cdr.markForCheck();
            },
          });
      },
    });

    this.showConfirmModal.set(true);
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════════════════
  // GUARDAR TIPO DE CAMBIO
  // ════════════════════════════════════════════════════════════════════════

  protected saveExchangeRate(): void {
    if (this.rateForm.invalid || this.isSaving() || !this.selectedCurrency()) return;

    const raw = this.rateForm.value;
    const currency = this.selectedCurrency()!;

    this.isSaving.set(true);

    this.ceService
      .createExchangeRate({
        organizationId: currency.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        fromCurrencyId: currency.id,
        toCurrencyId: raw.toCurrencyId,
        rate: parseFloat(raw.rate),
        effectiveDate: raw.effectiveDate,
        sourceType: raw.sourceType,
        notes: raw.notes ?? '',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message || 'Tipo de cambio registrado con éxito en la base de datos.');
          this.ceService.getExchangeRates().pipe(takeUntil(this.destroy$)).subscribe();
          this.ceService.getAuditLog().pipe(takeUntil(this.destroy$)).subscribe();
          this.panelView.set('CURRENCY_FORM');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || 'Error al registrar el tipo de cambio en el servidor.';
          this.toast.error(msg);
          this.cdr.markForCheck();
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // CALCULADORA
  // ════════════════════════════════════════════════════════════════════════

  protected updateSimAmount(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.simAmount.set(isNaN(val) ? 0 : val);
    this.executeLiveConversion();
  }

  protected updateSimSource(event: Event): void {
    this.simSource.set((event.target as HTMLSelectElement).value);
    this.executeLiveConversion();
  }

  protected updateSimTarget(event: Event): void {
    this.simTarget.set((event.target as HTMLSelectElement).value);
    this.executeLiveConversion();
  }

  protected swapSimCurrencies(): void {
    const src = this.simSource();
    const tgt = this.simTarget();
    this.simSource.set(tgt);
    this.simTarget.set(src);
    this.executeLiveConversion();
  }

  protected executeLiveConversion(): void {
    const amount = this.simAmount();
    const fromCode = this.simSource();
    const toCode = this.simTarget();

    if (amount <= 0 || !fromCode || !toCode) return;

    this.isConverting.set(true);

    this.ceService
      .convertCurrency({
        organizationId: this.selectedCurrency()?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        fromCode,
        toCode,
        amount,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isConverting.set(false);
          if (res.data) {
            this.liveConversion.set(res.data);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isConverting.set(false);
          this.liveConversion.set(null);
          const msg = err?.error?.message || 'No se encontró un tipo de cambio vigente para realizar la conversión.';
          this.toast.warning(msg);
          this.cdr.markForCheck();
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODAL DE CONFIRMACIÓN
  // ════════════════════════════════════════════════════════════════════════

  protected confirmAction(): void {
    this.confirmModalConfig()?.action();
    this.closeConfirmModal();
  }

  protected closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmModalConfig.set(null);
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════════════════
  // FILTROS
  // ════════════════════════════════════════════════════════════════════════

  protected updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected setStatusFilter(status: 'ALL' | CurrencyStatus): void {
    this.statusFilter.set(status);
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEMPLATE HELPERS
  // ════════════════════════════════════════════════════════════════════════

  protected trackByCurrencyId(_: number, c: Currency): string {
    return c.id;
  }

  protected trackByRateId(_: number, r: ExchangeRate): string {
    return r.id;
  }

  protected trackByAuditId(_: number, a: CurrencyAuditEntry): string {
    return a.id;
  }

  protected formatDateMX(isoDate?: string | null): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  protected get availableTargetCurrencies(): Currency[] {
    const sel = this.selectedCurrency();
    return this.ceService
      .currencies()
      .filter((c) => c.status === 'ACTIVE' && c.id !== sel?.id);
  }

  protected cfError(field: string, error: string): boolean {
    const ctrl = this.currencyForm.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }

  protected rfError(field: string, error: string): boolean {
    const ctrl = this.rateForm.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }
}
