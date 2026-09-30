import { Injectable, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { UserRole } from '@4guard/shared-core';
import { UsersService } from '../../../core/services/users.service';
import { RolePermissionService } from './role-permission.service';
import { BranchService } from './branch.service';
import { ApiResponse, UserProfileDto, CreateUserRequest, UserAuditLogDto } from '../../../core/models/user.models';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

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
  private readonly roleService = inject(RolePermissionService);
  private readonly branchService = inject(BranchService);
  
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
    // 1. Resolver roleId buscando en roles cargados de la BD o en usuarios existentes
    const rawRole = (user.role || '').toString();
    const roleClean = rawRole.replace('ROLE_', '').toUpperCase();
    const foundDbRole = this.roleService.roles().find(r => 
      r.name?.toUpperCase() === roleClean || 
      r.name?.toUpperCase() === rawRole.toUpperCase() ||
      r.name?.toUpperCase() === `ROLE_${roleClean}`
    );
    let roleId = foundDbRole ? foundDbRole.id : '';

    if (!roleId) {
      const matchingRoleUser = Array.from(this.originalDtos.values()).find(dto => 
        dto.roleName?.toUpperCase() === roleClean || 
        dto.roleName?.toUpperCase() === rawRole.toUpperCase()
      );
      if (matchingRoleUser && matchingRoleUser.roleId) {
        roleId = matchingRoleUser.roleId;
      } else {
        const firstRole = this.roleService.roles()[0];
        roleId = firstRole ? firstRole.id : '88888888-8888-8888-8888-888888888888';
      }
    }

    // 2. Resolver organizationId buscando en usuarios existentes
    const firstDto = Array.from(this.originalDtos.values())[0];
    const organizationId = firstDto?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

    // 3. Resolver branchId si es un ID simulado de la UI o null
    let branchId = user.branchId;
    if (!branchId || branchId.startsWith('br-') || branchId === '1') {
      const matchingBranchUser = Array.from(this.originalDtos.values()).find(dto => dto.branchName === user.branchName);
      if (matchingBranchUser && matchingBranchUser.branchId) {
        branchId = matchingBranchUser.branchId;
      } else {
        const firstBranch = this.branchService.branches()[0];
        branchId = firstBranch ? firstBranch.id : 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
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
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Modifica un usuario existente enviando los cambios al Backend mediante PUT.
   */
  update(id: string, updatedFields: Partial<UserAdminItem> & { password?: string }): Observable<ApiResponse<UserProfileDto>> {
    const originalDto = this.originalDtos.get(id);
    if (!originalDto) {
      const existing = this.items().find(u => u.id === id);
      if (!existing) {
        return throwError(() => new Error('Usuario no encontrado.'));
      }
    }

    // Resolver branchId válido
    let branchId: string = (updatedFields.branchId !== undefined && updatedFields.branchId !== null ? updatedFields.branchId : (originalDto?.branchId || '')) || '';
    if (!branchId || branchId.startsWith('br-') || branchId === '1') {
      const firstBranch = this.branchService.branches()[0];
      branchId = firstBranch ? firstBranch.id : 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    }

    // Clonamos y aplicamos campos modificados
    const updatedDto: UserProfileDto & { password?: string } = {
      ...(originalDto || ({} as UserProfileDto)),
      id: id,
      username: updatedFields.username !== undefined ? updatedFields.username : (originalDto?.username || ''),
      firstName: updatedFields.firstName !== undefined ? updatedFields.firstName : (originalDto?.firstName || ''),
      lastName: updatedFields.lastName !== undefined ? updatedFields.lastName : (originalDto?.lastName || ''),
      email: updatedFields.email !== undefined ? updatedFields.email : (originalDto?.email || ''),
      organizationId: updatedFields.orgId !== undefined ? updatedFields.orgId : (originalDto?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935'),
      organizationName: updatedFields.orgName !== undefined ? updatedFields.orgName : (originalDto?.organizationName || '4GUARD LOGISTICS CORP'),
      branchId: branchId,
      branchName: updatedFields.branchName !== undefined ? (updatedFields.branchName || '') : (originalDto?.branchName || 'CENTRO DE DISTRIBUCION CDMX'),
      roleId: originalDto?.roleId || '88888888-8888-8888-8888-888888888888',
      roleName: originalDto?.roleName || 'OPERATIONS_MANAGER',
      status: updatedFields.status !== undefined ? updatedFields.status : (originalDto?.status || 'ACTIVE'),
      isEnabled: updatedFields.isEnabled !== undefined ? updatedFields.isEnabled : (originalDto?.isEnabled ?? true),
      lastLogin: originalDto?.lastLogin || '',
      createdAt: originalDto?.createdAt || '',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
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
      
      const foundDbRole = this.roleService.roles().find(r => r.name === updatedDto.roleName || r.name === updatedFields.role);
      if (foundDbRole) {
        updatedDto.roleId = foundDbRole.id;
      } else {
        const matchingDto = Array.from(this.originalDtos.values()).find(dto => dto.roleName === updatedDto.roleName);
        if (matchingDto) {
          updatedDto.roleId = matchingDto.roleId;
        }
      }
    }

    // Si se pasa contraseña, incluirla para que el backend la actualice
    if (updatedFields.password) {
      updatedDto.password = updatedFields.password;
    }

    return this.usersService.updateUser(updatedDto).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Actualizar caché
          this.originalDtos.set(id, response.data);
          const mapped = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? mapped : item));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
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

  getAuditLogs(userId: string): Observable<ApiResponse<UserAuditLogDto[]>> {
    return this.usersService.getUserAuditHistory(userId);
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
