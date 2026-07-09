import { Injectable, signal } from '@angular/core';
import { UserRole } from '@4guard/shared-core';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

export interface UserAdminItem {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  branchId: string | null; // null for corporate access
  branchName: string | null;
  role: UserRole;
  status: UserStatus;
  isEnabled: boolean;
  changePasswordRequired: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  permanentlyLocked: boolean;
  lastLoginAt: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserAdminService {
  private readonly items = signal<UserAdminItem[]>([
    {
      id: 'usr-1',
      username: 'enrique',
      email: 'enrique@4guard.com',
      firstName: 'Enrique',
      lastName: 'García',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      branchId: null,
      branchName: 'Corporativo',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      isEnabled: true,
      changePasswordRequired: false,
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: false,
      lastLoginAt: new Date('2026-07-06T22:10:00')
    },
    {
      id: 'usr-2',
      username: 'carlos.mendoza',
      email: 'carlos.mendoza@4guard.com',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      branchId: 'br-1',
      branchName: 'Centro de Distribución Norte',
      role: UserRole.DOCK_SUPERVISOR,
      status: 'ACTIVE',
      isEnabled: true,
      changePasswordRequired: false,
      failedAttempts: 3,
      lockedUntil: new Date(Date.now() + 3600000), // locked for 1 hour
      permanentlyLocked: false,
      lastLoginAt: new Date('2026-07-05T18:45:00')
    },
    {
      id: 'usr-3',
      username: 'jorge.rojas',
      email: 'jorge.rojas@4guard.com',
      firstName: 'Jorge',
      lastName: 'Rojas',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      branchId: 'br-2',
      branchName: 'Sucursal Metropolitana Sur',
      role: UserRole.WAREHOUSE_OPERATOR,
      status: 'SUSPENDED',
      isEnabled: false,
      changePasswordRequired: true,
      failedAttempts: 5,
      lockedUntil: null,
      permanentlyLocked: true,
      lastLoginAt: new Date('2026-06-30T10:15:00')
    },
    {
      id: 'usr-4',
      username: 'ana.gomez',
      email: 'ana.gomez@4guard.com',
      firstName: 'Ana',
      lastName: 'Gómez',
      orgId: 'org-2',
      orgName: 'Omni Retail Corp',
      branchId: 'br-3',
      branchName: 'Almacén de Tránsito Pacífico',
      role: UserRole.QM_INSPECTOR,
      status: 'ACTIVE',
      isEnabled: true,
      changePasswordRequired: false,
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: false,
      lastLoginAt: new Date('2026-07-06T15:20:00')
    }
  ]);

  readonly users = this.items.asReadonly();

  getAll(): UserAdminItem[] {
    return this.items();
  }

  create(user: Omit<UserAdminItem, 'id' | 'lastLoginAt'> & { password?: string }): void {
    const newUser: UserAdminItem = {
      ...user,
      id: `usr-${Date.now()}`,
      lastLoginAt: null
    };
    this.items.update(list => [...list, newUser]);
  }

  update(id: string, updatedFields: Partial<UserAdminItem>): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, ...updatedFields } : item
    ));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }

  resetFailedAttempts(id: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, failedAttempts: 0, lockedUntil: null, permanentlyLocked: false } : item
    ));
  }

  unlockAccount(id: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, failedAttempts: 0, lockedUntil: null, permanentlyLocked: false, status: 'ACTIVE' } : item
    ));
  }
}
