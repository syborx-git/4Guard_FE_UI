/**
 * @file shift-management.component.ts
 * @description Componente principal de Configuración de Turnos y Horarios (HU-140) — 4GUARD WMS.
 *
 * Implementa la arquitectura Master-Detail Split View (35% directorio / 65% formulario reactivo).
 *
 * FUNCIONALIDADES:
 *  - Directorio navegable y filtrable por nombre, código, horas y estatus.
 *  - Formulario Reactivo tipado con validación de horas, minutos no negativos y selector de 7 días.
 *  - Indicador dinámico de duración y cálculo de cruce de medianoche.
 *  - Verificación de permisos RBAC (OPERATIONS_MANAGER, OPERATIONS_SUPERVISOR, SHIFT_LEADER).
 *  - Diálogo de confirmación para prevenir pérdida accidental de cambios no guardados (form dirty).
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
import { Subject } from 'rxjs';

import { ShiftService } from '../services/shift.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Shift,
  OperatingDay,
  CreateShiftRequest,
  UpdateShiftRequest,
  OPERATING_DAYS_CONFIG,
  SHIFT_STATUS_LABELS,
  calculateShiftDuration,
  ShiftDurationCalculation,
} from '../models/shift.model';

type FormMode = 'idle' | 'new' | 'edit';

/** Validador personalizado: exige al menos un día seleccionado en la lista de días operativos */
function minOperatingDaysValidator(control: AbstractControl): ValidationErrors | null {
  const days = control.value;
  if (!Array.isArray(days) || days.length === 0) {
    return { minOperatingDaysRequired: true };
  }
  return null;
}

/** Validador personalizado: comprueba que las horas de inicio y fin no sean idénticas */
function distinctStartEndTimeValidator(control: AbstractControl): ValidationErrors | null {
  const startTime = control.get('startTime')?.value;
  const endTime = control.get('endTime')?.value;

  if (startTime && endTime && startTime === endTime) {
    return { identicalStartEndTime: true };
  }
  return null;
}

import { RouterLink } from '@angular/router';

@Component({
  selector: 'fg-shift-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './shift-management.component.html',
  styleUrl: './shift-management.component.css',
})
export class ShiftManagementComponent implements OnInit, OnDestroy {
  // Exponer KPI de conflictos
  protected readonly conflictCount = computed(() => this.shiftService.conflictCount());

  // Helper para saber si un turno tiene conflicto
  protected hasConflict(shiftId: string): boolean {
    return this.shiftService.hasConflict(shiftId);
  }
  private readonly fb = inject(FormBuilder);
  protected readonly shiftService = inject(ShiftService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // Constantes de plantilla
  protected readonly daysConfig = OPERATING_DAYS_CONFIG;
  protected readonly statusLabels = SHIFT_STATUS_LABELS;

  // Estados locales con Signals
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Control de diálogo de descarte de cambios
  protected readonly showUnsavedChangesModal = signal<boolean>(false);
  private pendingTargetShiftId: string | null | 'NEW' = null;

  // Formulario Reactivo
  protected shiftForm!: FormGroup;

  // Permisos RBAC
  protected readonly isShiftLeaderReadOnly = computed(() => {
    const role = this.authService.getRole();
    return role === 'SHIFT_LEADER' || role === 'ROLE_SHIFT_LEADER';
  });

  protected readonly canCreateOrEdit = computed(() => {
    return !this.isShiftLeaderReadOnly();
  });

  // Cálculo derivado de duración de jornada en tiempo real
  protected readonly calculatedDuration = computed<ShiftDurationCalculation>(() => {
    if (!this.shiftForm) {
      return { hours: 0, isOvernight: false, formattedDuration: '0 h' };
    }
    const start = this.shiftForm.get('startTime')?.value;
    const end = this.shiftForm.get('endTime')?.value;
    const breakMins = Number(this.shiftForm.get('restBreakMinutes')?.value) || 0;
    return calculateShiftDuration(start, end, breakMins);
  });

  ngOnInit(): void {
    this.initForm();

    // Sincronizar selección inicial del servicio con el formulario
    const currentSelected = this.shiftService.selectedShift();
    if (currentSelected) {
      this.populateForm(currentSelected);
      this.formMode.set('edit');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Inicialización del Formulario ─────────────────────────────────────────

  private initForm(): void {
    this.shiftForm = this.fb.group(
      {
        code: [
          '',
          [
            Validators.required,
            Validators.maxLength(20),
            Validators.pattern(/^[A-Za-z0-9\-_]+$/),
          ],
        ],
        name: ['', [Validators.required, Validators.maxLength(100)]],
        description: ['', [Validators.maxLength(250)]],
        startTime: ['08:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
        endTime: ['17:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
        operatingDays: [
          ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          [minOperatingDaysValidator],
        ],
        status: ['ACTIVE', [Validators.required]],
        restBreakMinutes: [60, [Validators.required, Validators.min(0), Validators.max(300)]],
        toleranceMinutes: [10, [Validators.required, Validators.min(0), Validators.max(120)]],
      },
      { validators: [distinctStartEndTimeValidator] }
    );

    // Deshabilitar formulario si el rol es solo lectura (SHIFT_LEADER)
    if (this.isShiftLeaderReadOnly()) {
      this.shiftForm.disable();
    }
  }

  // ─── Gestión de Selección y Navegación ────────────────────────────────────

  protected onSelectShift(id: string): void {
    if (this.shiftService.selectedShiftId() === id && this.formMode() === 'edit') {
      return;
    }

    if (this.shiftForm.dirty) {
      this.pendingTargetShiftId = id;
      this.showUnsavedChangesModal.set(true);
      return;
    }

    this.forceSelectShift(id);
  }

  private forceSelectShift(id: string): void {
    this.shiftService.selectShift(id);
    const selected = this.shiftService.selectedShift();
    if (selected) {
      this.populateForm(selected);
      this.formMode.set('edit');
    }
    this.formError.set(null);
    this.successMessage.set(null);
  }

  protected onClickNewShift(): void {
    if (this.isShiftLeaderReadOnly()) return;

    if (this.shiftForm.dirty) {
      this.pendingTargetShiftId = 'NEW';
      this.showUnsavedChangesModal.set(true);
      return;
    }

    this.forceStartNewShift();
  }

  private forceStartNewShift(): void {
    this.shiftService.selectShift(null);
    this.resetFormForNew();
    this.formMode.set('new');
    this.formError.set(null);
    this.successMessage.set(null);
  }

  protected confirmDiscardChanges(): void {
    this.showUnsavedChangesModal.set(false);
    if (this.pendingTargetShiftId === 'NEW') {
      this.forceStartNewShift();
    } else if (typeof this.pendingTargetShiftId === 'string') {
      this.forceSelectShift(this.pendingTargetShiftId);
    }
    this.pendingTargetShiftId = null;
  }

  protected cancelDiscardChanges(): void {
    this.showUnsavedChangesModal.set(false);
    this.pendingTargetShiftId = null;
  }

  // ─── Selector Interactivo de Días Operativos ───────────────────────────────

  protected isDaySelected(dayValue: OperatingDay): boolean {
    const days: OperatingDay[] = this.shiftForm.get('operatingDays')?.value || [];
    return days.includes(dayValue);
  }

  protected toggleDay(dayValue: OperatingDay): void {
    if (this.isShiftLeaderReadOnly()) return;

    const control = this.shiftForm.get('operatingDays');
    if (!control) return;

    const currentDays: OperatingDay[] = [...(control.value || [])];
    const index = currentDays.indexOf(dayValue);

    if (index > -1) {
      currentDays.splice(index, 1);
    } else {
      currentDays.push(dayValue);
    }

    control.setValue(currentDays);
    control.markAsDirty();
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  // ─── Métodos Auxiliares de Formulario ─────────────────────────────────────

  private populateForm(shift: Shift): void {
    this.shiftForm.reset({
      code: shift.code,
      name: shift.name,
      description: shift.description || '',
      startTime: shift.startTime,
      endTime: shift.endTime,
      operatingDays: [...shift.operatingDays],
      status: shift.status,
      restBreakMinutes: shift.restBreakMinutes ?? 0,
      toleranceMinutes: shift.toleranceMinutes ?? 0,
    });

    if (this.isShiftLeaderReadOnly()) {
      this.shiftForm.disable();
    } else {
      this.shiftForm.enable();
    }
  }

  private resetFormForNew(): void {
    this.shiftForm.reset({
      code: '',
      name: '',
      description: '',
      startTime: '08:00',
      endTime: '17:00',
      operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      status: 'ACTIVE',
      restBreakMinutes: 60,
      toleranceMinutes: 10,
    });

    if (this.isShiftLeaderReadOnly()) {
      this.shiftForm.disable();
    } else {
      this.shiftForm.enable();
    }
  }

  // ─── Guardado y Activación / Desactivación ────────────────────────────────

  protected onSubmitForm(): void {
    if (this.isShiftLeaderReadOnly()) return;

    if (this.shiftForm.invalid) {
      this.shiftForm.markAllAsTouched();
      this.formError.set('Por favor verifique los campos requeridos y corrija los errores de validación.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);
    this.successMessage.set(null);

    const val = this.shiftForm.value;
    const mode = this.formMode();

    const formatTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

    if (mode === 'new') {
      const createReq: CreateShiftRequest = {
        code: val.code,
        name: val.name,
        description: val.description,
        startTime: formatTime(val.startTime),
        endTime: formatTime(val.endTime),
        operatingDays: val.operatingDays,
        status: val.status,
        restBreakMinutes: val.restBreakMinutes,
        toleranceMinutes: val.toleranceMinutes,
        scopeType: 'BRANCH',
      };

      this.shiftService.createShift(createReq).subscribe({
        next: (created) => {
          this.isSubmitting.set(false);
          this.formMode.set('edit');
          this.shiftForm.markAsPristine();
          const msg = `Turno "${created.name}" (${created.code}) registrado exitosamente.`;
          this.successMessage.set(msg);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const errMsg = err?.message || 'Error al guardar el nuevo turno.';
          this.formError.set(errMsg);
        },
      });
    } else if (mode === 'edit') {
      const selected = this.shiftService.selectedShift();
      if (!selected) {
        this.isSubmitting.set(false);
        return;
      }

      const updateReq: UpdateShiftRequest = {
        code: val.code,
        name: val.name,
        description: val.description,
        startTime: formatTime(val.startTime),
        endTime: formatTime(val.endTime),
        operatingDays: val.operatingDays,
        status: val.status,
        restBreakMinutes: val.restBreakMinutes,
        toleranceMinutes: val.toleranceMinutes,
        scopeType: 'BRANCH',
      };

      this.shiftService.updateShift(selected.id, updateReq).subscribe({
        next: (updated) => {
          this.isSubmitting.set(false);
          this.shiftForm.markAsPristine();
          const msg = `Turno "${updated.name}" actualizado correctamente.`;
          this.successMessage.set(msg);
          this.toastService.success(msg);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const errMsg = err?.message || 'Error al actualizar el turno.';
          this.formError.set(errMsg);
          this.toastService.error(errMsg);
        },
      });
    }
  }

  protected onToggleStatus(): void {
    const selected = this.shiftService.selectedShift();
    if (!selected || this.isShiftLeaderReadOnly()) return;

    this.isSubmitting.set(true);
    this.shiftService.toggleShiftStatus(selected.id).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.populateForm(updated);
        const actionLabel = updated.status === 'ACTIVE' ? 'activado' : 'desactivado';
        const msg = `Turno "${updated.name}" ${actionLabel} correctamente.`;
        this.successMessage.set(msg);
        this.toastService.success(msg);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = err?.message || 'Error al cambiar estatus del turno.';
        this.formError.set(errMsg);
        this.toastService.error(errMsg);
      },
    });
  }

  // ─── Helpers para Validación Visual de Formulario ──────────────────────────

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.shiftForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  protected getFieldError(fieldName: string): string | null {
    const control = this.shiftForm.get(fieldName);
    if (!control || !control.errors || (!control.dirty && !control.touched)) {
      return null;
    }

    const errors = control.errors;
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['pattern'] && fieldName === 'code') return 'Código inválido (solo letras, números, guiones).';
    if (errors['pattern'] && (fieldName === 'startTime' || fieldName === 'endTime')) return 'Hora inválida (formato HH:mm).';
    if (errors['min']) return `El valor mínimo permitido es ${errors['min'].min}.`;
    if (errors['max']) return `El valor máximo permitido es ${errors['max'].max}.`;
    if (errors['minOperatingDaysRequired']) return 'Debe seleccionar al menos un día operativo.';

    return 'Campo inválido.';
  }

  protected hasIdenticalTimeError(): boolean {
    return Boolean(
      this.shiftForm.errors?.['identicalStartEndTime'] &&
      (this.shiftForm.get('startTime')?.touched || this.shiftForm.get('endTime')?.touched)
    );
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.shiftService.setFilters({ searchTerm: input.value });
  }

  protected onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.shiftService.setFilters({ status: select.value as any });
  }

  protected onDayFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.shiftService.setFilters({ day: select.value as any });
  }

  protected getDayShortLabels(days: OperatingDay[]): string {
    if (!days || days.length === 0) return 'Sin días';
    if (days.length === 7) return 'Todos los días (7D)';
    if (
      days.length === 5 &&
      days.includes('MONDAY') &&
      days.includes('TUESDAY') &&
      days.includes('WEDNESDAY') &&
      days.includes('THURSDAY') &&
      days.includes('FRIDAY')
    ) {
      return 'Lun - Vie';
    }
    if (days.length === 2 && days.includes('SATURDAY') && days.includes('SUNDAY')) {
      return 'Sáb - Dom';
    }

    return this.daysConfig
      .filter((cfg) => days.includes(cfg.value))
      .map((cfg) => cfg.shortLabel)
      .join(', ');
  }
}
