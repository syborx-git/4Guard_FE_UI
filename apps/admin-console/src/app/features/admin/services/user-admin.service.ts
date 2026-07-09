import { Injectable, signal, inject } from '@angular/core';
import { UserRole } from '@4guard/shared-core';
import { UsersService } from '../../../core/services/users.service';
import { ApiResponse, UserProfileDto, CreateUserRequest } from '../../../core/models/user.models';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

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
  private readonly usersService = inject(UsersService);
  
  // Caching de DTOs originales para mantener campos no editables al hacer PUT
  private readonly originalDtos = new Map<string, UserProfileDto>();
  
  private readonly items = signal<UserAdminItem[]>([]);
  readonly users = this.items.asReadonly();

  getAll(): UserAdminItem[] {
    return this.items();
  }

  /**
   * Carga los usuarios desde el Backend y actualiza el signal reactivo.
   */
  loadUsers(): Observable<ApiResponse<UserProfileDto[]>> {
    return this.usersService.getUsers().pipe(
      tap(response => {
        if (response.success && response.data) {
          this.originalDtos.clear();
          const mapped = response.data.map(dto => {
            this.originalDtos.set(dto.id, dto);
            return this.mapDtoToItem(dto);
          });
          this.items.set(mapped);
        }
      })
    );
  }

  create(user: Omit<UserAdminItem, 'id' | 'lastLoginAt'> & { password?: string }): Observable<ApiResponse<UserProfileDto>> {
    // 1. Resolver roleId buscando en los usuarios cargados
    const roleName = user.role.replace('ROLE_', '');
    let roleId = '88888888-8888-8888-8888-888888888888'; // fallback
    const matchingRoleUser = Array.from(this.originalDtos.values()).find(dto => dto.roleName === roleName);
    if (matchingRoleUser) {
      roleId = matchingRoleUser.roleId;
    }

    // 2. Resolver organizationId buscando en usuarios existentes
    const firstDto = Array.from(this.originalDtos.values())[0];
    const organizationId = firstDto?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

    // 3. Resolver branchId si es un ID simulado de la UI o null
    let branchId = user.branchId;
    if (!branchId || branchId.startsWith('br-') || branchId === '1') {
      const matchingBranchUser = Array.from(this.originalDtos.values()).find(dto => dto.branchName === user.branchName);
      if (matchingBranchUser) {
        branchId = matchingBranchUser.branchId;
      } else {
        branchId = 'b73f0907-9fa5-4bdf-87db-2eb5e7683936'; // fallback del curl
      }
    }

    // 4. Resolver username si no viene especificado
    const username = user.username || user.email.split('@')[0];

    const payload: CreateUserRequest = {
      username,
      email: user.email,
      password: user.password || 'admin123',
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId,
      branchId,
      roleId,
      status: user.status || 'ACTIVE',
      isEnabled: user.isEnabled !== undefined ? user.isEnabled : true
    };

    return this.usersService.createUser(payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.originalDtos.set(response.data.id, response.data);
          const mapped = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, mapped]);
        }
      })
    );
  }

  /**
   * Modifica un usuario existente enviando los cambios al Backend mediante PUT.
   */
  update(id: string, updatedFields: Partial<UserAdminItem>): Observable<ApiResponse<UserProfileDto>> {
    const originalDto = this.originalDtos.get(id);
    if (!originalDto) {
      return throwError(() => new Error('Usuario no encontrado en el caché de la aplicación.'));
    }

    // Clonamos y aplicamos campos modificados
    const updatedDto: UserProfileDto = {
      ...originalDto,
      firstName: updatedFields.firstName !== undefined ? updatedFields.firstName : originalDto.firstName,
      lastName: updatedFields.lastName !== undefined ? updatedFields.lastName : originalDto.lastName,
      email: updatedFields.email !== undefined ? updatedFields.email : originalDto.email,
      organizationId: updatedFields.orgId !== undefined ? updatedFields.orgId : originalDto.organizationId,
      organizationName: updatedFields.orgName !== undefined ? updatedFields.orgName : originalDto.organizationName,
      branchId: updatedFields.branchId !== undefined ? (updatedFields.branchId || '') : originalDto.branchId,
      branchName: updatedFields.branchName !== undefined ? (updatedFields.branchName || '') : originalDto.branchName,
      status: updatedFields.status !== undefined ? updatedFields.status : originalDto.status,
      isEnabled: updatedFields.isEnabled !== undefined ? updatedFields.isEnabled : originalDto.isEnabled
    };

    // Sincronizar isEnabled y status
    if (updatedFields.status !== undefined) {
      updatedDto.isEnabled = (updatedFields.status === 'ACTIVE');
    } else if (updatedFields.isEnabled !== undefined) {
      updatedDto.status = updatedFields.isEnabled ? 'ACTIVE' : 'INACTIVE';
    }

    // Mapear rol si cambió
    if (updatedFields.role !== undefined) {
      updatedDto.roleName = updatedFields.role.replace('ROLE_', '');
      
      // Buscar si existe otra cuenta con este mismo rol para reutilizar el roleId
      const matchingDto = Array.from(this.originalDtos.values()).find(dto => dto.roleName === updatedDto.roleName);
      if (matchingDto) {
        updatedDto.roleId = matchingDto.roleId;
      }
    }

    return this.usersService.updateUser(updatedDto).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Actualizar caché
          this.originalDtos.set(id, response.data);
          const mapped = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? mapped : item));
        }
      })
    );
  }

  delete(id: string): Observable<ApiResponse<void>> {
    return this.usersService.deleteUser(id).pipe(
      tap(response => {
        if (response.success) {
          this.originalDtos.delete(id);
          this.items.update(list => list.filter(item => item.id !== id));
        }
      })
    );
  }

  resetFailedAttempts(id: string): Observable<ApiResponse<UserProfileDto>> {
    return this.update(id, {
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: false,
      status: 'ACTIVE',
      isEnabled: true
    });
  }

  unlockAccount(id: string): Observable<ApiResponse<UserProfileDto>> {
    return this.update(id, {
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: false,
      status: 'ACTIVE',
      isEnabled: true
    });
  }

  private mapDtoToItem(dto: UserProfileDto): UserAdminItem {
    return {
      id: dto.id,
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      orgId: dto.organizationId,
      orgName: dto.organizationName || '4GUARD LOGISTICS CORP',
      branchId: dto.branchId || null,
      branchName: dto.branchName || 'Corporativo',
      role: dto.roleName as UserRole,
      status: dto.status as UserStatus,
      isEnabled: dto.isEnabled,
      changePasswordRequired: false,
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: dto.status === 'SUSPENDED',
      lastLoginAt: dto.lastLogin ? new Date(dto.lastLogin) : null
    };
  }
}
