/**
 * @file role-permission.service.ts
 * @description Servicio de gestión de Roles y Matriz de Permisos (RBAC).
 * Integrado con el Backend mediante HTTP siguiendo el patrón estándar de 4GUARD WMS.
 *
 * Endpoints REST:
 *   GET    /api/v1/roles                       — Listar todos los roles con sus permisos
 *   GET    /api/v1/roles/{id}                  — Obtener rol por ID
 *   POST   /api/v1/roles                       — Crear nuevo rol
 *   PUT    /api/v1/roles                       — Actualizar rol (Nombre, Nivel, Permisos)
 *   PUT    /api/v1/roles/{id}/permissions       — Asignar/Reemplazar matriz de permisos
 *   GET    /api/v1/roles/{id}/audit            — Bitácora de auditoría BE de rol [NUEVO]
 *   DELETE /api/v1/roles/{id}                  — Eliminar rol
 *   GET    /api/v1/permissions                 — Catálogo completo de permisos
 *   GET    /api/v1/permissions/{id}            — Obtener permiso por ID
 *   GET    /api/v1/permissions/{id}/audit      — Bitácora de auditoría BE de permiso [NUEVO]
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  RoleAuditLog,
  PermissionAuditLog,
  ApiResponse,
  getPermissionModuleGroup,
  getRoleAuditIcon,
  getRoleAuditColor,
  getRoleAuditSummary,
} from '../roles/models/role-permission.model';

export type {
  Permission,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  RoleAuditLog,
  PermissionAuditLog,
  ApiResponse,
};

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private readonly http = inject(HttpClient);

  private readonly permissionList = signal<Permission[]>([]);
  private readonly roleList       = signal<Role[]>([]);

  // ─── Signals Reactivos de Estado ─────────────────────────────────────────────

  readonly permissions = this.permissionList.asReadonly();
  readonly roles       = this.roleList.asReadonly();
  readonly loading     = signal<boolean>(false);
  readonly saving      = signal<boolean>(false);
  readonly loadError   = signal<string | null>(null);

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  readonly totalCount       = computed(() => this.roleList().length);
  readonly systemRolesCount = computed(() => this.roleList().filter(r => r.isSystem).length);
  readonly customRolesCount = computed(() => this.roleList().filter(r => !r.isSystem).length);

  getAllPermissions(): Permission[] {
    return this.permissionList();
  }

  getAllRoles(): Role[] {
    return this.roleList();
  }

  /**
   * Carga paralela de roles y permisos desde el Backend.
   */
  loadRolesAndPermissions(): Observable<[ApiResponse<Role[]>, ApiResponse<Permission[]>]> {
    this.loading.set(true);
    this.loadError.set(null);

    return forkJoin([
      this.http.get<ApiResponse<any[]>>(`${environment.apiBaseUrl}/api/v1/roles`),
      this.http.get<ApiResponse<any[]>>(`${environment.apiBaseUrl}/api/v1/permissions`)
    ]).pipe(
      tap(([rolesResp, permsResp]) => {
        this.loading.set(false);

        // 1. Mapear catálogo de permisos
        const permsData = permsResp.data || (Array.isArray(permsResp) ? permsResp : []);
        const mappedPerms: Permission[] = permsData.map(dto => ({
          id: dto.id,
          name: dto.name,
          description: dto.description || '',
          createdAt: dto.createdAt || new Date().toISOString(),
          moduleGroup: getPermissionModuleGroup(dto.name)
        }));
        this.permissionList.set(mappedPerms);

        // 2. Mapear roles con sus objetos Permission[] integrados
        const rolesData = rolesResp.data || (Array.isArray(rolesResp) ? rolesResp : []);
        const mappedRoles: Role[] = rolesData.map(dto => this.mapRoleDto(dto, mappedPerms));
        this.roleList.set(mappedRoles);
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        const msg = error?.error?.message || error?.message || 'Error al cargar roles y permisos del servidor.';
        this.loadError.set(msg);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene un rol por su ID.
   */
  getRoleById(id: string): Observable<ApiResponse<Role>> {
    return this.http.get<ApiResponse<any>>(`${environment.apiBaseUrl}/api/v1/roles/${id}`).pipe(
      map(res => {
        const dto = res.data || res;
        const role = this.mapRoleDto(dto, this.permissionList());
        return { ...res, data: role };
      })
    );
  }

  /**
   * Crea un nuevo rol en el Backend.
   */
  createRole(roleReq: CreateRoleRequest): Observable<ApiResponse<Role>> {
    this.saving.set(true);

    const payload = {
      name: roleReq.name.trim().toUpperCase(),
      level: Number(roleReq.level),
      permissionIds: roleReq.permissionIds || []
    };

    return this.http.post<ApiResponse<any>>(`${environment.apiBaseUrl}/api/v1/roles`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const dto = response.data || (response as any);
        if (dto && dto.id) {
          const newRole = this.mapRoleDto(dto, this.permissionList());
          this.roleList.update(list => [...list, newRole]);
        } else {
          this.loadRolesAndPermissions().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Modifica un rol existente en el Backend (Nombre, Nivel y/o Permisos).
   */
  updateRole(id: string, roleReq: UpdateRoleRequest): Observable<ApiResponse<Role>> {
    this.saving.set(true);

    const payload = {
      id: id,
      name: roleReq.name.trim().toUpperCase(),
      level: Number(roleReq.level),
      permissionIds: roleReq.permissionIds || []
    };

    return this.http.put<ApiResponse<any>>(`${environment.apiBaseUrl}/api/v1/roles`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const dto = response.data || (response as any);
        if (dto && dto.id) {
          const updatedRole = this.mapRoleDto(dto, this.permissionList());
          this.roleList.update(list => list.map(item => item.id === id ? updatedRole : item));
        } else {
          this.loadRolesAndPermissions().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Asigna / Reemplaza directamente el arreglo de permisos a un rol.
   * Endpoint: PUT /api/v1/roles/{id}/permissions
   */
  assignPermissions(roleId: string, permissionIds: string[]): Observable<ApiResponse<Role>> {
    this.saving.set(true);
    const url = `${environment.apiBaseUrl}/api/v1/roles/${roleId}/permissions`;

    return this.http.put<ApiResponse<any>>(url, permissionIds).pipe(
      tap(response => {
        this.saving.set(false);
        const dto = response.data || (response as any);
        if (dto && dto.id) {
          const updatedRole = this.mapRoleDto(dto, this.permissionList());
          this.roleList.update(list => list.map(item => item.id === roleId ? updatedRole : item));
        } else {
          this.loadRolesAndPermissions().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina un rol del Backend.
   */
  deleteRole(id: string): Observable<ApiResponse<void>> {
    const role = this.roleList().find(item => item.id === id);
    if (role?.isSystem) {
      return throwError(() => new Error('No se pueden eliminar roles definidos del sistema.'));
    }

    this.saving.set(true);
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/api/v1/roles/${id}`).pipe(
      tap(() => {
        this.saving.set(false);
        this.roleList.update(list => list.filter(item => item.id !== id));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el historial de auditoría de un rol desde la API Backend.
   * Endpoint: GET /api/v1/roles/{id}/audit
   */
  getRoleAudit(roleId: string): Observable<ApiResponse<RoleAuditLog[]>> {
    const url = `${environment.apiBaseUrl}/api/v1/roles/${roleId}/audit`;

    return this.http.get<ApiResponse<RoleAuditLog[]>>(url).pipe(
      map(res => {
        const rawList = res.data || (Array.isArray(res) ? res : []);
        const formattedData: RoleAuditLog[] = rawList.map((item: any) => {
          const actionStr = item.action || 'ROLE_UPDATED';
          return {
            id: item.logId || item.id || String(Math.random()),
            action: actionStr,
            performedBy: item.username || item.performedBy || 'enrique',
            performedAt: item.createdAt || item.performedAt || new Date().toISOString(),
            summary: getRoleAuditSummary(actionStr),
            timelineIcon: getRoleAuditIcon(actionStr),
            timelineColor: getRoleAuditColor(actionStr),
            details: item.details || []
          };
        });
        return {
          status: res.status || 200,
          message: res.message || 'Auditoría recuperada',
          data: formattedData
        };
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error al recuperar historial de auditoría del rol:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Mapea un DTO de Rol convirtiendo permissions DTO/strings en objetos Permission[].
   */
  private mapRoleDto(dto: any, allPerms: Permission[]): Role {
    let permissions: Permission[] = [];

    if (Array.isArray(dto.permissions)) {
      permissions = dto.permissions.map((p: any) => {
        if (typeof p === 'string') {
          const found = allPerms.find(item => item.name === p || item.id === p);
          return found ? found : { id: p, name: p, description: p, moduleGroup: getPermissionModuleGroup(p) };
        } else {
          return {
            id: p.id,
            name: p.name,
            description: p.description || '',
            createdAt: p.createdAt,
            moduleGroup: getPermissionModuleGroup(p.name)
          };
        }
      });
    }

    return {
      id: dto.id,
      name: dto.name,
      level: dto.level ?? 3,
      isSystem: dto.isSystem ?? false,
      permissions: permissions,
      version: dto.version || 1,
      createdAt: dto.createdAt || new Date().toISOString(),
      updatedAt: dto.updatedAt || new Date().toISOString(),
      createdBy: dto.createdBy || 'Sistema',
      updatedBy: dto.updatedBy || 'Sistema'
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
