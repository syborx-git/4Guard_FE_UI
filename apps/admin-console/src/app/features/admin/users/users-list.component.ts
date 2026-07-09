import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserRole, ROLE_LABELS } from '@4guard/shared-core';

import { UsersService } from '../../../core/services/users.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserAdminService, UserAdminItem, UserStatus } from '../services/user-admin.service';
import { BranchService } from '../services/branch.service';
import { TempPasswordModalComponent } from './temp-password-modal/temp-password-modal.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId: string;
  branchName: string;
  active: boolean;
}

@Component({
  selector: 'fg-users-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TempPasswordModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css'
})
export class UsersListComponent implements OnInit {
  // ── Servicios ────────────────────────────────────────────
  private readonly usersService = inject(UsersService);
  private readonly toastService = inject(ToastService);
  private readonly userAdminService = inject(UserAdminService);
  private readonly branchService = inject(BranchService);

  // ── Estado: Lista de usuarios ────────────────────────────
  protected readonly users = computed<UserItem[]>(() => {
    return this.userAdminService.users().map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.username,
      email: u.email,
      role: u.role,
      branchId: u.branchId || '1',
      branchName: u.branchName || 'Acceso Corporativo',
      active: u.status === 'ACTIVE'
    }));
  });

  // ── Estado: Búsqueda ─────────────────────────────────────
  protected readonly searchTerm = signal('');

  // ── Estado: Modal editar/crear ───────────────────────────
  protected readonly isModalOpen    = signal(false);
  protected readonly editingUserId  = signal<string | null>(null);

  // ── Estado: HU-003 Contraseña Temporal ───────────────────
  /** Usuario seleccionado para generar clave — controla visibilidad del ConfirmDialog */
  protected readonly confirmingUser = signal<UserItem | null>(null);
  /** true mientras el PUT está en vuelo — deshabilita botones, muestra spinner */
  protected readonly isGenerating   = signal(false);
  /** Contraseña temporal devuelta por el backend — controla visibilidad del TempPasswordModal */
  protected readonly tempPassword   = signal<string | null>(null);
  /** Usuario destinatario de la contraseña — para mostrar en el modal de éxito */
  protected readonly tempPasswordUser = signal<UserItem | null>(null);

  // ── Estado: Eliminación de Usuario ───────────────────────
  /** Usuario seleccionado para eliminar — controla visibilidad del ConfirmDialog */
  protected readonly deletingUser = signal<UserItem | null>(null);
  /** true mientras el DELETE está en vuelo — deshabilita botones, muestra spinner */
  protected readonly isDeleting = signal(false);

  // ── Formulario ───────────────────────────────────────────
  protected userForm = {
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.WAREHOUSE_OPERATOR,
    branchId: '1'
  };

  // ── Sucursales Disponibles ──────────────────────────────
  protected readonly availableBranches = computed(() => this.branchService.branches());

  // ── Computed ─────────────────────────────────────────────
  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.users();
    return this.users().filter(u =>
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.userAdminService.loadUsers().subscribe({
      error: () => {
        this.toastService.error('Error al cargar los usuarios del backend.');
      }
    });
  }

  // ── Helpers de roles ─────────────────────────────────────
  protected getRoleLabel(role: UserRole): string {
    return ROLE_LABELS[role] || role;
  }

  protected getRoleClass(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:              return 'role-admin';
      case UserRole.DOCK_SUPERVISOR:
      case UserRole.QM_INSPECTOR:      return 'role-supervisor';
      default:                          return 'role-operator';
    }
  }

  // ── Búsqueda ─────────────────────────────────────────────
  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) this.searchTerm.set(input.value);
  }

  // ── Toggle Estado Usuario ────────────────────────────────
  protected toggleUserStatus(user: UserItem): void {
    const newStatus: UserStatus = user.active ? 'INACTIVE' : 'ACTIVE';
    this.userAdminService.update(user.id, {
      status: newStatus,
      isEnabled: newStatus === 'ACTIVE'
    }).subscribe({
      next: () => {
        this.toastService.success('Estado del usuario actualizado correctamente.');
      },
      error: () => {
        this.toastService.error('Error al actualizar el estado del usuario.');
      }
    });
  }

  // ── Modal Editar/Crear ───────────────────────────────────
  protected openAddModal(): void {
    this.editingUserId.set(null);
    this.userForm = { firstName: '', lastName: '', email: '', role: UserRole.WAREHOUSE_OPERATOR, branchId: '1' };
    this.isModalOpen.set(true);
  }

  protected editUser(user: UserItem): void {
    this.editingUserId.set(user.id);
    const parts = user.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    this.userForm = { firstName, lastName, email: user.email, role: user.role, branchId: user.branchId };
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected saveUser(): void {
    if (!this.userForm.firstName || !this.userForm.email) {
      this.toastService.warning('Por favor complete todos los campos requeridos.');
      return;
    }

    const branch = this.availableBranches().find(b => b.id === this.userForm.branchId);
    const branchName = branch ? branch.name : 'Centro de Distribución CDMX';

    const userId = this.editingUserId();
    if (userId) {
      this.userAdminService.update(userId, {
        firstName: this.userForm.firstName,
        lastName: this.userForm.lastName,
        email: this.userForm.email,
        role: this.userForm.role,
        branchId: this.userForm.branchId,
        branchName: branchName
      }).subscribe({
        next: () => {
          this.toastService.success('Usuario actualizado correctamente.');
          this.closeModal();
        },
        error: (err) => {
          this.toastService.error(err.message || 'Error al actualizar el usuario.');
        }
      });
    } else {
      this.userAdminService.create({
        username: this.userForm.email.split('@')[0],
        email: this.userForm.email,
        firstName: this.userForm.firstName,
        lastName: this.userForm.lastName,
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: this.userForm.branchId,
        branchName,
        role: this.userForm.role,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false
      }).subscribe({
        next: () => {
          this.toastService.success('Usuario creado correctamente.');
          this.closeModal();
        },
        error: (err) => {
          this.toastService.error(err.message || 'Error al crear el usuario.');
        }
      });
    }
  }

  // ── HU-003: Generar Contraseña Temporal ──────────────────

  /**
   * Paso 1: El administrador hace click en "Generar Clave Temporal".
   * Muestra el diálogo de confirmación.
   */
  protected openGenerateConfirm(user: UserItem): void {
    this.confirmingUser.set(user);
  }

  /**
   * Paso 2a: El administrador cancela el diálogo.
   */
  protected onGenerateCancelled(): void {
    this.confirmingUser.set(null);
  }

  /**
   * Paso 2b: El administrador confirma.
   * Llama al servicio — PUT /api/v1/users/{id}/reset-password-temp
   */
  protected onGenerateConfirmed(): void {
    const user = this.confirmingUser();
    if (!user || this.isGenerating()) return;

    this.isGenerating.set(true);

    this.usersService.generateTemporaryPassword(user.id).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        this.confirmingUser.set(null);

        if (response.success && response.data) {
          // Paso 3: Mostrar modal premium con la contraseña
          this.tempPassword.set(response.data);
          this.tempPasswordUser.set(user);
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

  /**
   * Paso 4: El administrador cierra el modal de éxito.
   */
  protected onTempPasswordModalClosed(): void {
    this.tempPassword.set(null);
    this.tempPasswordUser.set(null);
  }

  // ── Eliminación de Usuario ───────────────────────────────

  protected openDeleteConfirm(user: UserItem): void {
    this.deletingUser.set(user);
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
        this.toastService.success('Usuario eliminado correctamente.');
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.deletingUser.set(null);
        this.toastService.error(err.message || 'Error al eliminar el usuario.');
      }
    });
  }

  /**
   * Maneja los errores HTTP del endpoint de generación de contraseña.
   */
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
