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
        id: 'usr-ale-01',
        username: 'alejandro.director',
        email: 'alejandro@4guard.com',
        firstName: 'Alejandro',
        lastName: 'Director General',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: null,
        branchName: 'Corporativo 4GUARD',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      },
      {
        id: 'usr-nor-02',
        username: 'norma.directora',
        email: 'norma@4guard.com',
        firstName: 'Norma',
        lastName: 'Directora General',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: null,
        branchName: 'Corporativo 4GUARD',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      },
      {
        id: 'usr-pab-03',
        username: 'pablo.ruiz',
        email: 'pablo.ruiz@4guard.com',
        firstName: 'Pablo',
        lastName: 'Ruiz (Gerente de Operaciones)',
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
      },
      {
        id: 'usr-jp-04',
        username: 'jp.caseta',
        email: 'jp.seguridad@4guard.com',
        firstName: 'Juan Pablo',
        lastName: 'Caseta (Vigilancia)',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
        branchName: 'CEDIS Toluca',
        role: UserRole.SECURITY_GUARD,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      },
      {
        id: 'usr-alex-05',
        username: 'alex.perez',
        email: 'alex.perez@4guard.com',
        firstName: 'Alex Gabriel',
        lastName: 'Pérez Garduño (Montacarguista)',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
        branchName: 'CEDIS Toluca',
        role: UserRole.WAREHOUSE_OPERATOR,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      },
      {
        id: 'usr-qm-06',
        username: 'maria.calidad',
        email: 'calidad@4guard.com',
        firstName: 'María Fernanda',
        lastName: 'López (Inspectora QM)',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
        branchName: 'CEDIS Toluca',
        role: UserRole.QM_INSPECTOR,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: false,
        failedAttempts: 0,
        lockedUntil: null,
        permanentlyLocked: false,
        lastLoginAt: new Date()
      },
      {
        id: 'usr-ch-07',
        username: 'christian.duran',
        email: 'cduran@4guard.com',
        firstName: 'Christian',
        lastName: 'Durán (Supervisor WMS)',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
        branchName: 'CEDIS Toluca',
        role: UserRole.OPERATIONS_SUPERVISOR,
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
