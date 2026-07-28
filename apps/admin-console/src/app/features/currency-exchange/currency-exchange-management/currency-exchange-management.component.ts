/**
 * @file currency-exchange-management.component.ts
 * @description Componente principal HU-148 — Gestión de Divisas y Tipos de Cambio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISEÑO & ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 * - Hero compacto + 4 KPI cards financieras
 * - Split View 35% / 65% (Directorio de monedas / Editor + Historial)
 * - Formulario de moneda con ReactiveFormsModule + validadores personalizados
 * - Formulario de tipo de cambio con validaciones financieras
 * - Simulador de conversión en tiempo real con Angular Signals
 * - Panel de auditoría con trail completo
 * - Soporte nativo Dark Mode + micro-animaciones 180ms–260ms
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
  effect,
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
  ExchangeRateSource,
  EXCHANGE_RATE_SOURCE_LABELS,
  EXCHANGE_RATE_STATUS_LABELS,
  FRESHNESS_LABELS,
} from '../currency-exchange.models';

import {
  positiveFiniteNumberValidator,
  maximumDecimalPlacesValidator,
  noWhitespaceOnlyValidator,
} from '../currency-exchange.validators';

// ─── Tipos del componente ──────────────────────────────────────────────────
type PanelView = 'CURRENCY_FORM' | 'RATE_FORM' | 'AUDIT';
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

  // ─── Catálogos de etiquetas (expuestos al template) ────────────────────
  protected readonly sourceLabelMap = EXCHANGE_RATE_SOURCE_LABELS;
  protected readonly statusLabelMap = EXCHANGE_RATE_STATUS_LABELS;
  protected readonly freshnessLabelMap = FRESHNESS_LABELS;

  // ─── Estado de UI ────────────────────────────────────────────────────────
  protected readonly isLoadingCurrencies = signal(false);
  protected readonly isLoadingRates = signal(false);
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

  // ─── Señales para simulador de conversión ───────────────────────────────
  protected readonly simAmount = signal<number>(1000);
  protected readonly simSource = signal<string>('USD');
  protected readonly simTarget = signal<string>('MXN');

  protected readonly conversionResult = computed(() => {
    const amount = this.simAmount();
    const source = this.simSource();
    const target = this.simTarget();
    const currencies = this.ceService.currencies();

    if (source === target) {
      return { result: amount, rate: 1, found: true };
    }

    // Buscar tipo de cambio directo
    const directRate = this.ceService.getCurrentRate(source, target);
    if (directRate) {
      return {
        result: amount * directRate.rate,
        rate: directRate.rate,
        found: true,
      };
    }

    // Búsqueda inversa: target → source
    const inverseRate = this.ceService.getCurrentRate(target, source);
    if (inverseRate) {
      return {
        result: amount / inverseRate.rate,
        rate: 1 / inverseRate.rate,
        found: true,
      };
    }

    // Si ambas tienen rate respecto a MXN, triangular
    const srcCurrency = currencies.find((c) => c.isoCode === source);
    const tgtCurrency = currencies.find((c) => c.isoCode === target);
    if (srcCurrency && tgtCurrency && srcCurrency.currentRate > 0) {
      const rate = tgtCurrency.currentRate / srcCurrency.currentRate;
      return {
        result: amount * rate,
        rate,
        found: true,
      };
    }

    return { result: 0, rate: 0, found: false };
  });

  // ─── Monedas filtradas para el directorio ───────────────────────────────
  protected readonly filteredCurrencies = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const sf = this.statusFilter();
    return this.ceService.currencies().filter((c) => {
      const matchSearch =
        !q ||
        c.isoCode.toLowerCase().includes(q) ||
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
      .filter((r) => r.sourceCurrencyCode === sel.isoCode)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  });

  // ─── KPIs computados ────────────────────────────────────────────────────
  protected readonly kpis = computed(() => {
    const currencies = this.ceService.currencies();
    const rates = this.ceService.exchangeRates();
    const base = currencies.find((c) => c.isBaseCurrency);

    return {
      baseCurrencyCode: base?.isoCode ?? '—',
      activeCurrencies: currencies.filter((c) => c.status === 'ACTIVE').length,
      currentRates: rates.filter((r) => r.status === 'CURRENT').length,
      reviewRequired: currencies.filter((c) => c.freshnessStatus === 'REVIEW_REQUIRED').length,
    };
  });

  // ─── Usuario actual ─────────────────────────────────────────────────────
  protected get currentUserEmail(): string {
    return this.authState.currentUser()?.email ?? 'gerente.operaciones@4guard.mx';
  }

  // ─── Formularios ────────────────────────────────────────────────────────
  protected currencyForm!: FormGroup;
  protected rateForm!: FormGroup;

  // ─── Fuentes disponibles ─────────────────────────────────────────────────
  protected readonly rateSources: ExchangeRateSource[] = [
    'MANUAL',
    'OFFICIAL_REFERENCE',
    'BANK',
    'COMMERCIAL_AGREEMENT',
    'CLIENT_CONTRACT',
    'OTHER',
  ];

  // ─── Auditoría filtrada ──────────────────────────────────────────────────
  protected readonly auditEntries = computed<CurrencyAuditEntry[]>(() => {
    const sel = this.selectedCurrency();
    const all = this.ceService.auditEntries();
    if (!sel) return all;
    return all.filter((a) => a.entityId === sel.id || a.entityId.startsWith('er-'));
  });

  // ─── Estado del formulario de tipo de cambio ─────────────────────────────
  protected readonly selectedRatePair = signal<string>('');

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
      isoCode: [
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
      isBaseCurrency: [false],
      status: ['ACTIVE', Validators.required],
    });
  }

  private _buildRateForm(): void {
    this.rateForm = this.fb.group({
      targetCurrencyCode: ['MXN', Validators.required],
      rate: [
        '',
        [
          Validators.required,
          positiveFiniteNumberValidator(),
          maximumDecimalPlacesValidator(6),
        ],
      ],
      effectiveFrom: ['', Validators.required],
      effectiveTo: [''],
      source: ['MANUAL', Validators.required],
      reason: ['', [Validators.required, Validators.maxLength(200), noWhitespaceOnlyValidator()]],
      observations: ['', [Validators.maxLength(400)]],
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // CARGA INICIAL
  // ════════════════════════════════════════════════════════════════════════

  private _loadInitialData(): void {
    this.isLoadingCurrencies.set(true);
    this.ceService
      .getCurrencies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoadingCurrencies.set(false);
          // Seleccionar primera moneda no base por defecto
          const nonBase = this.ceService.currencies().find((c) => !c.isBaseCurrency);
          if (nonBase) {
            this.selectCurrency(nonBase);
          } else if (this.ceService.currencies().length > 0) {
            this.selectCurrency(this.ceService.currencies()[0]);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingCurrencies.set(false);
          this.toast.error('Error al cargar el catálogo de monedas.');
          this.cdr.markForCheck();
        },
      });
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
    this.currencyForm.reset({ decimalPlaces: 2, status: 'ACTIVE', isBaseCurrency: false });
    this.cdr.markForCheck();
  }

  private _patchCurrencyForm(c: Currency): void {
    this.currencyForm.patchValue({
      isoCode: c.isoCode,
      name: c.name,
      symbol: c.symbol,
      decimalPlaces: c.decimalPlaces,
      isBaseCurrency: c.isBaseCurrency,
      status: c.status,
    });
    // ISO code inmutable en edición
    this.currencyForm.get('isoCode')?.disable();
    this.currencyForm.markAsPristine();
  }

  // ════════════════════════════════════════════════════════════════════════
  // VISTAS DEL PANEL
  // ════════════════════════════════════════════════════════════════════════

  protected openRateForm(): void {
    if (!this.selectedCurrency()) return;
    this.panelView.set('RATE_FORM');
    const today = new Date().toISOString().slice(0, 16);
    this.rateForm.reset({ source: 'MANUAL', targetCurrencyCode: 'MXN', effectiveFrom: today });
    this.cdr.markForCheck();
  }

  protected openAudit(): void {
    this.showAuditDrawer.set(true);
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
  // GUARDAR MONEDA
  // ════════════════════════════════════════════════════════════════════════

  protected saveCurrency(): void {
    if (this.currencyForm.invalid || this.isSaving()) return;

    const raw = this.currencyForm.getRawValue();

    // Validación de duplicado ISO
    const isDuplicate = this.ceService.isDuplicateIsoCode(
      raw.isoCode,
      this.selectedCurrency()?.id
    );
    if (isDuplicate) {
      this.toast.error(`El código ISO ${raw.isoCode.toUpperCase()} ya existe en el catálogo.`);
      return;
    }

    if (this.formMode() === 'CREATE') {
      this._doCreateCurrency(raw);
    } else {
      this._doUpdateCurrency(raw);
    }
  }

  private _doCreateCurrency(raw: Record<string, unknown>): void {
    this.isSaving.set(true);

    this.ceService
      .createCurrency({
        organizationId: 'org-4guard-mx-001',
        isoCode: String(raw['isoCode']).toUpperCase(),
        name: String(raw['name']),
        symbol: String(raw['symbol']),
        decimalPlaces: Number(raw['decimalPlaces']),
        isBaseCurrency: Boolean(raw['isBaseCurrency']),
        status: raw['status'] as CurrencyStatus,
        currentRate: Boolean(raw['isBaseCurrency']) ? 1.0 : 0,
        freshnessStatus: 'CURRENT',
        updatedBy: this.currentUserEmail,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message);
          this.selectCurrency(res.data);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err.message ?? 'Error al crear la moneda.');
          this.cdr.markForCheck();
        },
      });
  }

  private _doUpdateCurrency(raw: Record<string, unknown>): void {
    const currency = this.selectedCurrency();
    if (!currency) return;

    this.isSaving.set(true);

    this.ceService
      .updateCurrency(
        currency.id,
        {
          name: String(raw['name']),
          symbol: String(raw['symbol']),
          decimalPlaces: Number(raw['decimalPlaces']),
          status: raw['status'] as CurrencyStatus,
        },
        this.currentUserEmail
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message);
          this.selectedCurrency.set(res.data);
          this.currencyForm.markAsPristine();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err.message ?? 'Error al actualizar la moneda.');
          this.cdr.markForCheck();
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // CAMBIAR ESTADO MONEDA
  // ════════════════════════════════════════════════════════════════════════

  protected toggleCurrencyStatus(currency: Currency): void {
    if (currency.isBaseCurrency) {
      this.toast.error('La moneda base no puede inactivarse.');
      return;
    }

    const newStatus: CurrencyStatus =
      currency.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.confirmModalConfig.set({
      title: `${newStatus === 'INACTIVE' ? 'Inactivar' : 'Activar'} moneda`,
      message: `¿Deseas ${newStatus === 'INACTIVE' ? 'inactivar' : 'activar'} la moneda <strong>${currency.isoCode} — ${currency.name}</strong>?`,
      confirmLabel: newStatus === 'INACTIVE' ? 'Inactivar' : 'Activar',
      action: () => {
        this.ceService
          .toggleCurrencyStatus(currency.id, newStatus, this.currentUserEmail)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.toast.success(res.message);
              // Si es la moneda seleccionada, re-seleccionar
              if (this.selectedCurrency()?.id === currency.id) {
                this.selectedCurrency.set(res.data);
              }
              this.cdr.markForCheck();
            },
            error: (err) => {
              this.toast.error(err.message ?? 'Error al cambiar estado.');
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

    if (raw.targetCurrencyCode === currency.isoCode) {
      this.toast.error('La moneda origen y destino no pueden ser iguales.');
      return;
    }

    this.isSaving.set(true);

    this.ceService
      .createExchangeRate(
        {
          organizationId: 'org-4guard-mx-001',
          sourceCurrencyCode: currency.isoCode,
          targetCurrencyCode: raw.targetCurrencyCode,
          rate: parseFloat(raw.rate),
          effectiveFrom: new Date(raw.effectiveFrom).toISOString(),
          effectiveTo: raw.effectiveTo ? new Date(raw.effectiveTo).toISOString() : null,
          source: raw.source,
          reason: raw.reason,
          observations: raw.observations ?? '',
          createdBy: this.currentUserEmail,
          status: 'CURRENT',
        },
        this.currentUserEmail
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(res.message);
          this.panelView.set('CURRENCY_FORM');
          // Refrescar la moneda seleccionada
          const updated = this.ceService.currencies().find(
            (c) => c.id === this.selectedCurrency()!.id
          );
          if (updated) this.selectedCurrency.set(updated);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err.message ?? 'Error al registrar el tipo de cambio.');
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
  // SIMULADOR
  // ════════════════════════════════════════════════════════════════════════

  protected updateSimAmount(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.simAmount.set(isNaN(val) ? 0 : val);
  }

  protected updateSimSource(event: Event): void {
    this.simSource.set((event.target as HTMLSelectElement).value);
  }

  protected updateSimTarget(event: Event): void {
    this.simTarget.set((event.target as HTMLSelectElement).value);
  }

  protected swapSimCurrencies(): void {
    const src = this.simSource();
    const tgt = this.simTarget();
    this.simSource.set(tgt);
    this.simTarget.set(src);
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
  // UTILIDADES DE TEMPLATE
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

  protected formatDateMX(isoDate: string): string {
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

  protected formatCurrencyAmount(amount: number, code: string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  }

  protected freshnessClass(status: string): string {
    const map: Record<string, string> = {
      CURRENT: 'badge--success',
      REVIEW_REQUIRED: 'badge--warning',
      OUTDATED: 'badge--danger',
    };
    return map[status] ?? 'badge--neutral';
  }

  protected rateStatusClass(status: string): string {
    const map: Record<string, string> = {
      CURRENT: 'badge--success',
      SCHEDULED: 'badge--info',
      HISTORICAL: 'badge--neutral',
    };
    return map[status] ?? 'badge--neutral';
  }

  protected auditActionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Creación',
      UPDATE: 'Modificación',
      ACTIVATE: 'Activación',
      DEACTIVATE: 'Desactivación',
      CHANGE_BASE_CURRENCY: 'Cambio de moneda base',
      CREATE_EXCHANGE_RATE: 'Nuevo tipo de cambio',
    };
    return map[action] ?? action;
  }

  protected auditActionIcon(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'add_circle',
      UPDATE: 'edit',
      ACTIVATE: 'check_circle',
      DEACTIVATE: 'cancel',
      CHANGE_BASE_CURRENCY: 'swap_horiz',
      CREATE_EXCHANGE_RATE: 'currency_exchange',
    };
    return map[action] ?? 'history';
  }

  /** Retorna lista de monedas excepto la seleccionada (para target del tipo de cambio) */
  protected get availableTargetCurrencies(): Currency[] {
    const sel = this.selectedCurrency();
    return this.ceService
      .currencies()
      .filter((c) => c.status === 'ACTIVE' && c.isoCode !== sel?.isoCode);
  }

  /** Verifica si un campo del currencyForm tiene error visible */
  protected cfError(field: string, error: string): boolean {
    const ctrl = this.currencyForm.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }

  /** Verifica si un campo del rateForm tiene error visible */
  protected rfError(field: string, error: string): boolean {
    const ctrl = this.rateForm.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }
}
