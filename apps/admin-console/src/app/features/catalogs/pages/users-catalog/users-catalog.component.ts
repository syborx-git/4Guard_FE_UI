/**
 * @file users-catalog.component.ts
 * @description Catálogo de Usuarios en 4GUARD WMS.
 * Jerarquía de Pestañas: 1. Alta de Usuarios -> 2. Baja de Usuarios -> 3. Consulta / Modificar.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { CatalogsService } from '../../services/catalogs.service';
import { CatalogUser, USER_ROLES, UserRoleOption } from '../../models/users-catalog.models';

type UserSubTab = 'create' | 'inactivate' | 'consult';

@Component({
  selector: 'fg-users-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-catalog.component.html',
  styleUrl: './users-catalog.component.css',
})
export class UsersCatalogComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly fb = inject(FormBuilder);

  // Jerarquía: Alta por defecto
  protected readonly activeTab = signal<UserSubTab>('create');

  // Filtros de Consulta
  protected readonly roleFilter = signal<string>('ALL');
  protected readonly statusFilter = signal<string>('ALL');
  protected readonly searchTerm = signal<string>('');

  // Modales
  protected readonly selectedUserForAudit = signal<CatalogUser | null>(null);
  protected readonly selectedUserForPassword = signal<CatalogUser | null>(null);

  // Alertas / Mensajes de Feedback
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario Alta de Usuarios
  protected readonly userForm = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastNamePaterno: ['', [Validators.required, Validators.minLength(2)]],
      lastNameMaterno: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.minLength(4)]],
      role: ['FORKLIFT_DRIVER', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (control: AbstractControl) => {
        const pwd = control.get('password')?.value;
        const cpwd = control.get('confirmPassword')?.value;
        return pwd && cpwd && pwd !== cpwd ? { passwordMismatch: true } : null;
      },
    }
  );

  // Formulario Cambiar Contraseña
  protected readonly passwordResetForm = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    {
      validators: (control: AbstractControl) => {
        const pwd = control.get('newPassword')?.value;
        const cpwd = control.get('confirmNewPassword')?.value;
        return pwd && cpwd && pwd !== cpwd ? { passwordMismatch: true } : null;
      },
    }
  );

  protected readonly availableRoles: UserRoleOption[] = USER_ROLES;

  // Usuarios Filtrados
  protected readonly filteredUsers = computed(() => {
    const list = this.catalogsService.users();
    const rFilter = this.roleFilter();
    const sFilter = this.statusFilter();
    const query = this.searchTerm().toLowerCase().trim();

    return list.filter((u) => {
      const matchRole = rFilter === 'ALL' || u.role === rFilter;
      const matchStatus = sFilter === 'ALL' || u.status === sFilter;
      const matchQuery =
        !query ||
        u.fullName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        u.roleLabel.toLowerCase().includes(query);

      return matchRole && matchStatus && matchQuery;
    });
  });

  onSubmitCreateUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const val = this.userForm.value;
    this.catalogsService.createUser({
      firstName: val.firstName!,
      lastNamePaterno: val.lastNamePaterno!,
      lastNameMaterno: val.lastNameMaterno!,
      username: val.username!,
      role: val.role!,
      password: val.password!,
    });

    this.userForm.reset({ role: 'FORKLIFT_DRIVER' });
    this.showToast('success', `Usuario ${val.username} creado exitosamente.`);
    this.activeTab.set('consult');
  }

  onToggleStatus(user: CatalogUser): void {
    const newStatus = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.catalogsService.updateUserStatus(user.id, newStatus);
    this.showToast(
      'success',
      `Estatus del usuario ${user.username} cambiado a ${newStatus}.`
    );
  }

  openAuditModal(user: CatalogUser): void {
    this.selectedUserForAudit.set(user);
  }

  closeAuditModal(): void {
    this.selectedUserForAudit.set(null);
  }

  openPasswordModal(user: CatalogUser): void {
    this.selectedUserForPassword.set(user);
    this.passwordResetForm.reset();
  }

  closePasswordModal(): void {
    this.selectedUserForPassword.set(null);
  }

  onSubmitPasswordReset(): void {
    if (this.passwordResetForm.invalid || !this.selectedUserForPassword()) {
      this.passwordResetForm.markAllAsTouched();
      return;
    }

    const user = this.selectedUserForPassword()!;
    this.catalogsService.resetUserPassword(user.id);
    this.showToast('success', `Contraseña restablecida exitosamente para ${user.username}.`);
    this.closePasswordModal();
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
