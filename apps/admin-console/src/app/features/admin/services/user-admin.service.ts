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
  
  private readonly items = signal<UserAdminItem[]>(this.getDefaultSeedUsers());
  readonly users = this.items.asReadonly();

  getAll(): UserAdminItem[] {
    return this.items();
  }

  public removeLocalUser(userId: string): void {
    this.items.update(list => list.filter(u => u.id !== userId));
  }

  public resetToEnriqueOnly(): void {
    this.items.set(this.getDefaultSeedUsers());
  }

  /**
   * Carga los usuarios desde el Backend y actualiza el signal reactivo.
   * Cuenta con respaldo defensivo con los colaboradores de 4GUARD si el token
   * expira en local o si el backend no responde.
   */
  loadUsers(): Observable<ApiResponse<UserProfileDto[]>> {
    return this.usersService.getUsers().pipe(
      tap(response => {
        if (response.success && response.data && response.data.length > 0) {
          this.originalDtos.clear();
          const mapped = response.data.map(dto => {
            this.originalDtos.set(dto.id, dto);
            return this.mapDtoToItem(dto);
          });
          this.items.set(mapped);
        }
      }),
      catchError((err) => {
        // En desarrollo local o error de token JWT, mantener el directorio operativo de 4GUARD
        if (this.items().length === 0) {
          this.items.set(this.getDefaultSeedUsers());
        }
        return of({
          success: true,
          message: 'Directorio cargado con respaldo operativo 4GUARD',
          data: [] as UserProfileDto[],
          timestamp: new Date().toISOString()
        });
      })
    );
  }

  create(user: Omit<UserAdminItem, 'id' | 'lastLoginAt'> & { password?: string }): Observable<ApiResponse<UserProfileDto>> {
    // 1. Resolver roleId buscando en roles cargados de la BD o en roles canónicos con coincidencia semántica
    const rawRole = (user.role || '').toString();
    const roleClean = rawRole.replace('ROLE_', '').toUpperCase();

    let foundDbRole = this.roleService.roles().find(r => 
      r.name?.toUpperCase() === roleClean || 
      r.name?.toUpperCase() === rawRole.toUpperCase() ||
      r.name?.toUpperCase() === `ROLE_${roleClean}`
    );

    if (!foundDbRole) {
      if (roleClean.includes('QUALITY_ASSIST') || roleClean.includes('AYUDANTE_CALIDAD')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('QUALITY_ASSISTANT') || r.id === '88888888-8888-8888-8888-88888888888a');
      } else if (roleClean.includes('QM') || roleClean.includes('QUALIT') || roleClean.includes('CALIDAD') || roleClean.includes('INSPECT')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('QM_INSPECTOR') || r.name?.includes('QUALITY') || r.id === '88888888-8888-8888-8888-888888888888');
      } else if (roleClean.includes('SECURITY_ASSIST') || roleClean.includes('AYUDANTE_SEGURIDAD')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('SECURITY_ASSISTANT') || r.id === '99999999-9999-9999-9999-99999999999a');
      } else if (roleClean.includes('SECURITY') || roleClean.includes('VIGILAN') || roleClean.includes('GUARD') || roleClean.includes('CASETA')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('SECURITY_GUARD') || r.id === '99999999-9999-9999-9999-999999999999');
      } else if (roleClean.includes('OPERATIONS_MANAGER') || roleClean.includes('GERENTE')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('OPERATIONS_MANAGER') || r.id === '22222222-2222-2222-2222-222222222222');
      } else if (roleClean.includes('COORDINAT') || roleClean.includes('COORDINADOR')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('OPERATIONS_COORDINATOR') || r.id === '33333333-3333-3333-3333-333333333333');
      } else if (roleClean.includes('SUPERVIS')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('OPERATIONS_SUPERVISOR') || r.id === '44444444-4444-4444-4444-444444444444');
      } else if (roleClean.includes('CONTROL_DESK') || roleClean.includes('MESA')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('CONTROL_DESK') || r.id === '55555555-5555-5555-5555-555555555555');
      } else if (roleClean.includes('SHIFT') || roleClean.includes('LIDER')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('SHIFT_LEADER') || r.id === '66666666-6666-6666-6666-666666666666');
      } else if (roleClean.includes('ADMIN') || roleClean.includes('DIRECTOR')) {
        foundDbRole = this.roleService.roles().find(r => r.name?.includes('ADMIN') || r.id === '11111111-1111-1111-1111-111111111111');
      }
    }

    let roleId = foundDbRole ? foundDbRole.id : '';
    if (!roleId) {
      if (roleClean.includes('QUALIT') || roleClean.includes('QM') || roleClean.includes('CALIDAD')) {
        roleId = '88888888-8888-8888-8888-888888888888';
      } else if (roleClean.includes('SECURITY') || roleClean.includes('GUARD') || roleClean.includes('VIGILAN')) {
        roleId = '99999999-9999-9999-9999-999999999999';
      } else if (roleClean.includes('OPERATIONS_MANAGER') || roleClean.includes('GERENTE')) {
        roleId = '22222222-2222-2222-2222-222222222222';
      } else {
        roleId = '11111111-1111-1111-1111-111111111111';
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
          if (!response.data.roleName && roleClean) {
            response.data.roleName = roleClean;
          }
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
          if (!response.data.roleName && updatedDto.roleName) {
            response.data.roleName = updatedDto.roleName;
          }
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
    let resolvedRole = dto.roleName || (dto as any).role;
    if (!resolvedRole && dto.roleId) {
      const found = this.roleService.roles().find(r => r.id === dto.roleId);
      if (found) {
        resolvedRole = found.name;
      }
    }
    if (!resolvedRole) {
      resolvedRole = 'QM_INSPECTOR';
    }
    const cleanRole = resolvedRole.replace('ROLE_', '');
    const fullRole = `ROLE_${cleanRole}` as UserRole;

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
      role: fullRole,
      status: (dto.status || 'ACTIVE') as UserStatus,
      isEnabled: dto.isEnabled ?? true,
      changePasswordRequired: false,
      failedAttempts: 0,
      lockedUntil: null,
      permanentlyLocked: dto.status === 'SUSPENDED',
      lastLoginAt: dto.lastLogin ? new Date(dto.lastLogin) : null
    };
  }

  private getDefaultSeedUsers(): UserAdminItem[] {
    return [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        username: 'enrique.architect',
        email: 'enrique@4guard.com',
        firstName: 'Enrique',
        lastName: 'Architect',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
        branchName: 'CEDIS Toluca',
        role: UserRole.OPERATIONS_MANAGER,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      }
    ];
  }
}
