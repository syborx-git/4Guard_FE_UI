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
  protected readonly formMode = signal<FormMode>('new');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);
  protected readonly isLoadingUsers = signal<boolean>(true);
  protected readonly loadUsersError = signal<string | null>(null);

  // ── Audit Logs ───────────────────────────────────────────
  protected readonly auditEntries = signal<UserAuditLogDto[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);
  protected readonly showAuditTimeline = signal<boolean>(true);

  protected toggleShowAuditTimeline(): void {
    this.showAuditTimeline.update((v) => !v);
  }

  // ── Estado: KPIs Comprimidos (Estilo Recepción) ───────────
  protected readonly isKpiCollapsed = signal<boolean>(true);

  protected toggleKpiCollapse(): void {
    this.isKpiCollapsed.update((v) => !v);
  }

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
      return dbRoles
        .filter(r => r.name !== 'VIGILANCIA')
        .map(r => ({
          id: r.id,
          name: r.name,
          label: this.getRoleLabel(r.name)
        }));
    }
    // Fallback con catálogo oficial de roles del sistema WMS (Organigrama Oficial)
    return [
      { id: 'ADMIN', name: 'ADMIN', label: 'Director General (Admin)' },
      { id: 'OPERATIONS_MANAGER', name: 'OPERATIONS_MANAGER', label: 'Gerente de Operaciones' },
      { id: 'OPERATIONS_COORDINATOR', name: 'OPERATIONS_COORDINATOR', label: 'Coordinador de Operaciones' },
      { id: 'OPERATIONS_SUPERVISOR', name: 'OPERATIONS_SUPERVISOR', label: 'Supervisor de Operaciones' },
      { id: 'CONTROL_DESK', name: 'CONTROL_DESK', label: 'Mesa de Control' },
      { id: 'SHIFT_LEADER', name: 'SHIFT_LEADER', label: 'Líder de Turno' },
      { id: 'WAREHOUSE_OPERATOR', name: 'WAREHOUSE_OPERATOR', label: 'Montacarguista' },
      { id: 'QM_INSPECTOR', name: 'QM_INSPECTOR', label: 'Inspector de Calidad' },
      { id: 'SECURITY_GUARD', name: 'SECURITY_GUARD', label: 'Guardia de Seguridad (Caseta)' },
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
    this.startNewUser();
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
    const firstRole = this.availableRoles()[0]?.name || 'OPERATIONS_MANAGER';
    const firstBranch = this.availableBranches()[0]?.id || null;
    this.form.reset({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      role: firstRole,
      branchId: firstBranch,
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
      this.startNewUser();
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
      
      const missingFields: string[] = [];
      if (this.fieldHasError('firstName')) missingFields.push('Nombre(s)');
      if (this.fieldHasError('lastName')) missingFields.push('Apellidos');
      if (this.fieldHasError('username')) missingFields.push('Nombre de Usuario');
      if (this.fieldHasError('email')) missingFields.push('Correo Electrónico');
      if (this.fieldHasError('role')) missingFields.push('Rol del Sistema');

      const detail = missingFields.length > 0 
        ? `Faltan campos obligatorios: ${missingFields.join(', ')}.`
        : 'Por favor completa todos los campos requeridos (*).';
      this.toastService.warning(`⚠️ ${detail}`, 4500);
      return;
    }

    this.isSaving.set(true);
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
          this.isSaving.set(false);
          this.saveSuccess.set(true);
          const fullName = `${raw.firstName.trim()} ${raw.lastName.trim()}`;
          this.toastService.success(`⚡ Usuario "${fullName}" creado y registrado con éxito en el sistema.`, 4000);
          
          this.loadUsers();
          const createdUser = response?.data;
          if (createdUser) {
            const mappedItem = this.userAdminService.users().find(u => u.id === createdUser.id);
            if (mappedItem) {
              this.selectedUser.set(mappedItem);
              this.loadAuditLogs(mappedItem.id);
            }
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || err?.message || 'Error al crear el usuario en la base de datos.';
          this.backendError.set(msg);
          this.toastService.error(`❌ ${msg}`, 5000);
        }
      });
    } else if (mode === 'edit' && this.selectedUser()) {
      const userId = this.selectedUser()!.id;
      // Respetar estrictamente el estado actual: si está INACTIVE se preserva deshabilitado
      const currentStatus = this.selectedUser()?.status || this.form.get('status')?.value || 'ACTIVE';
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
          this.isSaving.set(false);
          this.saveSuccess.set(true);
          const fullName = `${raw.firstName.trim()} ${raw.lastName.trim()}`;
          this.toastService.success(`⚡ Usuario "${fullName}" actualizado con éxito.`, 4000);
          this.userAdminService.loadUsers().subscribe(() => {
            const updated = this.userAdminService.users().find(u => u.id === userId);
            if (updated) {
              this.selectedUser.set(updated);
              this.populateForm(updated);
            }
          });
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(userId);
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || err?.message || 'Error al actualizar el usuario en la base de datos.';
          this.backendError.set(msg);
          this.toastService.error(`❌ ${msg}`, 5000);
        }
      });
    } else {
      this.isSaving.set(false);
    }
  }

  // ── Cambios de Estado Directos (Activar / Desactivar) ─────
  protected toggleUserStatus(user?: UserAdminItem): void {
    const target = user || this.selectedUser();
    if (!target) return;

    const newStatus: UserStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.userAdminService.update(target.id, {
      status: newStatus,
      isEnabled: newStatus === 'ACTIVE'
    }).subscribe({
      next: () => {
        // Sincronizar el form reactivo
        this.form.patchValue({ status: newStatus });
        this.form.markAsPristine();

        // Actualizar el estado local
        if (this.selectedUser()?.id === target.id) {
          const current = this.selectedUser()!;
          this.selectedUser.set({
            ...current,
            status: newStatus,
            isEnabled: newStatus === 'ACTIVE'
          });
        }

        // Recargar usuarios y bitácora
        this.userAdminService.loadUsers().subscribe();
        this.loadAuditLogs(target.id);
        this.toastService.success(
          `Usuario "${target.firstName} ${target.lastName}" ${newStatus === 'ACTIVE' ? 'activado' : 'desactivado (baja lógica)'} con éxito.`,
          4000
        );
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

  // ── Eliminación de Usuario con Fallback de Trazabilidad ──
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
        const errorMsg = (err?.error?.message || err?.message || '').toLowerCase();
        const isConstraintOrTraceability = 
          err?.status === 409 || 
          err?.status === 400 || 
          err?.status === 500 ||
          errorMsg.includes('constraint') || 
          errorMsg.includes('foreign') || 
          errorMsg.includes('trazabilidad') || 
          errorMsg.includes('violates') || 
          errorMsg.includes('history') ||
          errorMsg.includes('reference') ||
          errorMsg.includes('fk_');

        if (isConstraintOrTraceability) {
          // Fallback Automático a Baja Lógica para preservar la integridad referencial y auditoría
          this.userAdminService.update(user.id, {
            status: 'INACTIVE',
            isEnabled: false
          }).subscribe({
            next: () => {
              this.isDeleting.set(false);
              this.deletingUser.set(null);
              this.form.patchValue({ status: 'INACTIVE' });
              this.form.markAsPristine();

              if (this.selectedUser()?.id === user.id) {
                this.selectedUser.set({
                  ...this.selectedUser()!,
                  status: 'INACTIVE',
                  isEnabled: false
                });
              }

              this.userAdminService.loadUsers().subscribe();
              this.loadAuditLogs(user.id);

              this.toastService.warning(
                `🛡️ Por trazabilidad legal y operativa (tiene pases de caseta o movimientos registrados), no puede borrarse de la BD. Ha sido dado de baja lógica e inhabilitado permanentemente.`,
                7000
              );
            },
            error: () => {
              this.isDeleting.set(false);
              this.deletingUser.set(null);
              this.toastService.error(
                `No se pudo eliminar ni desactivar al usuario: ${err?.error?.message || 'Error en el servidor.'}`,
                5000
              );
            }
          });
        } else {
          this.isDeleting.set(false);
          this.deletingUser.set(null);
          const msg = err?.error?.message || err?.message || 'Error al eliminar el usuario.';
          this.toastService.error(msg, 4000);
        }
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
      'ADMIN': 'Administrador General',
      'OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'CEO': 'Director General',
      'OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones',
      'DOCK_SUPERVISOR': 'Supervisor de Andén',
      'SHIFT_LEADER': 'Líder de Turno',
      'CONTROL_DESK': 'Mesa de Control',
      'QM_INSPECTOR': 'Inspector de Calidad',
      'WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'MANEUVER_OPERATOR': 'Operador de Maniobras',
      'SECURITY_GUARD': 'Guardia de Seguridad',
      'AUDITOR': 'Auditor',
      'CLIENT': 'Cliente 3PL',
    };
    if (extendedLabels[clean]) return extendedLabels[clean];
    if (ROLE_LABELS[role as UserRole]) return ROLE_LABELS[role as UserRole];
    return role;
  }

  protected getRoleShortLabel(role: UserRole | string): string {
    if (!role) return '';
    const clean = role.replace('ROLE_', '').toUpperCase();
    const shortLabels: Record<string, string> = {
      'ADMIN': 'Administrador General',
      'OPERATIONS_MANAGER': 'Gerente Operaciones',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'CEO': 'Director General',
      'OPERATIONS_SUPERVISOR': 'Supervisor Operativo',
      'DOCK_SUPERVISOR': 'Supervisor Andén',
      'SHIFT_LEADER': 'Líder de Turno',
      'CONTROL_DESK': 'Mesa de Control',
      'QM_INSPECTOR': 'Inspector Calidad',
      'WAREHOUSE_OPERATOR': 'Operario Almacén',
      'MANEUVER_OPERATOR': 'Operador Maniobras',
      'SECURITY_GUARD': 'Guardia de Seguridad',
      'AUDITOR': 'Auditor WMS',
      'CLIENT': 'Cliente 3PL',
    };
    if (shortLabels[clean]) return shortLabels[clean];
    return this.getRoleLabel(role);
  }

  protected getInitials(user: UserAdminItem): string {
    const first = (user.firstName || '').trim()[0] || '';
    const last = (user.lastName || '').trim()[0] || '';
    if (first && last) return (first + last).toUpperCase();
    if (user.username) return user.username.substring(0, 2).toUpperCase();
    return 'US';
  }

  protected getPreviewInitials(): string {
    const first = (this.form.get('firstName')?.value || '').trim()[0] || '';
    const last = (this.form.get('lastName')?.value || '').trim()[0] || '';
    if (first && last) return (first + last).toUpperCase();
    if (first) return first.toUpperCase();
    return 'NU';
  }

  protected getPreviewBranchName(): string {
    const branchId = this.form.get('branchId')?.value;
    if (!branchId) return 'Acceso Corporativo';
    const branch = this.availableBranches().find(b => b.id === branchId);
    return branch ? branch.name : 'Sucursal Asignada';
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
      case 'SECURITY_GUARD':
        return 'avatar--security';
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
      case 'USER_CREATED': return 'carriers-tl-node--emerald';
      case 'USER_UPDATED': return 'carriers-tl-node--blue';
      case 'LOGIN': return 'carriers-tl-node--purple';
      case 'PASSWORD_RESET': return 'carriers-tl-node--amber';
      case 'STATUS_CHANGE': return 'carriers-tl-node--indigo';
      case 'USER_DELETED': return 'carriers-tl-node--red';
      default: return 'carriers-tl-node--blue';
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

  protected formatFieldLabel(fieldName: string): string {
    if (!fieldName) return '';
    const map: Record<string, string> = {
      username: 'Usuario',
      email: 'Correo Electrónico',
      firstName: 'Nombre',
      lastName: 'Apellido',
      role: 'Rol de Sistema',
      branchId: 'Sucursal / Sede',
      status: 'Estado',
      active: 'Activo'
    };
    return map[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  }

  protected formatFieldValue(fieldName: string, value: any): string {
    if (value === null || value === undefined || value === '' || value === 'null') return 'Sin especificar';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (fieldName === 'status') {
      const s = String(value).toUpperCase();
      if (s === 'ACTIVE') return 'Activo';
      if (s === 'INACTIVE') return 'Inactivo';
      if (s === 'BLOCKED') return 'Bloqueado';
    }
    if (fieldName === 'role') {
      return this.getRoleLabel(value);
    }
    return String(value);
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

