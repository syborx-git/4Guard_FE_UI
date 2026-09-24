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
import { SetPasswordModalComponent } from './set-password-modal/set-password-modal.component';

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
    SetPasswordModalComponent,
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

  // ── Estado: Establecer Contraseña Definitiva ───────────────
  protected readonly showSetPasswordModal = signal(false);

  protected openSetPasswordModal(): void {
    this.showSetPasswordModal.set(true);
  }

  protected closeSetPasswordModal(): void {
    this.showSetPasswordModal.set(false);
  }

  protected onPasswordConfirmed(newPassword: string): void {
    this.showSetPasswordModal.set(false);
    const user = this.selectedUser();
    if (user) {
      this.userAdminService.update(user.id, {
        password: newPassword
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toastService.success(`⚡ Contraseña de "${user.firstName} ${user.lastName}" establecida con éxito en la base de datos.`, 4000);
          this.saveSuccess.set(true);
          this.loadAuditLogs(user.id);
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al actualizar la contraseña del usuario.';
          this.toastService.error(msg, 4500);
        }
      });
    }
  }

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
    // Fallback con catálogo completo de roles del sistema WMS
    return [
      { id: 'OPERATIONS_MANAGER', name: 'OPERATIONS_MANAGER', label: 'Gerente de Operaciones (OPERATIONS_MANAGER)' },
      { id: 'ADMIN', name: 'ADMIN', label: 'Administrador General (ADMIN)' },
      { id: 'CEO', name: 'CEO', label: 'Director General (CEO)' },
      { id: 'OPERATIONS_SUPERVISOR', name: 'OPERATIONS_SUPERVISOR', label: 'Supervisor de Operaciones (OPERATIONS_SUPERVISOR)' },
      { id: 'WAREHOUSE_MANAGER', name: 'WAREHOUSE_MANAGER', label: 'Gerente de Almacén (WAREHOUSE_MANAGER)' },
      { id: 'DOCK_SUPERVISOR', name: 'DOCK_SUPERVISOR', label: 'Supervisor de Andén (DOCK_SUPERVISOR)' },
      { id: 'SHIFT_LEADER', name: 'SHIFT_LEADER', label: 'Líder de Turno (SHIFT_LEADER)' },
      { id: 'CONTROL_DESK', name: 'CONTROL_DESK', label: 'Mesa de Control (CONTROL_DESK)' },
      { id: 'QM_INSPECTOR', name: 'QM_INSPECTOR', label: 'Inspector de Calidad (QM_INSPECTOR)' },
      { id: 'WAREHOUSE_OPERATOR', name: 'WAREHOUSE_OPERATOR', label: 'Operario de Almacén (WAREHOUSE_OPERATOR)' },
      { id: 'MANEUVER_OPERATOR', name: 'MANEUVER_OPERATOR', label: 'Operador de Maniobras (MANEUVER_OPERATOR)' },
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
  protected readonly kpiAdminSupervisors = computed(() => {
    const adminSupervisorSet = new Set([
      'ADMIN', 'ROLE_ADMIN',
      'OPERATIONS_MANAGER', 'ROLE_OPERATIONS_MANAGER',
      'WAREHOUSE_MANAGER', 'ROLE_WAREHOUSE_MANAGER',
      'CEO', 'ROLE_CEO',
      'OPERATIONS_SUPERVISOR', 'ROLE_OPERATIONS_SUPERVISOR',
      'DOCK_SUPERVISOR', 'ROLE_DOCK_SUPERVISOR',
      'SHIFT_LEADER', 'ROLE_SHIFT_LEADER',
      'CONTROL_DESK', 'ROLE_CONTROL_DESK',
      'SUPERVISOR', 'ROLE_SUPERVISOR'
    ]);
    return this.userAdminService.users().filter(u => {
      const role = (u.role || '').toUpperCase().trim();
      const cleanRole = role.replace('ROLE_', '');
      return adminSupervisorSet.has(role) || adminSupervisorSet.has(cleanRole);
    }).length;
  });

  // ── Ciclo de vida ────────────────────────────────────────
  ngOnInit(): void {
    this.branchService.loadBranches().pipe(takeUntil(this.destroy$)).subscribe({
      error: (err) => console.error('Error al precargar sucursales de la BD:', err)
    });
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
        this.toastService.error(msg, 4000);
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
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          this.saveSuccess.set(true);
          const fullName = `${raw.firstName.trim()} ${raw.lastName.trim()}`;
          this.toastService.success(`⚡ Usuario "${fullName}" creado y registrado con éxito en el sistema.`, 4000);
          
          const createdUser = response?.data;
          if (createdUser) {
            const mappedItem = this.userAdminService.users().find(u => u.id === createdUser.id);
            if (mappedItem) {
              this.selectedUser.set(mappedItem);
              this.loadAuditLogs(mappedItem.id);
            }
          } else {
            const emailTrimmed = raw.email.trim().toLowerCase();
            const usernameTrimmed = raw.username.trim();
            const createdItem = this.userAdminService.users().find(u => u.email === emailTrimmed || u.username === usernameTrimmed);
            if (createdItem) {
              this.selectedUser.set(createdItem);
              this.loadAuditLogs(createdItem.id);
            }
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al crear el usuario en la base de datos.';
          this.backendError.set(msg);
          this.toastService.error(msg, 4500);
        }
      });
    } else if (mode === 'edit' && this.selectedUser()) {
      const userId = this.selectedUser()!.id;
      const currentStatus = this.selectedUser()?.status || 'ACTIVE';
      this.userAdminService.update(userId, {
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        username: raw.username.trim(),
        email: raw.email.trim().toLowerCase(),
        role: raw.role,
        branchId: raw.branchId,
        branchName: branchName,
        status: currentStatus,
        isEnabled: currentStatus === 'ACTIVE'
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const fullName = `${raw.firstName.trim()} ${raw.lastName.trim()}`;
          this.toastService.success(`⚡ Usuario "${fullName}" actualizado con éxito.`, 4000);
          const updated = this.userAdminService.users().find(u => u.id === userId);
          if (updated) {
            this.selectedUser.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(userId);
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al actualizar el usuario en la base de datos.';
          this.backendError.set(msg);
          this.toastService.error(msg, 4500);
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
        this.toastService.success(`Usuario "${target.firstName} ${target.lastName}" ${newStatus === 'ACTIVE' ? 'activado' : 'desactivado'} con éxito.`, 3500);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err?.error?.message || 'Error al cambiar el estado del usuario.';
        this.toastService.error(msg, 4000);
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
          this.toastService.success(`Contraseña temporal generada para "${user.firstName} ${user.lastName}".`, 4000);
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
        this.toastService.success(`Usuario "${user.firstName} ${user.lastName}" eliminado correctamente.`, 4000);
      },
      error: (err: HttpErrorResponse) => {
        this.isDeleting.set(false);
        this.deletingUser.set(null);
        const msg = err?.error?.message || err?.message || 'Error al eliminar el usuario.';
        this.toastService.error(msg, 4000);
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
    if (!role) return '';
    const clean = role.replace('ROLE_', '').toUpperCase();
    const extendedLabels: Record<string, string> = {
      'ADMIN': 'Administrador General (ADMIN)',
      'OPERATIONS_MANAGER': 'Gerente de Operaciones (OPERATIONS_MANAGER)',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén (WAREHOUSE_MANAGER)',
      'CEO': 'Director General (CEO)',
      'OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones (OPERATIONS_SUPERVISOR)',
      'DOCK_SUPERVISOR': 'Supervisor de Andén (DOCK_SUPERVISOR)',
      'SHIFT_LEADER': 'Líder de Turno (SHIFT_LEADER)',
      'CONTROL_DESK': 'Mesa de Control (CONTROL_DESK)',
      'QM_INSPECTOR': 'Inspector de Calidad (QM_INSPECTOR)',
      'WAREHOUSE_OPERATOR': 'Operario de Almacén (WAREHOUSE_OPERATOR)',
      'MANEUVER_OPERATOR': 'Operador de Maniobras (MANEUVER_OPERATOR)',
      'AUDITOR': 'Auditor (AUDITOR)',
      'CLIENT': 'Cliente 3PL (CLIENT)',
    };
    if (extendedLabels[clean]) return extendedLabels[clean];
    if (ROLE_LABELS[role as UserRole]) return ROLE_LABELS[role as UserRole];
    return role;
  }

  protected getInitials(user: UserAdminItem): string {
    const first = (user.firstName || '').trim()[0] || '';
    const last = (user.lastName || '').trim()[0] || '';
    if (first && last) return (first + last).toUpperCase();
    if (user.username) return user.username.substring(0, 2).toUpperCase();
    return 'US';
  }

  protected getAvatarClass(role: UserRole | string): string {
    const r = (role || '').toUpperCase().replace('ROLE_', '');
    switch (r) {
      case 'ADMIN':
      case 'CEO':
        return 'avatar--admin';
      case 'OPERATIONS_MANAGER':
      case 'WAREHOUSE_MANAGER':
        return 'avatar--manager';
      case 'OPERATIONS_SUPERVISOR':
      case 'DOCK_SUPERVISOR':
      case 'SHIFT_LEADER':
      case 'CONTROL_DESK':
      case 'AUDITOR':
        return 'avatar--supervisor';
      case 'QM_INSPECTOR':
        return 'avatar--inspector';
      default:
        return 'avatar--operator';
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

