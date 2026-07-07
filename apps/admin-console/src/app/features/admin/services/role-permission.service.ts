import { Injectable, signal } from '@angular/core';

export interface Permission {
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

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private readonly permissionList = signal<Permission[]>([
    { code: 'user:read', name: 'Lectura de Usuarios', description: 'Permite listar y ver detalles de usuarios en el sistema.' },
    { code: 'user:write', name: 'Escritura de Usuarios', description: 'Permite crear, modificar y bloquear usuarios.' },
    { code: 'inventory:read', name: 'Lectura de Inventario', description: 'Permite consultar el stock activo y el historial de movimientos.' },
    { code: 'inventory:write', name: 'Control de Inventario', description: 'Permite realizar ajustes de inventario y reubicaciones.' },
    { code: 'quality:write', name: 'Operación de Calidad', description: 'Permite liberar o retener mercancía (poner en cuarentena) e ingresar incidencias.' },
    { code: 'audit:read', name: 'Bitácora de Auditoría', description: 'Acceso a la consola forense de auditoría de seguridad y logs.' },
    { code: 'config:write', name: 'Configuraciones de WMS', description: 'Permite modificar configuraciones globales de organizaciones, sucursales y secciones.' }
  ]);

  private readonly roleList = signal<Role[]>([
    {
      id: 'rol-1',
      name: 'Administrador del Sistema (ADMIN)',
      level: 100,
      isSystem: true,
      permissions: ['user:read', 'user:write', 'inventory:read', 'inventory:write', 'quality:write', 'audit:read', 'config:write']
    },
    {
      id: 'rol-2',
      name: 'Supervisor de Embarques (DOCK_SUPERVISOR)',
      level: 50,
      isSystem: false,
      permissions: ['inventory:read', 'inventory:write', 'quality:write']
    },
    {
      id: 'rol-3',
      name: 'Inspector de Calidad (QM_INSPECTOR)',
      level: 40,
      isSystem: false,
      permissions: ['inventory:read', 'quality:write']
    },
    {
      id: 'rol-4',
      name: 'Operador de Almacén (WAREHOUSE_OPERATOR)',
      level: 10,
      isSystem: true,
      permissions: ['inventory:read']
    }
  ]);

  readonly permissions = this.permissionList.asReadonly();
  readonly roles = this.roleList.asReadonly();

  getAllPermissions(): Permission[] {
    return this.permissionList();
  }

  getAllRoles(): Role[] {
    return this.roleList();
  }

  createRole(role: Omit<Role, 'id' | 'isSystem'>): void {
    const newRole: Role = {
      ...role,
      id: `rol-${Date.now()}`,
      isSystem: false
    };
    this.roleList.update(list => [...list, newRole]);
  }

  updateRole(id: string, updatedFields: Partial<Role>): void {
    this.roleList.update(list => list.map(item => {
      if (item.id === id) {
        // system roles can't have their name modified in this simulation
        const isNameRestricted = item.isSystem && updatedFields.name !== undefined;
        const newFields = { ...updatedFields };
        if (isNameRestricted) {
          delete newFields.name;
        }
        return { ...item, ...newFields };
      }
      return item;
    }));
  }

  deleteRole(id: string): boolean {
    const role = this.roleList().find(item => item.id === id);
    if (role?.isSystem) {
      return false; // cannot delete system roles
    }
    this.roleList.update(list => list.filter(item => item.id !== id));
    return true;
  }
}
