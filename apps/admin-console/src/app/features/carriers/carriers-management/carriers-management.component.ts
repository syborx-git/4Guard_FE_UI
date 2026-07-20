/**
 * @file carriers-management.component.ts
 * @description Componente principal de Gestión de Transportistas (HU-128) — 4GUARD WMS.
 *
 * Implementa la vista Master-Detail (Split View 35/65) para el catálogo
 * maestro de empresas transportistas.
 *
 * ALCANCE: Solo gestión del catálogo. NO incluye operadores, unidades,
 * check-in de camiones, asignación de rampas ni control de patio.
 *
 * PERMISOS RBAC:
 *  Los permisos se verifican llamando a AuthService.hasPermission('CARRIER_XXX').
 *  TODO: Conectar con el servicio de autorización real cuando los permisos
 *  CARRIER_* estén registrados en el backend.
 *  Por ahora, los métodos `can*` retornan true para facilitar el desarrollo.
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
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { CarrierService } from '../services/carrier.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Carrier,
  CarrierType,
  CarrierStatus,
  CarrierStatusChangeRequest,
  ServiceType,
  VehicleCapabilityType,
  CarrierFilters,
  CARRIER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  VEHICLE_CAPABILITY_LABELS,
  CARRIER_STATUS_LABELS,
  CreateCarrierRequest,
  UpdateCarrierRequest,
} from '../models/carrier.model';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type FormMode = 'idle' | 'new' | 'edit';
type StatusDialogMode = 'none' | 'suspend' | 'deactivate';

// ─── Validadores personalizados ───────────────────────────────────────────────

/** Valida que el RFC tenga formato válido mexicano (personas morales o físicas). */
function rfcValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  // RFC México: Personas morales (12 chars) y físicas (13 chars)
  const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
  return rfcPattern.test(control.value.trim()) ? null : { invalidRfc: true };
}

/** Valida que el teléfono tenga entre 7 y 15 dígitos (puede incluir + y guiones). */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const phonePattern = /^[+\d\s\-().]{7,20}$/;
  const digitsOnly = control.value.replace(/\D/g, '');
  if (!phonePattern.test(control.value) || digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { invalidPhone: true };
  }
  return null;
}

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-carriers-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './carriers-management.component.html',
  styleUrl: './carriers-management.component.css',
})
export class CarriersManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly carrierService = inject(CarrierService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la vista ──────────────────────────────────────────────────────

  protected readonly selectedCarrier = signal<Carrier | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly statusDialogMode = signal<StatusDialogMode>('none');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Filtros del directorio ──────────────────────────────────────────────────

  protected filterText = '';
  protected filterStatus: CarrierStatus | '' = '';
  protected filterType: CarrierType | '' = '';

  // ─── Lista filtrada (computed) ───────────────────────────────────────────────

  protected readonly filteredCarriers = computed(() => {
    let list = this.carrierService.carriers();
    const search = this.filterText.toLowerCase().trim();

    if (search) {
      list = list.filter(
        (c) =>
          c.businessName.toLowerCase().includes(search) ||
          c.tradeName.toLowerCase().includes(search) ||
          c.rfc.toLowerCase().includes(search)
      );
    }

    if (this.filterStatus) {
      list = list.filter((c) => c.status === this.filterStatus);
    }

    if (this.filterType) {
      list = list.filter((c) => c.carrierType === this.filterType);
    }

    return list;
  });

  // ─── Formulario reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    // Sección 1 — Información General
    businessName: ['', [Validators.required, Validators.maxLength(200), noWhitespaceValidator]],
    tradeName:    ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    rfc:          ['', [Validators.required, Validators.maxLength(13), rfcValidator]],
    carrierType:  ['', Validators.required],
    status:       ['ACTIVE', Validators.required],

    // Sección 2 — Contacto Principal
    contactName:  ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    phone:        ['', [Validators.required, phoneValidator]],
    email:        ['', [Validators.required, Validators.email, Validators.maxLength(150)]],

    // Sección 3 — Información Operativa
    serviceType:  ['', Validators.required],
    coverage:     ['', [Validators.required, Validators.maxLength(300), noWhitespaceValidator]],
    permitNumber: ['', Validators.maxLength(80)],
    notes:        ['', Validators.maxLength(1000)],
  });

  /** Capacidades de vehículos seleccionadas (manejadas por separado como array). */
  protected selectedVehicleTypes = new Set<VehicleCapabilityType>();

  /** Formulario del diálogo de cambio de estado. */
  protected readonly statusDialogForm: FormGroup = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(500), noWhitespaceValidator]],
    notes:  ['', Validators.maxLength(500)],
  });

  // ─── Datos de catálogo para los selects ─────────────────────────────────────

  protected readonly carrierTypes: { value: CarrierType; label: string }[] = [
    { value: 'EXTERNAL',        label: CARRIER_TYPE_LABELS['EXTERNAL'] },
    { value: 'CLIENT_TRANSPORT',label: CARRIER_TYPE_LABELS['CLIENT_TRANSPORT'] },
    { value: 'OWN_TRANSPORT',   label: CARRIER_TYPE_LABELS['OWN_TRANSPORT'] },
    { value: 'THIRD_PARTY_3PL', label: CARRIER_TYPE_LABELS['THIRD_PARTY_3PL'] },
    { value: 'PARCEL',          label: CARRIER_TYPE_LABELS['PARCEL'] },
  ];

  protected readonly serviceTypes: { value: ServiceType; label: string }[] = [
    { value: 'FTL',        label: SERVICE_TYPE_LABELS['FTL'] },
    { value: 'LTL',        label: SERVICE_TYPE_LABELS['LTL'] },
    { value: 'PARCEL',     label: SERVICE_TYPE_LABELS['PARCEL'] },
    { value: 'INTERMODAL', label: SERVICE_TYPE_LABELS['INTERMODAL'] },
    { value: 'LAST_MILE',  label: SERVICE_TYPE_LABELS['LAST_MILE'] },
    { value: 'DEDICATED',  label: SERVICE_TYPE_LABELS['DEDICATED'] },
  ];

  protected readonly vehicleCapabilities: { value: VehicleCapabilityType; label: string }[] = [
    { value: 'DRY_BOX',          label: VEHICLE_CAPABILITY_LABELS['DRY_BOX'] },
    { value: 'REFRIGERATED_BOX', label: VEHICLE_CAPABILITY_LABELS['REFRIGERATED_BOX'] },
    { value: 'FLATBED',          label: VEHICLE_CAPABILITY_LABELS['FLATBED'] },
    { value: 'TORTON',           label: VEHICLE_CAPABILITY_LABELS['TORTON'] },
    { value: 'RABON',            label: VEHICLE_CAPABILITY_LABELS['RABON'] },
    { value: 'TRACTOR_TRAILER',  label: VEHICLE_CAPABILITY_LABELS['TRACTOR_TRAILER'] },
    { value: 'VAN',              label: VEHICLE_CAPABILITY_LABELS['VAN'] },
    { value: 'MOTORCYCLE',       label: VEHICLE_CAPABILITY_LABELS['MOTORCYCLE'] },
  ];

  protected readonly carrierStatusLabels = CARRIER_STATUS_LABELS;
  protected readonly carrierTypeLabels = CARRIER_TYPE_LABELS;
  protected readonly serviceTypeLabels = SERVICE_TYPE_LABELS;
  protected readonly vehicleCapabilityLabels = VEHICLE_CAPABILITY_LABELS;

  // ─── Ciclo de vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadCarriers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga del directorio ────────────────────────────────────────────────────

  protected loadCarriers(): void {
    this.carrierService.loadCarriers().pipe(takeUntil(this.destroy$)).subscribe({
      error: (err: HttpErrorResponse) => {
        const msg = err?.error?.message || err?.message || 'Error al cargar los transportistas.';
        this.carrierService['loadError'].set(msg);
      },
    });
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  protected onFilterChange(): void {
    // El filtro se recalcula automáticamente via computed (filteredCarriers)
    // Solo necesitamos forzar la detección de cambios actualizando una signal
    // cuando cambian las propiedades mutable filterText/filterStatus/filterType.
    this.carrierService.carriers.update(list => [...list]);
  }

  protected clearFilters(): void {
    this.filterText = '';
    this.filterStatus = '';
    this.filterType = '';
    this.onFilterChange();
  }

  // ─── Selección del directorio ─────────────────────────────────────────────────

  protected selectCarrier(carrier: Carrier): void {
    this.selectedCarrier.set(carrier);
    this.formMode.set('edit');
    this.populateForm(carrier);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  protected startNewCarrier(): void {
    this.selectedCarrier.set(null);
    this.formMode.set('new');
    this.form.reset({ status: 'ACTIVE' });
    this.selectedVehicleTypes.clear();
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    const carrier = this.selectedCarrier();
    if (carrier) {
      this.formMode.set('edit');
      this.populateForm(carrier);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  // ─── Helpers de formulario ────────────────────────────────────────────────────

  private populateForm(carrier: Carrier): void {
    this.form.patchValue({
      businessName: carrier.businessName,
      tradeName:    carrier.tradeName,
      rfc:          carrier.rfc,
      carrierType:  carrier.carrierType,
      status:       carrier.status,
      contactName:  carrier.contactName,
      phone:        carrier.phone,
      email:        carrier.email,
      serviceType:  carrier.serviceType,
      coverage:     carrier.coverage,
      permitNumber: carrier.permitNumber || '',
      notes:        carrier.notes || '',
    });
    this.selectedVehicleTypes = new Set(carrier.supportedVehicleTypes);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected toggleVehicleType(type: VehicleCapabilityType): void {
    if (this.selectedVehicleTypes.has(type)) {
      this.selectedVehicleTypes.delete(type);
    } else {
      this.selectedVehicleTypes.add(type);
    }
  }

  protected isVehicleTypeSelected(type: VehicleCapabilityType): boolean {
    return this.selectedVehicleTypes.has(type);
  }

  /** Helper para obtener las iniciales del nombre comercial (avatar). */
  protected getInitials(carrier: Carrier): string {
    const words = carrier.tradeName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /** Helper para obtener la clase CSS del avatar según tipo de transportista. */
  protected getAvatarClass(type: CarrierType): string {
    const map: Record<CarrierType, string> = {
      EXTERNAL:        'avatar--external',
      CLIENT_TRANSPORT:'avatar--client',
      OWN_TRANSPORT:   'avatar--own',
      THIRD_PARTY_3PL: 'avatar--3pl',
      PARCEL:          'avatar--parcel',
    };
    return map[type] ?? 'avatar--external';
  }

  /** Verifica si un campo del formulario principal tiene errores visibles. */
  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  /** Retorna el primer mensaje de error de un campo. */
  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])      return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength'])      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['email'])          return 'Ingresa un correo electrónico válido.';
    if (ctrl.errors['invalidRfc'])     return 'El RFC no tiene un formato válido.';
    if (ctrl.errors['invalidPhone'])   return 'El teléfono debe tener entre 7 y 15 dígitos.';
    return 'Campo inválido.';
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────────

  protected saveCarrier(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const dto: CreateCarrierRequest = {
      businessName:          raw.businessName.trim(),
      tradeName:             raw.tradeName.trim(),
      rfc:                   raw.rfc.trim().toUpperCase(),
      carrierType:           raw.carrierType,
      status:                raw.status,
      contactName:           raw.contactName.trim(),
      phone:                 raw.phone.trim(),
      email:                 raw.email.trim().toLowerCase(),
      serviceType:           raw.serviceType,
      coverage:              raw.coverage.trim(),
      supportedVehicleTypes: Array.from(this.selectedVehicleTypes),
      permitNumber:          raw.permitNumber?.trim() || undefined,
      notes:                 raw.notes?.trim() || undefined,
    };

    const mode = this.formMode();

    if (mode === 'new') {
      this.carrierService.createCarrier(dto).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          this.selectedCarrier.set(res.data);
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedCarrier()) {
      const updateDto: UpdateCarrierRequest = dto;
      this.carrierService.updateCarrier(this.selectedCarrier()!.id, updateDto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.saveSuccess.set(true);
            this.selectedCarrier.set(res.data);
            this.submitAttempted.set(false);
            this.form.markAsPristine();
            setTimeout(() => this.saveSuccess.set(false), 3000);
          },
          error: (err: HttpErrorResponse) => this.handleBackendError(err),
        });
    }
  }

  // ─── Cambio de estado ────────────────────────────────────────────────────────

  protected openStatusDialog(mode: 'suspend' | 'deactivate'): void {
    this.statusDialogMode.set(mode);
    this.statusDialogForm.reset();
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

    const mode = this.statusDialogMode();
    const carrierId = this.selectedCarrier()?.id;
    if (!carrierId || mode === 'none') return;

    const newStatus: CarrierStatus = mode === 'suspend' ? 'SUSPENDED' : 'INACTIVE';
    const dto: CarrierStatusChangeRequest = {
      status: newStatus,
      reason: this.statusDialogForm.value.reason.trim(),
      notes: this.statusDialogForm.value.notes?.trim() || undefined,
    };

    this.carrierService.changeCarrierStatus(carrierId, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedCarrier.set(res.data);
          this.populateForm(res.data);
          this.closeStatusDialog();
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => {
          this.handleBackendError(err);
          this.closeStatusDialog();
        },
      });
  }

  protected activateCarrier(): void {
    const carrierId = this.selectedCarrier()?.id;
    if (!carrierId) return;

    const dto: CarrierStatusChangeRequest = {
      status: 'ACTIVE',
      reason: 'Reactivación manual por operador.',
    };

    this.carrierService.changeCarrierStatus(carrierId, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedCarrier.set(res.data);
          this.populateForm(res.data);
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
  }

  // ─── Manejo de errores del backend ───────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    // Errores específicos que el backend puede retornar:
    if (status === 409) {
      if (serverMsg?.toLowerCase().includes('rfc')) {
        this.backendError.set('El RFC ingresado ya está registrado para otro transportista.');
      } else if (serverMsg?.toLowerCase().includes('razón social') || serverMsg?.toLowerCase().includes('business')) {
        this.backendError.set('La razón social ingresada ya existe en el sistema.');
      } else if (serverMsg?.toLowerCase().includes('version') || serverMsg?.toLowerCase().includes('modificado')) {
        this.backendError.set('El registro fue modificado por otro usuario. Recarga la página y vuelve a intentarlo.');
      } else {
        this.backendError.set(serverMsg || 'Conflicto al guardar. Verifica los datos ingresados.');
      }
    } else if (status === 404) {
      this.backendError.set('Transportista no encontrado. Es posible que haya sido eliminado.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Revisa los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Permisos RBAC ───────────────────────────────────────────────────────────
  //
  // TODO: Conectar con el servicio de autorización cuando los permisos
  // CARRIER_* estén registrados en el backend y en el JWT del usuario.
  //
  // Patrón a usar:
  //   this.authService.hasPermission('CARRIER_CREATE')
  //   this.authService.hasPermission('CARRIER_UPDATE')
  //   this.authService.hasPermission('CARRIER_SUSPEND')
  //   this.authService.hasPermission('CARRIER_DISABLE')
  //   this.authService.hasPermission('CARRIER_AUDIT_VIEW')
  //
  // Por ahora retornan true para facilitar el desarrollo.

  protected canCreate(): boolean {
    // TODO: return this.authService.hasPermission('CARRIER_CREATE');
    return true;
  }

  protected canUpdate(): boolean {
    // TODO: return this.authService.hasPermission('CARRIER_UPDATE');
    return true;
  }

  protected canSuspend(): boolean {
    // TODO: return this.authService.hasPermission('CARRIER_SUSPEND');
    return true;
  }

  protected canDisable(): boolean {
    // TODO: return this.authService.hasPermission('CARRIER_DISABLE');
    return true;
  }

  protected canViewAudit(): boolean {
    // TODO: return this.authService.hasPermission('CARRIER_AUDIT_VIEW');
    return true;
  }

  // ─── Helpers de plantilla ────────────────────────────────────────────────────

  protected isSelectedCarrier(carrier: Carrier): boolean {
    return this.selectedCarrier()?.id === carrier.id;
  }

  protected get dialogTitle(): string {
    return this.statusDialogMode() === 'suspend'
      ? 'Suspender transportista'
      : 'Desactivar transportista';
  }

  protected get dialogDescription(): string {
    const name = this.selectedCarrier()?.tradeName ?? '';
    if (this.statusDialogMode() === 'suspend') {
      return `"${name}" quedará suspendido temporalmente. No aparecerá disponible en nuevas programaciones.`;
    }
    return `"${name}" quedará desactivado. Se conservará el historial para trazabilidad, pero no podrá usarse en nuevas operaciones.`;
  }

  protected get isFormDirty(): boolean {
    return this.form.dirty;
  }

  protected get isSaving(): boolean {
    return this.carrierService.saving();
  }

  protected get isLoading(): boolean {
    return this.carrierService.loading();
  }

  protected get hasLoadError(): boolean {
    return !!this.carrierService['loadError']?.();
  }

  protected get loadErrorMessage(): string {
    return this.carrierService['loadError']?.() ?? '';
  }

  protected get totalCarriers(): number {
    return this.carrierService.carriers().length;
  }

  /** Retorna true si no hay transportistas registrados (lista vacía, sin filtros). */
  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.carrierService.carriers().length === 0;
  }

  /** Retorna true si hay filtros activos pero no hay resultados. */
  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.carrierService.carriers().length > 0 &&
      this.filteredCarriers().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText || !!this.filterStatus || !!this.filterType;
  }

  protected readonly selectedStatus = computed(() => this.selectedCarrier()?.status ?? null);
}
