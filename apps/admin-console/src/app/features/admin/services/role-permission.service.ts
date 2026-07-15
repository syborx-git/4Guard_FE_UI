import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Permission {
  id?: string;
  code: string;
  name: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  level: number; // hierarchy access
  isSystem: boolean; // system role (read-only structure)
  permissions: string[]; // array of permission codes
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface PermissionDto {
  id: string;
  name: string;
  description: string;
}

export interface RoleDto {
  id: string;
  name: string;
  level: number;
  isSystem: boolean;
  permissions: PermissionDto[];
}

const FRIENDLY_NAMES: Record<string, string> = {
  // Roles & Permissions
  'ROLES_READ': 'Lectura de Roles',
  'ROLES_CREATE': 'Creación de Roles',
  'ROLES_UPDATE': 'Edición de Roles',
  'ROLES_DELETE': 'Eliminación de Roles',
  'PERMISSIONS_READ': 'Lectura de Permisos',
  'PERMISSIONS_CREATE': 'Creación de Permisos',
  'PERMISSIONS_DELETE': 'Eliminación de Permisos',
  // Users
  'USERS_READ': 'Lectura de Usuarios',
  'USERS_CREATE': 'Creación de Usuarios',
  'USERS_UPDATE': 'Edición de Usuarios',
  'USERS_DELETE': 'Eliminación de Usuarios',
  // Inventory
  'INVENTORY_READ': 'Lectura de Inventario',
  'INVENTORY_CREATE': 'Creación de Inventario',
  'INVENTORY_UPDATE': 'Edición de Inventario',
  'INVENTORY_DELETE': 'Eliminación de Inventario',
  'INVENTORY_CONFIRM': 'Confirmación de Inventario',
  // Quality
  'QUALITY_READ': 'Lectura de Calidad',
  'QUALITY_UPDATE': 'Edición de Calidad',
  'QUALITY_CONFIRM': 'Confirmación de Calidad',
  'QUALITY_AUTHORIZE': 'Autorización de Calidad',
  // Audit
  'AUDIT_READ': 'Lectura de Auditoría',
  'AUDIT_CREATE': 'Creación de Auditoría',
  'AUDIT_EXECUTE': 'Ejecución de Auditoría',
  // Shipping
  'SHIPPING_READ': 'Lectura de Embarques',
  'SHIPPING_CREATE': 'Creación de Embarques',
  'SHIPPING_UPDATE': 'Edición de Embarques',
  'SHIPPING_CONFIRM': 'Confirmación de Embarques',
  // Receiving
  'RECEIVING_READ': 'Lectura de Recibo',
  'RECEIVING_CREATE': 'Creación de Recibo',
  'RECEIVING_UPDATE': 'Edición de Recibo',
  'RECEIVING_CONFIRM': 'Confirmación de Recibo',
  // Packing
  'PACKING_READ': 'Lectura de Empaque',
  'PACKING_CREATE': 'Creación de Empaque',
  'PACKING_UPDATE': 'Edición de Empaque',
  'PACKING_CONFIRM': 'Confirmación de Empaque',
  // Picking
  'PICKING_READ': 'Lectura de Picking',
  'PICKING_CREATE': 'Creación de Picking',
  'PICKING_UPDATE': 'Edición de Picking',
  'PICKING_CONFIRM': 'Confirmación de Picking',
  // Ramps
  'RAMPS_READ': 'Lectura de Rampas/Andenes',
  'RAMPS_CREATE': 'Creación de Rampas/Andenes',
  'RAMPS_UPDATE': 'Edición de Rampas/Andenes',
  'RAMPS_AUTHORIZE': 'Autorización de Rampas/Andenes',
  // Labels
  'LABELS_READ': 'Lectura de Etiquetas',
  'LABELS_CREATE': 'Creación de Etiquetas',
  'LABELS_EXECUTE': 'Impresión/Ejecución de Etiquetas',
  // Reports
  'REPORTS_READ': 'Lectura de Reportes',
  'REPORTS_CREATE': 'Creación de Reportes',
  'REPORTS_EXECUTE': 'Ejecución de Reportes',
  // Clients
  'CLIENTS_READ': 'Lectura de Clientes',
  'CLIENTS_CREATE': 'Creación de Clientes',
  'CLIENTS_UPDATE': 'Edición de Clientes',
  'CLIENTS_DELETE': 'Eliminación de Clientes',
  // Layout
  'LAYOUT_READ': 'Lectura de Distribución/Layout',
  'LAYOUT_UPDATE': 'Edición de Distribución/Layout',
  'LAYOUT_EXECUTE': 'Ejecución de Distribución/Layout',
  // Dashboard
  'DASHBOARD_READ': 'Lectura de Dashboard',
  'DASHBOARD_EXECUTE': 'Ejecución de Dashboard',
  // Metadata
  'METADATA_READ': 'Lectura de Metadatos',
  'METADATA_CREATE': 'Creación de Metadatos',
  'METADATA_UPDATE': 'Edición de Metadatos',
  // Operations
  'OPERATIONS_READ': 'Lectura de Operaciones',
  'OPERATIONS_CREATE': 'Creación de Operaciones',
  'OPERATIONS_UPDATE': 'Edición de Operaciones',
  'OPERATIONS_EXECUTE': 'Ejecución de Operaciones'
};

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private readonly http = inject(HttpClient);
  
  private readonly permissionList = signal<Permission[]>([]);
  private readonly roleList = signal<Role[]>([]);

  readonly permissions = this.permissionList.asReadonly();
  readonly roles = this.roleList.asReadonly();

  getAllPermissions(): Permission[] {
    return this.permissionList();
  }

  getAllRoles(): Role[] {
    return this.roleList();
  }

  /**
   * Carga paralela de roles y permisos desde el Backend.
   */
  loadRolesAndPermissions(): Observable<[ApiResponse<RoleDto[]>, ApiResponse<PermissionDto[]>]> {
    return forkJoin([
      this.http.get<ApiResponse<RoleDto[]>>(`${environment.apiBaseUrl}/api/v1/roles`),
      this.http.get<ApiResponse<PermissionDto[]>>(`${environment.apiBaseUrl}/api/v1/permissions`)
    ]).pipe(
      tap(([rolesResp, permsResp]) => {
        if (permsResp.success && permsResp.data) {
          const mappedPerms = permsResp.data.map(dto => ({
            id: dto.id,
            code: dto.name,
            name: FRIENDLY_NAMES[dto.name] || dto.name,
            description: dto.description || ''
          }));
          this.permissionList.set(mappedPerms);
        }
        if (rolesResp.success && rolesResp.data) {
          const mappedRoles = rolesResp.data.map(dto => ({
            id: dto.id,
            name: dto.name,
            level: dto.level,
            isSystem: dto.isSystem,
            permissions: dto.permissions.map(p => p.name)
          }));
          this.roleList.set(mappedRoles);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Crea un nuevo rol en el backend.
   */
  createRole(role: Omit<Role, 'id' | 'isSystem'>): Observable<ApiResponse<RoleDto>> {
    const permissionIds = role.permissions.map(code => {
      const match = this.permissionList().find(p => p.code === code);
      return match ? match.id : null;
    }).filter(id => id !== null) as string[];

    const payload = {
      name: role.name,
      level: role.level,
      isSystem: false,
      permissionIds
    };

    return this.http.post<ApiResponse<RoleDto>>(`${environment.apiBaseUrl}/api/v1/roles`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const dto = response.data;
          const newRole: Role = {
            id: dto.id,
            name: dto.name,
            level: dto.level,
            isSystem: dto.isSystem,
            permissions: dto.permissions.map(p => p.name)
          };
          this.roleList.update(list => [...list, newRole]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Modifica un rol existente en el backend.
   */
  updateRole(id: string, updatedFields: Partial<Role>): Observable<ApiResponse<RoleDto>> {
    let permissionIds: string[] | undefined;
    if (updatedFields.permissions) {
      permissionIds = updatedFields.permissions.map(code => {
        const match = this.permissionList().find(p => p.code === code);
        return match ? match.id : null;
      }).filter(id => id !== null) as string[];
    }

    const payload = {
      id: id,
      name: updatedFields.name,
      level: updatedFields.level,
      isSystem: updatedFields.isSystem ?? false,
      permissionIds
    };

    return this.http.put<ApiResponse<RoleDto>>(`${environment.apiBaseUrl}/api/v1/roles`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const dto = response.data;
          const updatedRole: Role = {
            id: dto.id,
            name: dto.name,
            level: dto.level,
            isSystem: dto.isSystem,
            permissions: dto.permissions.map(p => p.name)
          };
          this.roleList.update(list => list.map(item => item.id === id ? updatedRole : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina un rol del backend.
   */
  deleteRole(id: string): Observable<ApiResponse<void>> {
    const role = this.roleList().find(item => item.id === id);
    if (role?.isSystem) {
      return throwError(() => new Error('No se pueden eliminar roles definidos del sistema.'));
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/api/v1/roles/${id}`).pipe(
      tap(response => {
        if (response.success) {
          this.roleList.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
