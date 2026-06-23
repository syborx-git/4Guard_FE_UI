/**
 * @file users-list.component.ts
 * @description Gestión de usuarios del sistema 4GUARD WMS.
 */

import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserRole, ROLE_LABELS } from '@4guard/shared-core';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css'
})
export class UsersListComponent {
  protected readonly users = signal<UserItem[]>([
    { id: '101', name: 'Carlos Mendoza', email: 'carlos.mendoza@4guard.com', role: UserRole.ADMIN, branchId: '1', branchName: 'Centro de Distribución Norte', active: true },
    { id: '102', name: 'Ana Gómez', email: 'ana.gomez@4guard.com', role: UserRole.DOCK_SUPERVISOR, branchId: '1', branchName: 'Centro de Distribución Norte', active: true },
    { id: '103', name: 'Luis Pérez', email: 'luis.perez@4guard.com', role: UserRole.QM_INSPECTOR, branchId: '3', branchName: 'La Bóveda Principal', active: true },
    { id: '104', name: 'Sofía Castro', email: 'sofia.castro@4guard.com', role: UserRole.WAREHOUSE_OPERATOR, branchId: '2', branchName: 'Sucursal Metropolitana Sur', active: true },
    { id: '105', name: 'Jorge Rojas', email: 'jorge.rojas@4guard.com', role: UserRole.WAREHOUSE_OPERATOR, branchId: '1', branchName: 'Centro de Distribución Norte', active: false }
  ]);

  protected readonly searchTerm = signal('');
  protected readonly isModalOpen = signal(false);
  protected readonly editingUserId = signal<string | null>(null);

  protected userForm = {
    name: '',
    email: '',
    role: UserRole.WAREHOUSE_OPERATOR,
    branchId: '1'
  };

  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.users();
    return this.users().filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term)
    );
  });

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.searchTerm.set(input.value);
    }
  }

  protected getRoleLabel(role: UserRole): string {
    return ROLE_LABELS[role] || role;
  }

  protected getRoleClass(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return 'role-admin';
      case UserRole.DOCK_SUPERVISOR:
      case UserRole.QM_INSPECTOR:
        return 'role-supervisor';
      default:
        return 'role-operator';
    }
  }

  protected toggleUserStatus(user: UserItem): void {
    this.users.update(list => list.map(u => 
      u.id === user.id ? { ...u, active: !u.active } : u
    ));
  }

  protected openAddModal(): void {
    this.editingUserId.set(null);
    this.userForm = {
      name: '',
      email: '',
      role: UserRole.WAREHOUSE_OPERATOR,
      branchId: '1'
    };
    this.isModalOpen.set(true);
  }

  protected editUser(user: UserItem): void {
    this.editingUserId.set(user.id);
    this.userForm = {
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    };
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected saveUser(): void {
    if (!this.userForm.name || !this.userForm.email) {
      alert('Por favor complete todos los campos requeridos.');
      return;
    }

    const branchName = this.userForm.branchId === '1' ? 'Centro de Distribución Norte' :
                       this.userForm.branchId === '2' ? 'Sucursal Metropolitana Sur' : 'La Bóveda Principal';

    const userId = this.editingUserId();
    if (userId) {
      // Edit mode
      this.users.update(list => list.map(u => 
        u.id === userId ? {
          ...u,
          name: this.userForm.name,
          email: this.userForm.email,
          role: this.userForm.role,
          branchId: this.userForm.branchId,
          branchName
        } : u
      ));
    } else {
      // Add mode
      const newUser: UserItem = {
        id: String(Date.now()),
        name: this.userForm.name,
        email: this.userForm.email,
        role: this.userForm.role,
        branchId: this.userForm.branchId,
        branchName,
        active: true
      };
      this.users.update(list => [...list, newUser]);
    }

    this.closeModal();
  }
}
