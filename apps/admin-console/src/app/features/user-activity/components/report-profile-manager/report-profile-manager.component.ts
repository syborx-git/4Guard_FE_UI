/**
 * @file report-profile-manager.component.ts
 * @description CRUD de perfiles de reporte — HU-146.
 *
 * Administra los perfiles de consulta guardados (ActivityReportProfile).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REGLAS DE NEGOCIO
 * ═══════════════════════════════════════════════════════════════════════════
 * - Solo el propietario puede eliminar sus perfiles PRIVADOS.
 * - Los perfiles SHARED son de solo lectura para propietarios distintos.
 * - No se pueden guardar perfiles vacíos (nombre, código, al menos 1 columna).
 * - Código único en todos los perfiles.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA: CRUD EN MEMORIA
 * ═══════════════════════════════════════════════════════════════════════════
 * Los cambios no persisten al refrescar la página.
 * Cuando el backend esté disponible, el servicio delegará a HTTP.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * El frontend NO escribe en audit_logs. La auditoría es responsabilidad del backend.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
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
import { UserActivityService } from '../../user-activity.service';
import {
  ActivityReportProfile,
  WMS_MODULES,
  ProfileVisibility,
  ProfileStatus,
  DefaultDateRange,
  DefaultView,
  ExportFormat,
} from '../../user-activity.models';

// ── Validador: código único ─────────────────────────────────────────────────

function uniqueCodeValidator(
  service: UserActivityService,
  excludeId?: string
) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const exists = service.getProfiles().find(
      (p) =>
        p.code.toLowerCase() === (control.value as string).toLowerCase() &&
        p.id !== excludeId
    );
    return exists ? { duplicateCode: true } : null;
  };
}

type FormMode = 'list' | 'new' | 'edit';

@Component({
  selector: 'fg-report-profile-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="rp-backdrop"
      role="presentation"
      (click)="close.emit()"
      aria-hidden="true">
    </div>

    <!-- Panel -->
    <aside
      class="rp-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-title">

      <!-- Header -->
      <div class="rp-header">
        <div class="rp-header__left">
          <div class="rp-header__icon">
            <span class="material-symbols-outlined">bookmarks</span>
          </div>
          <div>
            <span class="rp-eyebrow">PERFILES DE REPORTE</span>
            <h2 id="rp-title" class="rp-title">
              @if (mode() === 'list') { Perfiles guardados }
              @else if (mode() === 'new') { Nuevo perfil }
              @else { Editar perfil }
            </h2>
          </div>
        </div>
        <button
          class="rp-close"
          (click)="close.emit()"
          aria-label="Cerrar administrador de perfiles">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Nota disclaimer -->
      <div class="rp-disclaimer">
        <span class="material-symbols-outlined rp-disclaimer__icon">info</span>
        <span>
          Los perfiles se guardan en memoria. Los cambios no persisten al recargar la página
          ya que no existe backend para este recurso en esta etapa.
        </span>
      </div>

      <!-- RLS note -->
      <div class="rp-rls-note">
        <span class="material-symbols-outlined">shield</span>
        Los resultados están limitados por organización, almacén y permisos RLS.
      </div>

      <!-- Body -->
      <div class="rp-body">

        <!-- LISTA DE PERFILES -->
        @if (mode() === 'list') {
          <div class="rp-toolbar">
            <button
              class="rp-btn rp-btn--primary"
              (click)="openNew()"
              id="rp-new-btn">
              <span class="material-symbols-outlined">add</span>
              Nuevo perfil
            </button>
          </div>

          @if (profiles().length === 0) {
            <div class="rp-empty">
              <span class="material-symbols-outlined rp-empty__icon">bookmarks</span>
              <p>No hay perfiles guardados.</p>
              <button class="rp-btn rp-btn--primary" (click)="openNew()">Crear el primero</button>
            </div>
          }

          <div class="rp-list">
            @for (profile of profiles(); track profile.id) {
              <article class="rp-card" [class.rp-card--inactive]="profile.status === 'INACTIVE'">
                <div class="rp-card__header">
                  <div class="rp-card__meta">
                    <span class="rp-card__code">{{ profile.code }}</span>
                    <span class="rp-badge"
                      [class.rp-badge--shared]="profile.visibility === 'SHARED'"
                      [class.rp-badge--private]="profile.visibility === 'PRIVATE'">
                      {{ profile.visibility === 'SHARED' ? 'Compartido' : 'Privado' }}
                    </span>
                    <span class="rp-badge"
                      [class.rp-badge--active]="profile.status === 'ACTIVE'"
                      [class.rp-badge--inactive]="profile.status === 'INACTIVE'">
                      {{ profile.status === 'ACTIVE' ? 'Activo' : 'Inactivo' }}
                    </span>
                  </div>
                  <div class="rp-card__actions">
                    <button
                      class="rp-icon-btn"
                      (click)="openEdit(profile)"
                      [attr.aria-label]="'Editar perfil ' + profile.name">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      class="rp-icon-btn"
                      (click)="duplicate(profile)"
                      [attr.aria-label]="'Duplicar perfil ' + profile.name">
                      <span class="material-symbols-outlined">content_copy</span>
                    </button>
                    <button
                      class="rp-icon-btn"
                      (click)="toggleStatus(profile)"
                      [attr.aria-label]="(profile.status === 'ACTIVE' ? 'Desactivar' : 'Activar') + ' perfil ' + profile.name">
                      <span class="material-symbols-outlined">
                        {{ profile.status === 'ACTIVE' ? 'toggle_on' : 'toggle_off' }}
                      </span>
                    </button>
                    <button
                      class="rp-icon-btn rp-icon-btn--danger"
                      (click)="confirmDelete(profile)"
                      [attr.aria-label]="'Eliminar perfil ' + profile.name"
                      [disabled]="profile.visibility === 'SHARED' || profile.ownerId !== currentUserId">
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
                <div class="rp-card__body">
                  <h3 class="rp-card__name">{{ profile.name }}</h3>
                  @if (profile.description) {
                    <p class="rp-card__desc">{{ profile.description }}</p>
                  }
                  <div class="rp-card__chips">
                    @for (mod of profile.modules.slice(0, 3); track mod) {
                      <span class="rp-chip">{{ mod }}</span>
                    }
                    @if (profile.modules.length > 3) {
                      <span class="rp-chip rp-chip--more">+{{ profile.modules.length - 3 }}</span>
                    }
                  </div>
                </div>
                <button
                  class="rp-card__apply"
                  (click)="applyProfile.emit(profile)"
                  [attr.aria-label]="'Aplicar perfil ' + profile.name">
                  <span class="material-symbols-outlined">play_arrow</span>
                  Aplicar perfil
                </button>
              </article>
            }
          </div>
        }

        <!-- FORMULARIO: NUEVO / EDITAR -->
        @if (mode() === 'new' || mode() === 'edit') {
          <form
            [formGroup]="profileForm"
            (ngSubmit)="submitForm()"
            class="rp-form"
            novalidate>

            <!-- Error del servidor -->
            @if (formError()) {
              <div class="rp-form__server-error" role="alert">
                <span class="material-symbols-outlined">error</span>
                {{ formError() }}
              </div>
            }

            <!-- Nombre -->
            <div class="rp-form__field" [class.rp-form__field--error]="isInvalid('name')">
              <label for="rp-name" class="rp-form__label">
                Nombre <span class="rp-form__required">*</span>
              </label>
              <input
                id="rp-name"
                class="rp-form__input"
                type="text"
                formControlName="name"
                placeholder="Ej: Actividad crítica diaria"
                autocomplete="off" />
              @if (isInvalid('name')) {
                <span class="rp-form__error-msg" role="alert">
                  @if (profileForm.get('name')?.hasError('required')) { El nombre es obligatorio. }
                  @if (profileForm.get('name')?.hasError('minlength')) { Mínimo 3 caracteres. }
                </span>
              }
            </div>

            <!-- Código -->
            <div class="rp-form__field" [class.rp-form__field--error]="isInvalid('code')">
              <label for="rp-code" class="rp-form__label">
                Código <span class="rp-form__required">*</span>
              </label>
              <input
                id="rp-code"
                class="rp-form__input rp-form__input--mono"
                type="text"
                formControlName="code"
                placeholder="Ej: RPT-USR-001"
                autocomplete="off" />
              @if (isInvalid('code')) {
                <span class="rp-form__error-msg" role="alert">
                  @if (profileForm.get('code')?.hasError('required')) { El código es obligatorio. }
                  @if (profileForm.get('code')?.hasError('duplicateCode')) { Este código ya está en uso. }
                </span>
              }
            </div>

            <!-- Descripción -->
            <div class="rp-form__field">
              <label for="rp-desc" class="rp-form__label">Descripción</label>
              <textarea
                id="rp-desc"
                class="rp-form__textarea"
                formControlName="description"
                rows="2"
                placeholder="Descripción opcional del propósito del perfil">
              </textarea>
            </div>

            <!-- Visibilidad -->
            <div class="rp-form__field">
              <label for="rp-visibility" class="rp-form__label">Visibilidad</label>
              <select id="rp-visibility" class="rp-form__select" formControlName="visibility">
                <option value="PRIVATE">Privado — Solo para mí</option>
                <option value="SHARED">Compartido — Visible para el equipo</option>
              </select>
            </div>

            <!-- Módulos (al menos 1 requerido) -->
            <div class="rp-form__field" [class.rp-form__field--error]="isInvalid('modules')">
              <label class="rp-form__label">
                Módulos
                <span class="rp-form__hint">(al menos uno)</span>
              </label>
              <div class="rp-form__checkbox-grid">
                @for (mod of allModules; track mod) {
                  <label class="rp-check">
                    <input
                      type="checkbox"
                      [checked]="isModuleChecked(mod)"
                      (change)="toggleModule(mod)"
                      [attr.aria-label]="'Módulo ' + mod" />
                    {{ mod }}
                  </label>
                }
              </div>
              @if (isInvalid('modules')) {
                <span class="rp-form__error-msg" role="alert">Selecciona al menos un módulo.</span>
              }
            </div>

            <!-- Columnas visibles (al menos 1 requerida) -->
            <div class="rp-form__field" [class.rp-form__field--error]="isInvalid('visibleColumns')">
              <label class="rp-form__label">
                Columnas visibles
                <span class="rp-form__hint">(al menos una)</span>
              </label>
              <div class="rp-form__checkbox-grid">
                @for (col of allColumns; track col.key) {
                  <label class="rp-check">
                    <input
                      type="checkbox"
                      [checked]="isColumnChecked(col.key)"
                      (change)="toggleColumn(col.key)"
                      [attr.aria-label]="'Columna ' + col.label" />
                    {{ col.label }}
                  </label>
                }
              </div>
              @if (isInvalid('visibleColumns')) {
                <span class="rp-form__error-msg" role="alert">Selecciona al menos una columna.</span>
              }
            </div>

            <!-- Vista y rango de fecha -->
            <div class="rp-form__row">
              <div class="rp-form__field">
                <label for="rp-view" class="rp-form__label">Vista predeterminada</label>
                <select id="rp-view" class="rp-form__select" formControlName="defaultView">
                  <option value="TABLE">Tabla</option>
                  <option value="TIMELINE">Línea de tiempo</option>
                </select>
              </div>
              <div class="rp-form__field">
                <label for="rp-date-range" class="rp-form__label">Rango de fecha</label>
                <select id="rp-date-range" class="rp-form__select" formControlName="defaultDateRange">
                  <option value="TODAY">Hoy</option>
                  <option value="CURRENT_SHIFT">Turno actual</option>
                  <option value="LAST_7_DAYS">Últimos 7 días</option>
                  <option value="CUSTOM">Personalizado</option>
                </select>
              </div>
            </div>

            <!-- Formato de exportación -->
            <div class="rp-form__field">
              <label for="rp-export" class="rp-form__label">Formato de exportación</label>
              <select id="rp-export" class="rp-form__select" formControlName="exportFormat">
                <option value="XLSX">Excel (.xlsx)</option>
                <option value="CSV">CSV (.csv)</option>
                <option value="PDF">PDF (.pdf)</option>
              </select>
            </div>

            <!-- Acciones del formulario -->
            <div class="rp-form__actions">
              <button
                type="button"
                class="rp-btn rp-btn--secondary"
                (click)="cancelForm()">
                Cancelar
              </button>
              <button
                id="rp-submit-btn"
                type="submit"
                class="rp-btn rp-btn--primary"
                [disabled]="submitAttempted() && profileForm.invalid">
                <span class="material-symbols-outlined">save</span>
                {{ mode() === 'new' ? 'Guardar perfil' : 'Actualizar perfil' }}
              </button>
            </div>
          </form>
        }

        <!-- Confirmación de eliminación -->
        @if (showDeleteConfirm()) {
          <div class="rp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="rp-confirm-title">
            <div class="rp-confirm__card">
              <span class="material-symbols-outlined rp-confirm__icon">warning</span>
              <h3 id="rp-confirm-title" class="rp-confirm__title">¿Eliminar perfil?</h3>
              <p class="rp-confirm__desc">
                Esta acción eliminará el perfil "<strong>{{ profileToDelete()?.name }}</strong>".
                Esta operación no se puede deshacer en esta sesión.
              </p>
              <div class="rp-confirm__actions">
                <button class="rp-btn rp-btn--secondary" (click)="cancelDelete()">Cancelar</button>
                <button class="rp-btn rp-btn--danger" (click)="executeDelete()">
                  <span class="material-symbols-outlined">delete</span>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        }

      </div>
    </aside>
  `,
  styleUrl: './report-profile-manager.component.css',
})
export class ReportProfileManagerComponent implements OnInit {
  @Input() currentUserId = 'usr-03'; // Mock: en producción viene del AuthState
  @Output() close = new EventEmitter<void>();
  @Output() applyProfile = new EventEmitter<ActivityReportProfile>();

  private readonly fb = inject(FormBuilder);
  private readonly activityService = inject(UserActivityService);

  protected readonly profiles = this.activityService.profiles;
  protected readonly mode = signal<FormMode>('list');
  protected readonly submitAttempted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly profileToDelete = signal<ActivityReportProfile | null>(null);

  private editingId: string | null = null;

  protected readonly allModules: string[] = [...WMS_MODULES];

  protected readonly allColumns: Array<{ key: string; label: string }> = [
    { key: 'occurredAt', label: 'Fecha y hora' },
    { key: 'userName', label: 'Usuario' },
    { key: 'userRole', label: 'Rol' },
    { key: 'warehouseName', label: 'Almacén' },
    { key: 'module', label: 'Módulo' },
    { key: 'action', label: 'Acción' },
    { key: 'entityType', label: 'Entidad' },
    { key: 'entityId', label: 'ID entidad' },
    { key: 'description', label: 'Descripción' },
    { key: 'result', label: 'Resultado' },
    { key: 'severity', label: 'Criticidad' },
  ];

  protected profileForm!: FormGroup;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mode() !== 'list') {
      this.cancelForm();
    } else {
      this.close.emit();
    }
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(profile?: ActivityReportProfile): void {
    this.profileForm = this.fb.group({
      name: [profile?.name ?? '', [Validators.required, Validators.minLength(3)]],
      code: [
        profile?.code ?? '',
        [Validators.required],
        [uniqueCodeValidator(this.activityService, this.editingId ?? undefined) as never],
      ],
      description: [profile?.description ?? ''],
      visibility: [profile?.visibility ?? 'PRIVATE', Validators.required],
      modules: [profile?.modules ?? []],
      visibleColumns: [profile?.visibleColumns ?? ['occurredAt', 'userName', 'module', 'action', 'result']],
      defaultView: [profile?.defaultView ?? 'TABLE'],
      defaultDateRange: [profile?.defaultDateRange ?? 'TODAY'],
      exportFormat: [profile?.exportFormat ?? 'XLSX'],
    });
  }

  protected openNew(): void {
    this.editingId = null;
    this.submitAttempted.set(false);
    this.formError.set(null);
    this.initForm();
    this.mode.set('new');
  }

  protected openEdit(profile: ActivityReportProfile): void {
    this.editingId = profile.id;
    this.submitAttempted.set(false);
    this.formError.set(null);
    this.initForm(profile);
    this.mode.set('edit');
  }

  protected cancelForm(): void {
    this.editingId = null;
    this.formError.set(null);
    this.mode.set('list');
  }

  protected submitForm(): void {
    this.submitAttempted.set(true);
    this.profileForm.markAllAsTouched();

    const modules: string[] = this.profileForm.get('modules')?.value ?? [];
    const visibleColumns: string[] = this.profileForm.get('visibleColumns')?.value ?? [];

    if (modules.length === 0) {
      this.profileForm.get('modules')?.setErrors({ required: true });
    }
    if (visibleColumns.length === 0) {
      this.profileForm.get('visibleColumns')?.setErrors({ required: true });
    }

    if (this.profileForm.invalid) return;

    const data = {
      ...this.profileForm.value,
      ownerId: this.currentUserId,
      warehouseIds: [] as string[],
      actions: [] as string[],
      results: [] as string[],
      severities: [] as string[],
      status: 'ACTIVE' as ProfileStatus,
    };

    let result: { success: boolean; error?: string };

    if (this.mode() === 'new') {
      result = this.activityService.createProfile(data);
    } else {
      result = this.activityService.updateProfile(this.editingId!, data);
    }

    if (result.success) {
      this.cancelForm();
    } else {
      this.formError.set(result.error ?? 'Error desconocido.');
    }
  }

  protected duplicate(profile: ActivityReportProfile): void {
    const result = this.activityService.duplicateProfile(profile.id, this.currentUserId);
    if (!result.success) {
      this.formError.set(result.error ?? 'No se pudo duplicar el perfil.');
    }
  }

  protected toggleStatus(profile: ActivityReportProfile): void {
    this.activityService.toggleProfileStatus(profile.id);
  }

  protected confirmDelete(profile: ActivityReportProfile): void {
    this.profileToDelete.set(profile);
    this.showDeleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.profileToDelete.set(null);
    this.showDeleteConfirm.set(false);
  }

  protected executeDelete(): void {
    const profile = this.profileToDelete();
    if (!profile) return;

    const result = this.activityService.deleteProfile(profile.id, this.currentUserId);
    if (!result.success) {
      this.formError.set(result.error ?? 'No se pudo eliminar el perfil.');
    }

    this.cancelDelete();
  }

  // ── Helpers de checkboxes ────────────────────────────────────────────────

  protected isModuleChecked(mod: string): boolean {
    const modules: string[] = this.profileForm.get('modules')?.value ?? [];
    return modules.includes(mod);
  }

  protected toggleModule(mod: string): void {
    const modules: string[] = [...(this.profileForm.get('modules')?.value ?? [])];
    const index = modules.indexOf(mod);
    if (index === -1) {
      modules.push(mod);
    } else {
      modules.splice(index, 1);
    }
    this.profileForm.get('modules')?.setValue(modules);
    if (modules.length > 0) {
      this.profileForm.get('modules')?.setErrors(null);
    }
  }

  protected isColumnChecked(key: string): boolean {
    const cols: string[] = this.profileForm.get('visibleColumns')?.value ?? [];
    return cols.includes(key);
  }

  protected toggleColumn(key: string): void {
    const cols: string[] = [...(this.profileForm.get('visibleColumns')?.value ?? [])];
    const index = cols.indexOf(key);
    if (index === -1) {
      cols.push(key);
    } else {
      cols.splice(index, 1);
    }
    this.profileForm.get('visibleColumns')?.setValue(cols);
    if (cols.length > 0) {
      this.profileForm.get('visibleColumns')?.setErrors(null);
    }
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.profileForm.get(field);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }
}
