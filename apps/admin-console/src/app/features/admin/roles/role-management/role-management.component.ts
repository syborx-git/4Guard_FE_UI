/**
 * @file role-management.component.ts
 * @description Componente principal de Roles y Matriz de Permisos (RBAC) — 4GUARD WMS.
 * Homologado con Gestión de Transportistas, SKUs, Clientes y Usuarios.
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
  FormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { RolePermissionService } from '../../services/role-permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Role,
  Permission,
  RoleAuditLog,
} from '../models/role-permission.model';

type FormMode = 'idle' | 'new' | 'edit';

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

export interface PermissionGroup {
  groupName: string;
  permissions: Permission[];
}

@Component({
  selector: 'fg-role-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './role-management.component.html',
  styleUrl: './role-management.component.css',
})
export class RoleManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly roleService = inject(RolePermissionService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la Vista (Signals Reactivos) ─────────────────────────────────

  protected readonly selectedRole = signal<Role | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Matriz de Permisos Seleccionados ──────────────────────────────────────

  protected readonly selectedPermissionIds = signal<Set<string>>(new Set());

  // ─── Audit Logs (Línea de tiempo BE) ───────────────────────────────────────

  protected readonly auditEntries = signal<RoleAuditLog[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Diálogo de Confirmación para Eliminación ───────────────────────────────

  protected readonly statusDialogOpen = signal<boolean>(false);

  // ─── Filtros del Directorio (Señales Reactivas) ─────────────────────────────

  protected readonly filterText = signal<string>('');
  protected readonly filterType = signal<string>(''); // '' | 'SYSTEM' | 'CUSTOM'

  // ─── Paginación Reactiva del Directorio ─────────────────────────────────────

  protected readonly pageSize = signal<number>(10);
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSizeOptions: number[] = [10, 30, 50];

  // ─── Computed Agrupador de Permisos por Módulo ───────────────────────────────

  protected readonly groupedPermissions = computed<PermissionGroup[]>(() => {
    const allPerms = this.roleService.permissions();
    const mapGroups = new Map<string, Permission[]>();

    for (const p of allPerms) {
      const group = p.moduleGroup || 'Operaciones Generales';
      if (!mapGroups.has(group)) {
        mapGroups.set(group, []);
      }
      mapGroups.get(group)!.push(p);
    }

    const result: PermissionGroup[] = [];
    mapGroups.forEach((perms, groupName) => {
      result.push({ groupName, permissions: perms });
    });

    return result.sort((a, b) => a.groupName.localeCompare(b.groupName));
  });

  // ─── Computed Lista Filtrada de Roles ────────────────────────────────────────

  protected readonly filteredRoles = computed(() => {
    let list = this.roleService.roles();
    const search = this.filterText().toLowerCase().trim();
    const typeVal = this.filterType();

    if (search) {
      list = list.filter(r => {
        const nameMatch = (r.name || '').toLowerCase().includes(search);
        const levelMatch = String(r.level).includes(search);
        return nameMatch || levelMatch;
      });
    }

    if (typeVal === 'SYSTEM') {
      list = list.filter(r => r.isSystem);
    } else if (typeVal === 'CUSTOM') {
      list = list.filter(r => !r.isSystem);
    }

    return list;
  });

  // ─── Computed Paginación ────────────────────────────────────────────────────

  protected readonly totalPages = computed(() => {
    return Math.ceil(this.filteredRoles().length / this.pageSize()) || 1;
  });

  protected readonly paginatedRoles = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredRoles().slice(start, start + this.pageSize());
  });

  protected readonly startIndex = computed(() => {
    if (this.filteredRoles().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  protected readonly endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredRoles().length);
  });

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  protected readonly kpiTotalRoles  = computed(() => this.roleService.totalCount());
  protected readonly kpiSystemRoles = computed(() => this.roleService.systemRolesCount());
  protected readonly kpiCustomRoles = computed(() => this.roleService.customRolesCount());

  // ─── Formulario Reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    level: [3, [Validators.required, Validators.min(1), Validators.max(7)]],
  });

  // ─── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadRolesAndPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de Datos ──────────────────────────────────────────────────────────

  protected loadRolesAndPermissions(): void {
    this.roleService.loadRolesAndPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al cargar los roles y permisos.';
          this.toastService.error(msg);
        }
      });
  }

  // ─── Manejo de Filtros y Paginación ─────────────────────────────────────────

  protected updateFilterText(text: string): void {
    this.filterText.set(text);
    this.currentPage.set(1);
  }

  protected updateFilterType(type: string): void {
    this.filterType.set(type);
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterType.set('');
    this.currentPage.set(1);
  }

  protected onPageSizeChange(newSize: string | number): void {
    this.pageSize.set(Number(newSize));
    this.currentPage.set(1);
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  // ─── Selección y Modos de Formulario ─────────────────────────────────────────

  protected selectRole(role: Role): void {
    this.selectedRole.set(role);
    this.formMode.set('edit');
    this.populateForm(role);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(role.id);
  }

  protected startNewRole(): void {
    this.selectedRole.set(null);
    this.formMode.set('new');
    this.form.reset({
      name: '',
      level: 3,
    });
    this.selectedPermissionIds.set(new Set());
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.auditEntries.set([]);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    const role = this.selectedRole();
    if (role) {
      this.formMode.set('edit');
      this.populateForm(role);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  private populateForm(role: Role): void {
    this.form.patchValue({
      name: role.name,
      level: role.level ?? 3,
    });

    const permSet = new Set<string>();
    if (Array.isArray(role.permissions)) {
      role.permissions.forEach(p => {
        if (p.id) permSet.add(p.id);
      });
    }
    this.selectedPermissionIds.set(permSet);

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Matriz de Permisos (Checkboxes) ─────────────────────────────────────────

  protected isPermissionSelected(permId: string): boolean {
    return this.selectedPermissionIds().has(permId);
  }

  protected togglePermission(permId: string): void {
    const set = new Set(this.selectedPermissionIds());
    if (set.has(permId)) {
      set.delete(permId);
    } else {
      set.add(permId);
    }
    this.selectedPermissionIds.set(set);
    this.form.markAsDirty();
  }

  protected isModuleGroupSelected(groupName: string): boolean {
    const group = this.groupedPermissions().find(g => g.groupName === groupName);
    if (!group || group.permissions.length === 0) return false;
    return group.permissions.every(p => this.selectedPermissionIds().has(p.id));
  }

  protected toggleModuleGroup(groupName: string): void {
    const group = this.groupedPermissions().find(g => g.groupName === groupName);
    if (!group) return;

    const set = new Set(this.selectedPermissionIds());
    const allSelected = group.permissions.every(p => set.has(p.id));

    if (allSelected) {
      group.permissions.forEach(p => set.delete(p.id));
    } else {
      group.permissions.forEach(p => set.add(p.id));
    }

    this.selectedPermissionIds.set(set);
    this.form.markAsDirty();
  }

  protected selectAllPermissions(): void {
    const allIds = this.roleService.permissions().map(p => p.id);
    this.selectedPermissionIds.set(new Set(allIds));
    this.form.markAsDirty();
  }

  protected clearAllPermissions(): void {
    this.selectedPermissionIds.set(new Set());
    this.form.markAsDirty();
  }

  // ─── Carga de Historial de Auditoría (BE Endpoint GET /api/v1/roles/{id}/audit) ──

  protected loadAuditLogs(roleId: string): void {
    this.isLoadingAudit.set(true);
    this.auditEntries.set([]);
    this.roleService.getRoleAudit(roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría del rol:', err);
        }
      });
  }

  // ─── Guardar Rol (Crear / Actualizar con Permisos) ──────────────────────────

  protected saveRole(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const mode = this.formMode();
    const permIds = Array.from(this.selectedPermissionIds());

    if (mode === 'new') {
      this.roleService.createRole({
        name: raw.name.trim().toUpperCase(),
        level: Number(raw.level),
        permissionIds: permIds
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const newRole = this.roleService.roles().find(r => r.name === raw.name.trim().toUpperCase());
          if (newRole) {
            this.selectedRole.set(newRole);
            this.loadAuditLogs(newRole.id);
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.toastService.success('Rol creado y configurado en la matriz RBAC con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedRole()) {
      const roleId = this.selectedRole()!.id;
      this.roleService.updateRole(roleId, {
        id: roleId,
        name: raw.name.trim().toUpperCase(),
        level: Number(raw.level),
        permissionIds: permIds
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const updated = this.roleService.roles().find(r => r.id === roleId);
          if (updated) {
            this.selectedRole.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(roleId);
          this.toastService.success('Rol y matriz de permisos actualizados con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    }
  }

  // ─── Eliminación con Diálogo Modal ──────────────────────────────────────────

  protected openStatusDialog(): void {
    if (this.selectedRole()?.isSystem) {
      this.toastService.error('No se pueden eliminar roles definidos por el sistema.');
      return;
    }
    this.statusDialogOpen.set(true);
  }

  protected closeStatusDialog(): void {
    this.statusDialogOpen.set(false);
  }

  protected confirmStatusDialog(): void {
    const role = this.selectedRole();
    if (!role) return;

    this.roleService.deleteRole(role.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeStatusDialog();
          this.selectedRole.set(null);
          this.formMode.set('idle');
          this.toastService.success('Rol eliminado correctamente de la matriz RBAC.');
        },
        error: (err: HttpErrorResponse) => {
          this.closeStatusDialog();
          this.handleBackendError(err);
        }
      });
  }

  // ─── Helpers de Errores y Validaciones UI ────────────────────────────────────

  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])       return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength'])      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['min'])            return 'El nivel mínimo es 1 (Máximo privilegio).';
    if (ctrl.errors['max'])            return 'El nivel máximo es 7 (Mínimo privilegio).';
    return 'Campo inválido.';
  }

  /** Retorna las iniciales del nombre del rol para el avatar. */
  protected getInitials(role: Role): string {
    const name = (role.name || '').replace(/[^a-zA-Z0-9]/g, '');
    if (name.length >= 2) return name.substring(0, 2).toUpperCase();
    if (name.length > 0) return name.toUpperCase();
    return 'RL';
  }

  protected isSelectedRole(role: Role): boolean {
    return this.selectedRole()?.id === role.id;
  }

  // ─── Manejo de Errores Backend ───────────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      this.backendError.set(serverMsg || 'Ya existe un rol registrado con este nombre.');
    } else if (status === 404) {
      this.backendError.set('Rol no encontrado en el sistema.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Revisa los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Permisos RBAC ────────────────────────────────────────────────────────────

  protected canCreate():    boolean { return true; }
  protected canUpdate():    boolean { return true; }
  protected canDelete():    boolean { return true; }
  protected canViewAudit(): boolean { return true; }

  // ─── UI State Getters ─────────────────────────────────────────────────────────

  protected get isFormDirty(): boolean  { return this.form.dirty; }
  protected get isSaving():    boolean  { return this.roleService.saving(); }
  protected get isLoading():   boolean  { return this.roleService.loading(); }
  protected get hasLoadError():boolean  { return !!this.roleService.loadError(); }
  protected get loadErrorMessage(): string { return this.roleService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.roleService.roles().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.roleService.roles().length > 0 &&
      this.filteredRoles().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterType();
  }
}
