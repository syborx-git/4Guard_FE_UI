import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { UserRole, ROLE_LABELS } from '@4guard/shared-core';

import { UsersService } from '../../../core/services/users.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserAdminService, UserAdminItem, UserStatus } from '../services/user-admin.service';
import { BranchService } from '../services/branch.service';
import { UserAuditLogDto } from '../../../core/models/user.models';
import { TempPasswordModalComponent } from './temp-password-modal/temp-password-modal.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';

import { RolePermissionService } from '../services/role-permission.service';

type FormMode = 'idle' | 'new' | 'edit';

function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-users-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    TempPasswordModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css'
})
export class UsersListComponent implements OnInit, OnDestroy {
  // ── Servicios ────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly toastService = inject(ToastService);
  protected readonly userAdminService = inject(UserAdminService);
  private readonly branchService = inject(BranchService);
  private readonly roleService = inject(RolePermissionService);
  private readonly destroy$ = new Subject<void>();

  // ── Estado de la vista ───────────────────────────────────
  protected readonly selectedUser = signal<UserAdminItem | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);
  protected readonly isLoadingUsers = signal<boolean>(true);
  protected readonly loadUsersError = signal<string | null>(null);

  // ── Audit Logs ───────────────────────────────────────────
  protected readonly auditEntries = signal<UserAuditLogDto[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ── Filtros del directorio (Señales Reactivas) ─────────────
  protected readonly filterText = signal('');
  protected readonly filterStatus = signal<UserStatus | ''>('');
  protected readonly filterRole = signal('');

  // ── Estado: HU-003 Contraseña Temporal ───────────────────
  protected readonly confirmingUser = signal<UserAdminItem | null>(null);
  protected readonly isGenerating = signal(false);
  protected readonly tempPassword = signal<string | null>(null);
  protected readonly tempPasswordUser = signal<UserAdminItem | null>(null);

  // ── Estado: Eliminación de Usuario ───────────────────────
  protected readonly deletingUser = signal<UserAdminItem | null>(null);
  protected readonly isDeleting = signal(false);

  // ── Formulario Reactivo ─────────────────────────────────
  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    lastName: ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    username: ['', [Validators.required, Validators.maxLength(50), noWhitespaceValidator]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    role: [UserRole.WAREHOUSE_OPERATOR, Validators.required],
    branchId: [null],
    status: ['ACTIVE', Validators.required]
  });

  // ── Sucursales Disponibles ──────────────────────────────
  protected readonly availableBranches = computed(() => this.branchService.branches());

  // ── Catálogo de Roles Dinámicos desde la Base de Datos ────
  protected readonly availableRoles = computed(() => {
    const dbRoles = this.roleService.roles();
    if (dbRoles && dbRoles.length > 0) {
      return dbRoles.map(r => ({
        id: r.id,
        name: r.name,
        label: this.getRoleLabel(r.name)
      }));
    }
    // Fallback con roles del sistema
    return [
      { id: 'ADMIN', name: 'ADMIN', label: 'Administrador General (ADMIN)' },
      { id: 'WAREHOUSE_MANAGER', name: 'WAREHOUSE_MANAGER', label: 'Gerente de Almacén (WAREHOUSE_MANAGER)' },
      { id: 'DOCK_SUPERVISOR', name: 'DOCK_SUPERVISOR', label: 'Supervisor de Embarques (DOCK_SUPERVISOR)' },
      { id: 'QM_INSPECTOR', name: 'QM_INSPECTOR', label: 'Inspector de Calidad (QM_INSPECTOR)' },
      { id: 'WAREHOUSE_OPERATOR', name: 'WAREHOUSE_OPERATOR', label: 'Operario de Almacén (WAREHOUSE_OPERATOR)' },
      { id: 'AUDITOR', name: 'AUDITOR', label: 'Auditor (AUDITOR)' },
      { id: 'CLIENT', name: 'CLIENT', label: 'Cliente 3PL (CLIENT)' },
    ];
  });

  // ── Computed Lista Filtrada (Reactiva en tiempo real) ─────
  protected readonly filteredUsers = computed(() => {
    let list = this.userAdminService.users();
    const search = this.filterText().toLowerCase().trim();
    const statusVal = this.filterStatus();
    const roleVal = this.filterRole();

    if (search) {
      list = list.filter(u => {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        const branch = (u.branchName || '').toLowerCase();
        return fullName.includes(search) || username.includes(search) || email.includes(search) || role.includes(search) || branch.includes(search);
      });
    }

    if (statusVal) {
      list = list.filter(u => u.status === statusVal);
    }

    if (roleVal) {
      const cleanRoleVal = roleVal.replace('ROLE_', '').toUpperCase();
      list = list.filter(u => {
        const userRoleClean = (u.role || '').replace('ROLE_', '').toUpperCase();
        return userRoleClean === cleanRoleVal || u.role === roleVal;
      });
    }

    return list;
  });

  // ── Computed KPIs ────────────────────────────────────────
  protected readonly totalUsers = computed(() => this.userAdminService.users().length);
  protected readonly kpiActive = computed(() => this.userAdminService.users().filter(u => u.status === 'ACTIVE').length);
  protected readonly kpiInactive = computed(() => this.userAdminService.users().filter(u => u.status !== 'ACTIVE').length);
  protected readonly kpiAdminSupervisors = computed(() => 
    this.userAdminService.users().filter(u => 
      u.role === UserRole.ADMIN || 
      u.role === UserRole.WAREHOUSE_MANAGER || 
      u.role === UserRole.DOCK_SUPERVISOR
    ).length
  );

  // ── Ciclo de vida ────────────────────────────────────────
  ngOnInit(): void {
    this.roleService.loadRolesAndPermissions().pipe(takeUntil(this.destroy$)).subscribe({
      error: (err) => console.error('Error al precargar roles de la BD:', err)
    });
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de Usuarios ────────────────────────────────────
  protected loadUsers(): void {
    this.isLoadingUsers.set(true);
    this.loadUsersError.set(null);
    this.userAdminService.loadUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isLoadingUsers.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoadingUsers.set(false);
        const msg = err?.error?.message || 'Error al cargar los usuarios del backend.';
        this.loadUsersError.set(msg);
        this.toastService.error(msg);
      }
    });
  }

  // ── Selección y Filtros ──────────────────────────────────
  protected onFilterChange(): void {
    // computed reactivo automático con signals
  }

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterStatus.set('');
    this.filterRole.set('');
  }

  protected selectUser(user: UserAdminItem): void {
    this.selectedUser.set(user);
    this.formMode.set('edit');
    this.populateForm(user);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(user.id);
  }

  protected startNewUser(): void {
    this.selectedUser.set(null);
    this.formMode.set('new');
    this.form.reset({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      role: UserRole.WAREHOUSE_OPERATOR,
      branchId: null,
      status: 'ACTIVE'
    });
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.auditEntries.set([]);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    const user = this.selectedUser();
    if (user) {
      this.formMode.set('edit');
      this.populateForm(user);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  private populateForm(user: UserAdminItem): void {
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      status: user.status
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ── Historial de Auditoría ───────────────────────────────
  protected loadAuditLogs(userId: string): void {
    this.isLoadingAudit.set(true);
    this.userAdminService.getAuditLogs(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría del usuario:', err);
        }
      });
  }

  // ── Guardar Usuario ──────────────────────────────────────
  protected saveUser(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const branch = this.availableBranches().find(b => b.id === raw.branchId);
    const branchName = branch ? branch.name : (raw.branchId ? 'Sucursal Seleccionada' : 'Acceso Corporativo');

    const mode = this.formMode();

    if (mode === 'new') {
      this.userAdminService.create({
        username: raw.username.trim(),
        email: raw.email.trim().toLowerCase(),
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: raw.branchId,
        branchName: branchName,
        role: raw.role,
        status: raw.status,
        isEnabled: raw.status === 'ACTIVE',
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          const createdItem = this.userAdminService.users().find(u => u.email === raw.email.trim().toLowerCase());
          if (createdItem) {
            this.selectedUser.set(createdItem);
            this.loadAuditLogs(createdItem.id);
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.toastService.success('Usuario registrado con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => {
          this.backendError.set(err?.error?.message || err?.message || 'Error al crear el usuario.');
        }
      });
    } else if (mode === 'edit' && this.selectedUser()) {
      const userId = this.selectedUser()!.id;
      this.userAdminService.update(userId, {
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        username: raw.username.trim(),
        email: raw.email.trim().toLowerCase(),
        role: raw.role,
        branchId: raw.branchId,
        branchName: branchName,
        status: raw.status,
        isEnabled: raw.status === 'ACTIVE'
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const updated = this.userAdminService.users().find(u => u.id === userId);
          if (updated) {
            this.selectedUser.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(userId);
          this.toastService.success('Usuario actualizado con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => {
          this.backendError.set(err?.error?.message || err?.message || 'Error al actualizar el usuario.');
        }
      });
    }
  }

  // ── Cambios de Estado Directos ───────────────────────────
  protected toggleUserStatus(user?: UserAdminItem): void {
    const target = user || this.selectedUser();
    if (!target) return;

    const newStatus: UserStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.userAdminService.update(target.id, {
      status: newStatus,
      isEnabled: newStatus === 'ACTIVE'
    }).subscribe({
      next: () => {
        const updated = this.userAdminService.users().find(u => u.id === target.id);
        if (updated) {
          this.selectedUser.set(updated);
          this.populateForm(updated);
        }
        this.loadAuditLogs(target.id);
        this.toastService.success(`Usuario ${newStatus === 'ACTIVE' ? 'activado' : 'desactivado'} con éxito.`);
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Error al cambiar el estado del usuario.');
      }
    });
  }

  // ── HU-003: Generar Contraseña Temporal ──────────────────
  protected openGenerateConfirm(user?: UserAdminItem): void {
    const target = user || this.selectedUser();
    if (target) {
      this.confirmingUser.set(target);
    }
  }

  protected onGenerateCancelled(): void {
    this.confirmingUser.set(null);
  }

  protected onGenerateConfirmed(): void {
    const user = this.confirmingUser();
    if (!user || this.isGenerating()) return;

    this.isGenerating.set(true);

    this.usersService.generateTemporaryPassword(user.id).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        this.confirmingUser.set(null);

        if (response.success && response.data) {
          this.tempPassword.set(response.data);
          this.tempPasswordUser.set(user);
          this.loadAuditLogs(user.id);
        } else {
          this.toastService.error(response.message || 'No se pudo generar la contraseña temporal.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isGenerating.set(false);
        this.confirmingUser.set(null);
        this.handleGenerateError(err);
      }
    });
  }

  protected onTempPasswordModalClosed(): void {
    this.tempPassword.set(null);
    this.tempPasswordUser.set(null);
  }

  // ── Eliminación de Usuario ───────────────────────────────
  protected openDeleteConfirm(user?: UserAdminItem): void {
    const target = user || this.selectedUser();
    if (target) {
      this.deletingUser.set(target);
    }
  }

  protected onDeleteCancelled(): void {
    this.deletingUser.set(null);
  }

  protected onDeleteConfirmed(): void {
    const user = this.deletingUser();
    if (!user || this.isDeleting()) return;

    this.isDeleting.set(true);

    this.userAdminService.delete(user.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.deletingUser.set(null);
        this.selectedUser.set(null);
        this.formMode.set('idle');
        this.toastService.success('Usuario eliminado correctamente.');
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.deletingUser.set(null);
        this.toastService.error(err.message || 'Error al eliminar el usuario.');
      }
    });
  }

  // ── Helpers Form & UI ────────────────────────────────────
  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength']) return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['email']) return 'Ingresa un correo electrónico válido.';
    return 'Campo inválido.';
  }

  protected getRoleLabel(role: UserRole | string): string {
    return ROLE_LABELS[role as UserRole] || role;
  }

  protected getInitials(user: UserAdminItem): string {
    const first = (user.firstName || '').trim()[0] || '';
    const last = (user.lastName || '').trim()[0] || '';
    if (first && last) return (first + last).toUpperCase();
    if (user.username) return user.username.substring(0, 2).toUpperCase();
    return 'US';
  }

  protected getAvatarClass(role: UserRole | string): string {
    switch (role) {
      case UserRole.ADMIN: return 'avatar--admin';
      case UserRole.WAREHOUSE_MANAGER: return 'avatar--manager';
      case UserRole.DOCK_SUPERVISOR: return 'avatar--supervisor';
      case UserRole.QM_INSPECTOR: return 'avatar--inspector';
      case UserRole.AUDITOR: return 'avatar--supervisor';
      case UserRole.CLIENT: return 'avatar--manager';
      default: return 'avatar--operator';
    }
  }

  protected getAuditIcon(action: string): string {
    switch (action) {
      case 'USER_CREATED': return 'person_add';
      case 'USER_UPDATED': return 'edit_note';
      case 'LOGIN': return 'login';
      case 'PASSWORD_RESET': return 'key';
      case 'STATUS_CHANGE': return 'published_with_changes';
      case 'USER_DELETED': return 'person_remove';
      default: return 'info';
    }
  }

  protected getAuditColorClass(action: string): string {
    switch (action) {
      case 'USER_CREATED': return 'users-tl-node--emerald';
      case 'USER_UPDATED': return 'users-tl-node--blue';
      case 'LOGIN': return 'users-tl-node--purple';
      case 'PASSWORD_RESET': return 'users-tl-node--amber';
      case 'STATUS_CHANGE': return 'users-tl-node--indigo';
      case 'USER_DELETED': return 'users-tl-node--red';
      default: return 'users-tl-node--blue';
    }
  }

  protected getAuditSummary(action: string): string {
    switch (action) {
      case 'USER_CREATED': return 'Usuario registrado en el sistema';
      case 'USER_UPDATED': return 'Actualización de perfil / permisos';
      case 'LOGIN': return 'Inicio de sesión en el WMS';
      case 'PASSWORD_RESET': return 'Generación de clave temporal';
      case 'STATUS_CHANGE': return 'Cambio de estado operativo';
      case 'USER_DELETED': return 'Eliminación de cuenta de usuario';
      default: return action;
    }
  }

  protected isSelectedUser(user: UserAdminItem): boolean {
    return this.selectedUser()?.id === user.id;
  }

  protected get isListEmpty(): boolean {
    return !this.isLoadingUsers() && !this.loadUsersError() && this.userAdminService.users().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoadingUsers() &&
      !this.loadUsersError() &&
      this.userAdminService.users().length > 0 &&
      this.filteredUsers().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterStatus() || !!this.filterRole();
  }

  private handleGenerateError(err: HttpErrorResponse): void {
    switch (err.status) {
      case 403:
        this.toastService.error('No tienes permisos para generar contraseñas temporales.');
        break;
      case 404:
        this.toastService.error('El usuario ya no existe.');
        break;
      case 500:
        this.toastService.error('Error interno del servidor. Intenta nuevamente.');
        break;
      default:
        this.toastService.error('Ocurrió un error inesperado. Verifica tu conexión.');
    }
  }
}

