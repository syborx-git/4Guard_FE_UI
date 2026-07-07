/**
 * @file users-list.component.ts
 * @description Gestión de Usuarios del sistema 4GUARD WMS.
 *
 * HU-003: Integración del endpoint PUT /api/v1/users/{id}/reset-password-temp
 *   - Flujo: Botón "Generar Clave Temporal" → Diálogo confirmación → Loading → Modal éxito
 *   - Errores: Toast discreto por código HTTP (403, 404, 500)
 *   - 401: Manejado por jwtInterceptor → redirige al Login automáticamente
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserRole, ROLE_LABELS } from '@4guard/shared-core';

import { UsersService } from '../../../core/services/users.service';
import { ToastService } from '../../../core/services/toast.service';
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
export class UsersListComponent {
  // ── Servicios ────────────────────────────────────────────
  private readonly usersService = inject(UsersService);
  private readonly toastService = inject(ToastService);

  // ── Estado: Lista de usuarios ────────────────────────────
  protected readonly users = signal<UserItem[]>([
    { id: 'afe4de7c-d10e-44b9-8970-46a0fda50626', name: 'Carlos Mendoza',  email: 'carlos.mendoza@4guard.com',  role: UserRole.ADMIN,               branchId: '1', branchName: 'Centro de Distribución Norte',  active: true  },
    { id: 'b3f1e2a0-c20f-55c0-9081-57b1geb61737', name: 'Ana Gómez',       email: 'ana.gomez@4guard.com',       role: UserRole.DOCK_SUPERVISOR,      branchId: '1', branchName: 'Centro de Distribución Norte',  active: true  },
    { id: 'c4g2f3b1-d31g-66d1-0192-68c2hfc72848', name: 'Luis Pérez',      email: 'luis.perez@4guard.com',      role: UserRole.QM_INSPECTOR,         branchId: '3', branchName: 'La Bóveda Principal',           active: true  },
    { id: 'd5h3g4c2-e42h-77e2-1203-79d3igd83959', name: 'Sofía Castro',    email: 'sofia.castro@4guard.com',    role: UserRole.WAREHOUSE_OPERATOR,   branchId: '2', branchName: 'Sucursal Metropolitana Sur',    active: true  },
    { id: 'e6i4h5d3-f53i-88f3-2314-80e4jhe94060', name: 'Jorge Rojas',     email: 'jorge.rojas@4guard.com',     role: UserRole.WAREHOUSE_OPERATOR,   branchId: '1', branchName: 'Centro de Distribución Norte',  active: false },
  ]);

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

  // ── Formulario ───────────────────────────────────────────
  protected userForm = {
    name: '',
    email: '',
    role: UserRole.WAREHOUSE_OPERATOR,
    branchId: '1'
  };

  // ── Computed ─────────────────────────────────────────────
  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.users();
    return this.users().filter(u =>
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

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
    this.users.update(list =>
      list.map(u => u.id === user.id ? { ...u, active: !u.active } : u)
    );
  }

  // ── Modal Editar/Crear ───────────────────────────────────
  protected openAddModal(): void {
    this.editingUserId.set(null);
    this.userForm = { name: '', email: '', role: UserRole.WAREHOUSE_OPERATOR, branchId: '1' };
    this.isModalOpen.set(true);
  }

  protected editUser(user: UserItem): void {
    this.editingUserId.set(user.id);
    this.userForm = { name: user.name, email: user.email, role: user.role, branchId: user.branchId };
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected saveUser(): void {
    if (!this.userForm.name || !this.userForm.email) {
      this.toastService.warning('Por favor complete todos los campos requeridos.');
      return;
    }

    const branchName =
      this.userForm.branchId === '1' ? 'Centro de Distribución Norte' :
      this.userForm.branchId === '2' ? 'Sucursal Metropolitana Sur' : 'La Bóveda Principal';

    const userId = this.editingUserId();
    if (userId) {
      this.users.update(list => list.map(u =>
        u.id === userId
          ? { ...u, name: this.userForm.name, email: this.userForm.email, role: this.userForm.role, branchId: this.userForm.branchId, branchName }
          : u
      ));
      this.toastService.success('Usuario actualizado correctamente.');
    } else {
      const newUser: UserItem = {
        id: crypto.randomUUID(),
        name: this.userForm.name,
        email: this.userForm.email,
        role: this.userForm.role,
        branchId: this.userForm.branchId,
        branchName,
        active: true
      };
      this.users.update(list => [...list, newUser]);
      this.toastService.success('Usuario creado correctamente.');
    }
    this.closeModal();
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
   *
   * Errores:
   *  401 → jwtInterceptor redirige al Login automáticamente
   *  403 → Toast: "No tienes permisos para generar contraseñas temporales."
   *  404 → Toast: "El usuario ya no existe."
   *  500 → Toast: "Error interno del servidor."
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

  /**
   * Maneja los errores HTTP del endpoint de generación de contraseña.
   * El 401 es capturado por el interceptor antes de llegar aquí.
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
