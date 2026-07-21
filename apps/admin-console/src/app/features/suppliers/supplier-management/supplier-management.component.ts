/**
 * @file supplier-management.component.ts
 * @description Componente principal de Gestión de Proveedores (HU-125) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE Y DISEÑO
 * ═══════════════════════════════════════════════════════════════════════════
 *  Vista Master-Detail Split View (35/65).
 *  Modos de componente: 'idle' | 'new' | 'edit'.
 *  Usa exclusivamente ReactiveFormsModule (sin FormsModule / ngModel superfluos).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PERMISOS RBAC
 * ═══════════════════════════════════════════════════════════════════════════
 *  Los métodos can*() retornan true durante desarrollo.
 *  TODO: Conectar con AuthService.hasPermission('SUPPLIER_*') al integrar backend.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { SupplierService } from '../services/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Supplier,
  SupplierType,
  SupplierStatus,
  SupplierScope,
  CurrencyCode,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierStatusChangeRequest,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_SCOPE_LABELS,
  CURRENCY_LABELS,
  isServiceSupplier,
  getLeadTimeLabel,
  normalizeCodeOrTaxId,
} from '../models/supplier.model';

// ─── Tipos Internos ───────────────────────────────────────────────────────────

type FormMode = 'idle' | 'new' | 'edit';
type StatusDialogMode = 'none' | 'status_change' | 'archive';

// ─── Validadores Personalizados ───────────────────────────────────────────────

/** Valida que el texto no contenga únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

/** Valida formato de teléfono (7-15 dígitos permitiendo espacios, +, -, parentesis). */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const digitsOnly = control.value.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { invalidPhone: true };
  }
  return null;
}

@Component({
  selector: 'fg-supplier-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './supplier-management.component.html',
  styleUrl: './supplier-management.component.css',
})
export class SupplierManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly supplierService = inject(SupplierService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado del Componente (Signals) ────────────────────────────────────────

  protected readonly selectedSupplier = signal<Supplier | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly statusDialogMode = signal<StatusDialogMode>('none');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);
  protected readonly showUnsavedDialog = signal<boolean>(false);

  private pendingSupplier: Supplier | null = null;
  private pendingAction: 'select' | 'new' | 'cancel' | null = null;

  // ─── Form Controls de Filtro (Reactive) ─────────────────────────────────────

  protected readonly filterSearchCtrl    = new FormControl<string>('');
  protected readonly filterStatusCtrl    = new FormControl<SupplierStatus | ''>('');
  protected readonly filterTypeCtrl      = new FormControl<SupplierType | ''>('');
  protected readonly filterScopeCtrl     = new FormControl<SupplierScope | ''>('');
  protected readonly filterClientCtrl    = new FormControl<string>('');
  protected readonly filterWarehouseCtrl = new FormControl<string>('');
  protected readonly filterPreferredCtrl = new FormControl<boolean>(false);

  // ─── Lista Filtrada (Computed) ──────────────────────────────────────────────

  protected readonly filteredSuppliers = computed(() => {
    let list = this.supplierService.suppliers();
    const search = (this.filterSearchCtrl.value || '').trim().toLowerCase();
    const status = this.filterStatusCtrl.value;
    const type   = this.filterTypeCtrl.value;
    const scope  = this.filterScopeCtrl.value;
    const client = this.filterClientCtrl.value;
    const wh     = this.filterWarehouseCtrl.value;
    const pref   = this.filterPreferredCtrl.value;

    if (search) {
      const normSearch = normalizeCodeOrTaxId(search);
      list = list.filter(s => {
        const matchCode = normalizeCodeOrTaxId(s.code).includes(normSearch);
        const matchTax  = normalizeCodeOrTaxId(s.taxId).includes(normSearch);
        const matchText =
          s.legalName.toLowerCase().includes(search) ||
          (s.commercialName && s.commercialName.toLowerCase().includes(search)) ||
          s.contact.fullName.toLowerCase().includes(search) ||
          s.contact.email.toLowerCase().includes(search) ||
          (s.address && s.address.city.toLowerCase().includes(search));
        return matchCode || matchTax || matchText;
      });
    }

    if (status) list = list.filter(s => s.status === status);
    if (type)   list = list.filter(s => s.type === type);
    if (scope)  list = list.filter(s => s.scopeType === scope);
    if (client) list = list.filter(s => s.clientId === client || (s.clientName && s.clientName.toLowerCase().includes(client.toLowerCase())));
    if (wh)     list = list.filter(s => s.warehouseId === wh || (s.warehouseName && s.warehouseName.toLowerCase().includes(wh.toLowerCase())));
    if (pref)   list = list.filter(s => s.preferred);

    return list;
  });

  // ─── Tarjetas KPI de Cabecera (Computed) ───────────────────────────────────

  protected readonly totalCount       = computed(() => this.supplierService.totalActiveCount());
  protected readonly activeCount      = computed(() => this.supplierService.activeCount());
  protected readonly unavailableCount = computed(() => this.supplierService.unavailableCount());
  protected readonly preferredCount   = computed(() => this.supplierService.preferredCount());

  // ─── Formulario Reactivo CRUD ───────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    // Sección 1 — Información General
    code:           ['', [Validators.maxLength(30)]],
    legalName:      ['', [Validators.required, Validators.maxLength(200), noWhitespaceValidator]],
    commercialName: ['', [Validators.maxLength(150)]],
    taxId:          ['', [Validators.required, Validators.maxLength(20), noWhitespaceValidator]],
    type:           ['GOODS', [Validators.required]],
    status:         ['ACTIVE', [Validators.required]],
    statusReason:   ['', [Validators.maxLength(300)]],
    preferred:      [false],
    notes:          ['', [Validators.maxLength(1000)]],

    // Sección 3 — Contacto Principal
    contactFullName: ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    contactJobTitle: ['', [Validators.maxLength(100)]],
    contactEmail:    ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    contactPhone:    ['', [Validators.required, phoneValidator]],
    contactAltPhone: ['', [phoneValidator]],

    // Sección 4 — Dirección
    addressCountry:        ['México', [Validators.required]],
    addressState:          ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    addressMunicipality:   ['', [Validators.maxLength(100)]],
    addressCity:           ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    addressPostalCode:     ['', [Validators.maxLength(10)]],
    addressStreet:         ['', [Validators.maxLength(200)]],
    addressExteriorNumber: ['', [Validators.maxLength(20)]],
    addressInteriorNumber: ['', [Validators.maxLength(20)]],

    // Sección 5 — Condiciones Operativas
    leadTimeDays:              [1, [Validators.required, Validators.min(0)]],
    minimumOrderAmount:        [0, [Validators.required, Validators.min(0)]],
    creditDays:                [0, [Validators.required, Validators.min(0)]],
    currency:                  ['MXN', [Validators.required]],
    qualityInspectionRequired: [false],

    // Sección 6 — Alcance 3PL
    scopeType:   ['GLOBAL', [Validators.required]],
    clientId:    [''],
    clientName:  [''],
    warehouseId: [''],
    warehouseName: [''],
  });

  // ─── Diálogo de Cambio de Estado / Archivo ─────────────────────────────────

  protected readonly statusDialogForm: FormGroup = this.fb.group({
    targetStatus: ['INACTIVE', [Validators.required]],
    reason:       ['', [Validators.required, Validators.maxLength(400), noWhitespaceValidator]],
  });

  // ─── Catálogos para Selects ──────────────────────────────────────────────────

  protected readonly supplierTypes: { value: SupplierType; label: string }[] = [
    { value: 'GOODS',            label: SUPPLIER_TYPE_LABELS['GOODS'] },
    { value: 'RAW_MATERIAL',     label: SUPPLIER_TYPE_LABELS['RAW_MATERIAL'] },
    { value: 'PACKAGING',        label: SUPPLIER_TYPE_LABELS['PACKAGING'] },
    { value: 'PALLETS',          label: SUPPLIER_TYPE_LABELS['PALLETS'] },
    { value: 'SPARE_PARTS',      label: SUPPLIER_TYPE_LABELS['SPARE_PARTS'] },
    { value: 'TRANSPORT',        label: SUPPLIER_TYPE_LABELS['TRANSPORT'] },
    { value: 'MAINTENANCE',      label: SUPPLIER_TYPE_LABELS['MAINTENANCE'] },
    { value: 'CLEANING',         label: SUPPLIER_TYPE_LABELS['CLEANING'] },
    { value: 'SECURITY',         label: SUPPLIER_TYPE_LABELS['SECURITY'] },
    { value: 'PEST_CONTROL',     label: SUPPLIER_TYPE_LABELS['PEST_CONTROL'] },
    { value: 'TECHNOLOGY',       label: SUPPLIER_TYPE_LABELS['TECHNOLOGY'] },
    { value: 'GENERAL_SERVICES', label: SUPPLIER_TYPE_LABELS['GENERAL_SERVICES'] },
    { value: 'OTHER',            label: SUPPLIER_TYPE_LABELS['OTHER'] },
  ];

  protected readonly supplierScopes: { value: SupplierScope; label: string }[] = [
    { value: 'GLOBAL',    label: SUPPLIER_SCOPE_LABELS['GLOBAL'] },
    { value: 'CLIENT',    label: SUPPLIER_SCOPE_LABELS['CLIENT'] },
    { value: 'WAREHOUSE', label: SUPPLIER_SCOPE_LABELS['WAREHOUSE'] },
  ];

  protected readonly currencies: { value: CurrencyCode; label: string }[] = [
    { value: 'MXN', label: CURRENCY_LABELS['MXN'] },
    { value: 'USD', label: CURRENCY_LABELS['USD'] },
    { value: 'EUR', label: CURRENCY_LABELS['EUR'] },
  ];

  protected readonly mockClients = [
    { id: 'cli-01', name: 'Lala S.A.' },
    { id: 'cli-02', name: 'Nestlé México' },
    { id: 'cli-03', name: 'Bimbo de México' },
  ];

  protected readonly mockWarehouses = [
    { id: 'WH-4GUARD-001', name: '4GUARD — Almacén Principal Toluca' },
    { id: 'WH-4GUARD-002', name: '4GUARD — Almacén Apodaca NL' },
  ];

  protected readonly supplierStatusLabels = SUPPLIER_STATUS_LABELS;
  protected readonly supplierTypeLabels   = SUPPLIER_TYPE_LABELS;
  protected readonly supplierScopeLabels  = SUPPLIER_SCOPE_LABELS;

  // ─── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSuppliers();
    this.setupScopeReactivity();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de Datos ─────────────────────────────────────────────────────────

  protected loadSuppliers(): void {
    this.supplierService.loadSuppliers().pipe(takeUntil(this.destroy$)).subscribe({
      error: (err: HttpErrorResponse) => {
        const msg = err?.error?.message || err?.message || 'Error al cargar el catálogo de proveedores.';
        this.supplierService.loadError.set(msg);
      },
    });
  }

  // ─── Reactividad de Alcance 3PL ──────────────────────────────────────────────

  private setupScopeReactivity(): void {
    this.form.get('scopeType')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((scope: SupplierScope) => {
      const clientCtrl = this.form.get('clientId');
      const whCtrl     = this.form.get('warehouseId');

      if (scope === 'CLIENT') {
        clientCtrl?.setValidators([Validators.required]);
        whCtrl?.clearValidators();
        whCtrl?.setValue('');
      } else if (scope === 'WAREHOUSE') {
        whCtrl?.setValidators([Validators.required]);
        clientCtrl?.clearValidators();
        clientCtrl?.setValue('');
      } else {
        clientCtrl?.clearValidators();
        whCtrl?.clearValidators();
        clientCtrl?.setValue('');
        whCtrl?.setValue('');
      }

      clientCtrl?.updateValueAndValidity();
      whCtrl?.updateValueAndValidity();
    });
  }

  // ─── Filtros Reactivos ───────────────────────────────────────────────────────

  protected clearFilters(): void {
    this.filterSearchCtrl.setValue('');
    this.filterStatusCtrl.setValue('');
    this.filterTypeCtrl.setValue('');
    this.filterScopeCtrl.setValue('');
    this.filterClientCtrl.setValue('');
    this.filterWarehouseCtrl.setValue('');
    this.filterPreferredCtrl.setValue(false);
  }

  protected get hasActiveFilters(): boolean {
    return !!(
      this.filterSearchCtrl.value ||
      this.filterStatusCtrl.value ||
      this.filterTypeCtrl.value ||
      this.filterScopeCtrl.value ||
      this.filterClientCtrl.value ||
      this.filterWarehouseCtrl.value ||
      this.filterPreferredCtrl.value
    );
  }

  // ─── Manejo de Cambios no Guardados ─────────────────────────────────────────

  private checkUnsavedChanges(action: 'select' | 'new' | 'cancel', supplier?: Supplier): boolean {
    if (this.form.dirty && this.formMode() !== 'idle') {
      this.pendingSupplier = supplier ?? null;
      this.pendingAction = action;
      this.showUnsavedDialog.set(true);
      return true;
    }
    return false;
  }

  protected confirmDiscardChanges(): void {
    this.showUnsavedDialog.set(false);
    const action = this.pendingAction;
    const supplier = this.pendingSupplier;
    this.pendingAction = null;
    this.pendingSupplier = null;

    this.form.markAsPristine();

    if (action === 'select' && supplier) {
      this.selectSupplier(supplier);
    } else if (action === 'new') {
      this.startNewSupplier();
    } else if (action === 'cancel') {
      this.cancelForm();
    }
  }

  protected cancelDiscardChanges(): void {
    this.showUnsavedDialog.set(false);
    this.pendingAction = null;
    this.pendingSupplier = null;
  }

  // ─── Selección y Modos ──────────────────────────────────────────────────────

  protected selectSupplier(supplier: Supplier): void {
    if (this.checkUnsavedChanges('select', supplier)) return;
    this.selectedSupplier.set(supplier);
    this.formMode.set('edit');
    this.populateForm(supplier);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  protected startNewSupplier(): void {
    if (this.checkUnsavedChanges('new')) return;
    this.selectedSupplier.set(null);
    this.formMode.set('new');
    this.form.reset({
      code: `PRV-${String(this.supplierService.suppliers().length + 1).padStart(4, '0')}`,
      type: 'GOODS',
      status: 'ACTIVE',
      preferred: false,
      addressCountry: 'México',
      leadTimeDays: 1,
      minimumOrderAmount: 0,
      creditDays: 0,
      currency: 'MXN',
      qualityInspectionRequired: false,
      scopeType: 'GLOBAL',
    });
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    if (this.checkUnsavedChanges('cancel')) return;
    const current = this.selectedSupplier();
    if (current) {
      this.formMode.set('edit');
      this.populateForm(current);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  // ─── Poblar Formulario ──────────────────────────────────────────────────────

  private populateForm(s: Supplier): void {
    this.form.patchValue({
      code:           s.code,
      legalName:      s.legalName,
      commercialName: s.commercialName || '',
      taxId:          s.taxId,
      type:           s.type,
      status:         s.status,
      statusReason:   s.statusReason || '',
      preferred:      s.preferred,
      notes:          s.notes || '',

      contactFullName: s.contact.fullName,
      contactJobTitle: s.contact.jobTitle || '',
      contactEmail:    s.contact.email,
      contactPhone:    s.contact.phone,
      contactAltPhone: s.contact.altPhone || '',

      addressCountry:        s.address?.country || 'México',
      addressState:          s.address?.state || '',
      addressMunicipality:   s.address?.municipality || '',
      addressCity:           s.address?.city || '',
      addressPostalCode:     s.address?.postalCode || '',
      addressStreet:         s.address?.street || '',
      addressExteriorNumber: s.address?.exteriorNumber || '',
      addressInteriorNumber: s.address?.interiorNumber || '',

      leadTimeDays:              s.commercialTerms.leadTimeDays,
      minimumOrderAmount:        s.commercialTerms.minimumOrderAmount,
      creditDays:                s.commercialTerms.creditDays,
      currency:                  s.commercialTerms.currency,
      qualityInspectionRequired: s.commercialTerms.qualityInspectionRequired,

      scopeType:     s.scopeType,
      clientId:      s.clientId || '',
      clientName:    s.clientName || '',
      warehouseId:   s.warehouseId || '',
      warehouseName: s.warehouseName || '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Helpers del Template ───────────────────────────────────────────────────

  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])       return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No se permiten únicamente espacios en blanco.';
    if (ctrl.errors['maxlength'])      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['min'])            return `El valor mínimo es ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['email'])          return 'Ingresa un correo electrónico válido.';
    if (ctrl.errors['invalidPhone'])   return 'El teléfono debe contener entre 7 y 15 dígitos.';
    return 'Campo inválido.';
  }

  protected get currentType(): SupplierType {
    return this.form.get('type')?.value || 'GOODS';
  }

  protected get leadTimeFieldLabel(): string {
    return getLeadTimeLabel(this.currentType);
  }

  protected get isServiceType(): boolean {
    return isServiceSupplier(this.currentType);
  }

  protected get currentScope(): SupplierScope {
    return this.form.get('scopeType')?.value || 'GLOBAL';
  }

  /** Normaliza iniciales del proveedor para el avatar. */
  protected getInitials(s: Supplier): string {
    const name = s.commercialName || s.legalName;
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'PR';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // ─── Guardar (Create / Update) ──────────────────────────────────────────────

  protected saveSupplier(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) return;

    const raw = this.form.getRawValue();

    // Normalizar Tax ID y Código
    const normalizedTaxId = normalizeCodeOrTaxId(raw.taxId);
    const normalizedCode  = normalizeCodeOrTaxId(raw.code);
    const excludeId = this.formMode() === 'edit' ? this.selectedSupplier()?.id : undefined;

    // Duplicados Preventivos Local
    if (this.supplierService.isTaxIdDuplicate(normalizedTaxId, excludeId)) {
      this.backendError.set(`El RFC / Tax ID "${normalizedTaxId}" ya se encuentra registrado para otro proveedor.`);
      return;
    }

    if (normalizedCode && this.supplierService.isCodeDuplicate(normalizedCode, excludeId)) {
      this.backendError.set(`El código de proveedor "${normalizedCode}" ya está asignado.`);
      return;
    }

    // Limpieza de Scope 3PL
    let scopeClientId: string | undefined = undefined;
    let scopeClientName: string | undefined = undefined;
    let scopeWarehouseId: string | undefined = undefined;
    let scopeWarehouseName: string | undefined = undefined;

    if (raw.scopeType === 'CLIENT') {
      scopeClientId = raw.clientId;
      const foundClient = this.mockClients.find(c => c.id === raw.clientId);
      scopeClientName = foundClient ? foundClient.name : raw.clientName;
    } else if (raw.scopeType === 'WAREHOUSE') {
      scopeWarehouseId = raw.warehouseId;
      const foundWh = this.mockWarehouses.find(w => w.id === raw.warehouseId);
      scopeWarehouseName = foundWh ? foundWh.name : raw.warehouseName;
    }

    const dto: CreateSupplierRequest = {
      code:           normalizedCode,
      legalName:      raw.legalName.trim(),
      commercialName: raw.commercialName?.trim() || undefined,
      taxId:          normalizedTaxId,
      type:           raw.type,
      status:         raw.status,
      statusReason:   raw.statusReason?.trim() || undefined,
      preferred:      !!raw.preferred,
      notes:          raw.notes?.trim() || undefined,

      contact: {
        fullName: raw.contactFullName.trim(),
        jobTitle: raw.contactJobTitle?.trim() || undefined,
        email:    raw.contactEmail.trim().toLowerCase(),
        phone:    raw.contactPhone.trim(),
        altPhone: raw.contactAltPhone?.trim() || undefined,
      },

      address: {
        country:        raw.addressCountry.trim(),
        state:          raw.addressState.trim(),
        municipality:   raw.addressMunicipality?.trim() || undefined,
        city:           raw.addressCity.trim(),
        postalCode:     raw.addressPostalCode?.trim() || undefined,
        street:         raw.addressStreet?.trim() || undefined,
        exteriorNumber: raw.addressExteriorNumber?.trim() || undefined,
        interiorNumber: raw.addressInteriorNumber?.trim() || undefined,
      },

      commercialTerms: {
        leadTimeDays:              Number(raw.leadTimeDays),
        minimumOrderAmount:        Number(raw.minimumOrderAmount),
        creditDays:                Number(raw.creditDays),
        currency:                  raw.currency,
        qualityInspectionRequired: !!raw.qualityInspectionRequired,
      },

      scopeType:     raw.scopeType,
      clientId:      scopeClientId,
      clientName:    scopeClientName,
      warehouseId:   scopeWarehouseId,
      warehouseName: scopeWarehouseName,
    };

    const mode = this.formMode();

    if (mode === 'new') {
      this.supplierService.createSupplier(dto).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          this.selectedSupplier.set(res.data);
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedSupplier()) {
      const updateDto: UpdateSupplierRequest = dto;
      this.supplierService.updateSupplier(this.selectedSupplier()!.id, updateDto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.saveSuccess.set(true);
            this.selectedSupplier.set(res.data);
            this.submitAttempted.set(false);
            this.form.markAsPristine();
            setTimeout(() => this.saveSuccess.set(false), 3500);
          },
          error: (err: HttpErrorResponse) => this.handleBackendError(err),
        });
    }
  }

  // ─── Diálogos de Cambio de Estado y Archivo ────────────────────────────────

  protected openStatusDialog(mode: 'status_change' | 'archive'): void {
    this.statusDialogMode.set(mode);
    this.statusDialogForm.reset({
      targetStatus: this.selectedSupplier()?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      reason: '',
    });
  }

  protected closeStatusDialog(): void {
    this.statusDialogMode.set('none');
    this.statusDialogForm.reset();
  }

  protected confirmStatusChange(): void {
    if (this.statusDialogForm.invalid) {
      this.statusDialogForm.markAllAsTouched();
      return;
    }

    const current = this.selectedSupplier();
    if (!current) return;

    const dto: SupplierStatusChangeRequest = {
      status: this.statusDialogForm.value.targetStatus,
      reason: this.statusDialogForm.value.reason.trim(),
    };

    this.supplierService.changeSupplierStatus(current.id, dto).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.selectedSupplier.set(res.data);
        this.populateForm(res.data);
        this.closeStatusDialog();
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3500);
      },
      error: (err: HttpErrorResponse) => {
        this.handleBackendError(err);
        this.closeStatusDialog();
      },
    });
  }

  protected confirmArchive(): void {
    const current = this.selectedSupplier();
    if (!current) return;

    this.supplierService.archiveSupplier(current.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeStatusDialog();
        this.selectedSupplier.set(null);
        this.formMode.set('idle');
        this.form.reset();
        this.form.markAsPristine();
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3500);
      },
      error: (err: HttpErrorResponse) => {
        this.handleBackendError(err);
        this.closeStatusDialog();
      },
    });
  }

  // ─── Manejo de Errores del Backend (409 Conflict) ─────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      this.backendError.set(serverMsg || 'Conflicto de duplicidad: El RFC / Tax ID o Código de proveedor ya existe en el sistema.');
    } else if (status === 404) {
      this.backendError.set('Proveedor no encontrado. Es posible que haya sido archivado por otro usuario.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Verifica los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Permisos RBAC Placeholders ─────────────────────────────────────────────

  protected canCreate():     boolean { /* return this.authService.hasPermission('SUPPLIER_CREATE');     */ return true; }
  protected canUpdate():     boolean { /* return this.authService.hasPermission('SUPPLIER_UPDATE');     */ return true; }
  protected canDeactivate(): boolean { /* return this.authService.hasPermission('SUPPLIER_DEACTIVATE'); */ return true; }
  protected canDelete():     boolean { /* return this.authService.hasPermission('SUPPLIER_DELETE');     */ return true; }

  // ─── Helpers de Estado Visual ───────────────────────────────────────────────

  protected isSelectedSupplier(s: Supplier): boolean {
    return this.selectedSupplier()?.id === s.id;
  }

  protected getStatusBadgeClass(status: SupplierStatus): string {
    const map: Record<SupplierStatus, string> = {
      ACTIVE:   'supplier-badge--active',
      INACTIVE: 'supplier-badge--inactive',
      BLOCKED:  'supplier-badge--blocked',
    };
    return map[status] ?? 'supplier-badge--inactive';
  }

  protected get isFormDirty(): boolean   { return this.form.dirty; }
  protected get isSaving():    boolean   { return this.supplierService.saving(); }
  protected get isLoading():   boolean   { return this.supplierService.loading(); }
  protected get hasLoadError(): boolean  { return !!this.supplierService.loadError(); }
  protected get loadErrorMessage(): string { return this.supplierService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.supplierService.suppliers().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.supplierService.suppliers().length > 0 &&
      this.filteredSuppliers().length === 0
    );
  }
}
