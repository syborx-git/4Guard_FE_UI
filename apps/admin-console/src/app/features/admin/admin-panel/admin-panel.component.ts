/**
 * @file admin-panel.component.ts
 * @description Panel central de administración de 4GUARD WMS (Admin Hub).
 * Orquesta 13 módulos JPA simulados mediante servicios separados e inyecciones de Signals.
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserRole } from '@4guard/shared-core';

// Inyección de servicios mock de administración
import { OrganizationService, Organization, OrganizationType, OrganizationStatus } from '../services/organization.service';
import { BranchService, Branch } from '../services/branch.service';
import { SectionService, WarehouseSection } from '../services/section.service';
import { LocationService, Location, LocationType } from '../services/location.service';
import { ClientService, Client } from '../services/client.service';
import { SkuService, ProductSku } from '../services/sku.service';
import { UserAdminService, UserAdminItem, UserStatus } from '../services/user-admin.service';
import { RolePermissionService, Role, Permission } from '../services/role-permission.service';
import { InventoryService, InventoryItem, InventoryState } from '../services/inventory.service';
import { MovementService, InventoryMovement } from '../services/movement.service';
import { IncidenceService, Incidence, IncidenceStatus, IncidenceType, IncidenceSeverity } from '../services/incidence.service';
import { AuditLogService, AuditLog } from '../services/audit.service';
import { NotificationAdminService, NotificationAdminItem, NotificationSeverity } from '../services/notification-admin.service';

interface AdminModuleCard {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: 'STRUCTURE' | 'MERCHANDISE' | 'SECURITY' | 'SUPPORT';
  badgeCount?: () => number;
}

@Component({
  selector: 'fg-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.css'
})
export class AdminPanelComponent implements OnInit {
  ngOnInit(): void {
    // Carga inicial de organizaciones para poblar los selectores del formulario en otros módulos
    this.orgService.loadOrganizations().subscribe({
      error: (err) => {
        console.error('Error al precargar organizaciones del backend:', err);
      }
    });
  }

  // Inyección de servicios
  protected readonly orgService = inject(OrganizationService);
  protected readonly branchService = inject(BranchService);
  protected readonly sectionService = inject(SectionService);
  protected readonly locationService = inject(LocationService);
  protected readonly clientService = inject(ClientService);
  protected readonly skuService = inject(SkuService);
  protected readonly userAdminService = inject(UserAdminService);
  protected readonly roleService = inject(RolePermissionService);
  protected readonly inventoryService = inject(InventoryService);
  protected readonly movementService = inject(MovementService);
  protected readonly incidenceService = inject(IncidenceService);
  protected readonly auditService = inject(AuditLogService);
  protected readonly notifService = inject(NotificationAdminService);
  private readonly router = inject(Router);

  // Estados de navegación e interfaz
  protected readonly selectedModule = signal<string | null>(null);
  protected readonly searchTerm = signal<string>('');
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSize = signal<number>(20);

  // Exponer Math al template
  protected readonly Math = Math;

  // Signals computados para evitar lógica compleja y lambdas en el HTML
  protected readonly activeIncidencesCount = computed(() => 
    this.incidenceService.incidences().filter(i => i.status !== 'CLOSED').length
  );
  
  protected readonly unreadNotificationsCount = computed(() => 
    this.notifService.notifications().filter(n => !n.read).length
  );

  protected readonly availableBranches = computed(() => {
    return this.branchService.branches();
  });

  // Métodos helper de filtrado para selectores en cascada
  protected getSectionsForBranch(branchId: string): WarehouseSection[] {
    return this.sectionService.sections().filter(s => s.branchId === branchId);
  }

  protected getBranchesForOrg(orgId: string): Branch[] {
    return this.branchService.branches().filter(b => b.orgId === orgId);
  }

  // Estados de modales
  protected readonly isFormModalOpen = signal<boolean>(false);
  protected readonly isDetailModalOpen = signal<boolean>(false);
  protected readonly editingItemId = signal<string | null>(null);

  // Modelos de formulario y visualización de detalles
  protected formModel: any = {};
  protected detailModel: any = null;

  // Catálogo de tarjetas de administración
  protected readonly modules: AdminModuleCard[] = [
    // Estructura
    { id: 'organizations', title: 'Organizaciones', icon: 'corporate_fare', description: 'Administra empresas y holdings raíz (Multi-Tenancy).', category: 'STRUCTURE' },
    { id: 'branches', title: 'Sucursales / Almacenes', icon: 'domain', description: 'Sedes físicas, zonas horarias e información de contacto.', category: 'STRUCTURE' },
    { id: 'sections', title: 'Secciones de Almacén', icon: 'grid_view', description: 'Áreas lógicas del almacén (recibo, frío, pasillos).', category: 'STRUCTURE' },
    { id: 'locations', title: 'Ubicaciones físicas', icon: 'location_on', description: 'Coordenadas 3D, capacidades y bloqueos de posiciones.', category: 'STRUCTURE' },
    
    // Mercancía
    { id: 'clients', title: 'Clientes / Owners', icon: 'partner_exchange', description: 'Dueños de mercancía y stock depositado (3PL).', category: 'MERCHANDISE' },
    { id: 'skus', title: 'Catálogo de SKUs', icon: 'inventory', description: 'Unidades de medida, pesos y descripciones de stock.', category: 'MERCHANDISE' },
    
    // Seguridad
    { id: 'users', title: 'Control de Usuarios', icon: 'manage_accounts', description: 'Cuentas de operadores, intentos de acceso y bloqueos.', category: 'SECURITY' },
    { id: 'roles', title: 'Roles y Matriz de Permisos', icon: 'shield_person', description: 'Nivel de jerarquía y matriz de accesos y llamadas a API.', category: 'SECURITY' },
    { id: 'sessions', title: 'Sesiones Activas', icon: 'group', description: 'Monitoreo en tiempo real de conexiones de usuario activas.', category: 'SECURITY' },
    
    // Soporte y Auditoría
    { id: 'inventory', title: 'Monitor de Inventario', icon: 'shelves', description: 'Saldos activos por SSCC, cuarentenas preventivas y lotes.', category: 'SUPPORT' },
    { id: 'movements', title: 'Movimientos de Stock', icon: 'history', description: 'Historial inmutable de traslados, recibos y despachos.', category: 'SUPPORT' },
    { id: 'incidences', title: 'Incidencias de Calidad', icon: 'report_problem', description: 'Seguimiento a anomalías, mermas y bloqueos de calidad.', category: 'SUPPORT', badgeCount: () => this.incidenceService.incidences().filter(i => i.status !== 'CLOSED').length },
    { id: 'audit', title: 'Consola de Auditoría', icon: 'find_in_page', description: 'Bitácora forense de red y comparador de cambios JSON.', category: 'SUPPORT' },
    { id: 'notifications', title: 'Alertas del Sistema', icon: 'notifications_active', description: 'Bandeja técnica de notificaciones y alertas críticas.', category: 'SUPPORT', badgeCount: () => this.notifService.notifications().filter(n => !n.read).length }
  ];

  // Cálculo unificado de filtrado, búsqueda y paginación reactiva
  protected readonly filteredAndPagedData = computed(() => {
    const module = this.selectedModule();
    const search = this.searchTerm().toLowerCase().trim();
    const page = this.currentPage();
    const size = this.pageSize();

    let list: any[] = [];

    if (!module) return { items: [], total: 0, totalPages: 1 };

    switch (module) {
      case 'organizations':
        list = this.orgService.organizations();
        if (search) {
          list = list.filter(o => o.name.toLowerCase().includes(search) || o.code.toLowerCase().includes(search) || o.taxId.toLowerCase().includes(search));
        }
        break;
      case 'branches':
        list = this.branchService.branches();
        if (search) {
          list = list.filter(b => b.name.toLowerCase().includes(search) || b.code.toLowerCase().includes(search) || b.orgName.toLowerCase().includes(search));
        }
        break;
      case 'sections':
        list = this.sectionService.sections();
        if (search) {
          list = list.filter(s => s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search) || s.branchName.toLowerCase().includes(search));
        }
        break;
      case 'locations':
        list = this.locationService.locations();
        if (search) {
          list = list.filter(l => l.zone.toLowerCase().includes(search) || l.type.toLowerCase().includes(search) || l.branchName.toLowerCase().includes(search) || l.sectionName.toLowerCase().includes(search) || l.blockReason.toLowerCase().includes(search));
        }
        break;
      case 'clients':
        list = this.clientService.clients();
        if (search) {
          list = list.filter(c => c.name.toLowerCase().includes(search) || c.externalId.toLowerCase().includes(search) || c.orgName.toLowerCase().includes(search));
        }
        break;
      case 'skus':
        list = this.skuService.skus();
        if (search) {
          list = list.filter(s => s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search) || s.clientName.toLowerCase().includes(search) || s.description.toLowerCase().includes(search));
        }
        break;
      case 'users':
        list = this.userAdminService.users();
        if (search) {
          list = list.filter(u => u.username.toLowerCase().includes(search) || u.email.toLowerCase().includes(search) || `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) || (u.branchName || '').toLowerCase().includes(search));
        }
        break;
      case 'roles':
        list = this.roleService.roles();
        if (search) {
          list = list.filter(r => r.name.toLowerCase().includes(search));
        }
        break;
      case 'inventory':
        list = this.inventoryService.inventoryItems();
        if (search) {
          list = list.filter(i => i.sscc.toLowerCase().includes(search) || i.skuCode.toLowerCase().includes(search) || i.skuName.toLowerCase().includes(search) || i.locationCode.toLowerCase().includes(search) || i.lotNumber.toLowerCase().includes(search) || i.quarantineReason.toLowerCase().includes(search));
        }
        break;
      case 'movements':
        list = this.movementService.movements();
        if (search) {
          list = list.filter(m => m.sscc.toLowerCase().includes(search) || m.username.toLowerCase().includes(search) || m.originLocation.toLowerCase().includes(search) || m.destinationLocation.toLowerCase().includes(search) || m.reason.toLowerCase().includes(search) || m.type.toLowerCase().includes(search));
        }
        break;
      case 'incidences':
        list = this.incidenceService.incidences();
        if (search) {
          list = list.filter(i => i.folio.toLowerCase().includes(search) || i.sscc.toLowerCase().includes(search) || i.description.toLowerCase().includes(search) || i.reporterUsername.toLowerCase().includes(search) || i.resolutionNotes.toLowerCase().includes(search));
        }
        break;
      case 'audit':
        list = this.auditService.auditLogs();
        if (search) {
          list = list.filter(a => a.username.toLowerCase().includes(search) || a.entityType.toLowerCase().includes(search) || a.action.toLowerCase().includes(search) || a.ipAddress.toLowerCase().includes(search));
        }
        break;
      case 'notifications':
        list = this.notifService.notifications();
        if (search) {
          list = list.filter(n => n.title.toLowerCase().includes(search) || n.message.toLowerCase().includes(search));
        }
        break;
    }

    const total = list.length;
    const totalPages = Math.ceil(total / size) || 1;
    const startIndex = (page - 1) * size;
    const paginatedItems = list.slice(startIndex, startIndex + size);

    return {
      items: paginatedItems,
      total,
      totalPages
    };
  });

  // Selector de módulo principal
  protected selectModule(moduleId: string | null): void {
    if (moduleId === 'sessions') {
      this.router.navigate(['/sessions']);
      return;
    }
    this.selectedModule.set(moduleId);
    this.searchTerm.set('');
    this.currentPage.set(1);
    this.closeModal();

    if (moduleId === 'organizations') {
      this.orgService.loadOrganizations().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de organizaciones del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'users') {
      this.userAdminService.loadUsers().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de usuarios del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'roles') {
      this.roleService.loadRolesAndPermissions().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de roles y permisos del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    }
  }

  // Lógica de Paginación
  protected changePage(page: number): void {
    const max = this.filteredAndPagedData().totalPages;
    if (page >= 1 && page <= max) {
      this.currentPage.set(page);
    }
  }

  protected updatePageSize(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.pageSize.set(Number(select.value));
      this.currentPage.set(1);
    }
  }

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.searchTerm.set(input.value);
      this.currentPage.set(1);
    }
  }

  // --- MÉTODOS CRUD GENERALES ---
  protected openAddModal(): void {
    this.editingItemId.set(null);
    const module = this.selectedModule();

    // Inicialización de modelo según la entidad activa
    if (module === 'organizations') {
      this.formModel = {
        name: '',
        code: '',
        taxId: '',
        type: 'LOGISTICS',
        status: 'ACTIVE',
        settings: '{\n  "allowCrossDocking": true\n}'
      };
    } else if (module === 'branches') {
      const orgs = this.orgService.organizations();
      this.formModel = {
        orgId: orgs[0]?.id || '',
        name: '',
        code: '',
        timezone: 'America/Mexico_City',
        addressLine1: '',
        status: 'ACTIVE'
      };
    } else if (module === 'sections') {
      const branches = this.branchService.branches();
      this.formModel = {
        branchId: branches[0]?.id || '',
        code: '',
        name: ''
      };
    } else if (module === 'locations') {
      const branches = this.branchService.branches();
      const sections = this.sectionService.sections();
      this.formModel = {
        branchId: branches[0]?.id || '',
        sectionId: sections[0]?.id || '',
        zone: 'A',
        aisle: '01',
        rack: '01',
        position: '01',
        level: 1,
        coordX: 0,
        coordY: 0,
        coordZ: 0,
        type: 'PALLET',
        capacityUnits: 1,
        isBlocked: false,
        blockReason: ''
      };
    } else if (module === 'clients') {
      const orgs = this.orgService.organizations();
      this.formModel = {
        orgId: orgs[0]?.id || '',
        name: '',
        externalId: '',
        status: 'ACTIVE'
      };
    } else if (module === 'skus') {
      const clients = this.clientService.clients();
      this.formModel = {
        clientId: clients[0]?.id || '',
        code: '',
        name: '',
        description: '',
        weight: 0.000,
        unit: 'PZA'
      };
    } else if (module === 'users') {
      const orgs = this.orgService.organizations();
      const branches = this.branchService.branches();
      this.formModel = {
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        orgId: orgs[0]?.id || '',
        branchId: null,
        role: UserRole.WAREHOUSE_OPERATOR,
        status: 'ACTIVE',
        isEnabled: true,
        changePasswordRequired: true,
        failedAttempts: 0,
        permanentlyLocked: false
      };
    } else if (module === 'roles') {
      this.formModel = {
        name: '',
        level: 10,
        permissions: []
      };
    }

    this.isFormModalOpen.set(true);
  }

  protected openEditModal(item: any): void {
    this.editingItemId.set(item.id);
    const module = this.selectedModule();

    if (module === 'organizations') {
      this.formModel = { ...item };
    } else if (module === 'branches') {
      this.formModel = { ...item };
    } else if (module === 'sections') {
      this.formModel = { ...item };
    } else if (module === 'locations') {
      this.formModel = { ...item };
    } else if (module === 'clients') {
      this.formModel = { ...item };
    } else if (module === 'skus') {
      this.formModel = { ...item };
    } else if (module === 'users') {
      this.formModel = { ...item, password: '' }; // no mostrar password
    } else if (module === 'roles') {
      this.formModel = {
        ...item,
        permissions: [...item.permissions] // clonar array
      };
    }

    this.isFormModalOpen.set(true);
  }

  protected saveItem(): void {
    const module = this.selectedModule();
    const id = this.editingItemId();

    try {
      if (module === 'organizations') {
        if (!this.formModel.name || !this.formModel.code) throw new Error('Nombre y Código son requeridos.');
        if (id) {
          this.orgService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('organizations', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al actualizar la organización: ' + (err.message || 'Error inesperado'));
            }
          });
        } else {
          this.orgService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('organizations', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al crear la organización: ' + (err.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      } else if (module === 'branches') {
        if (!this.formModel.name || !this.formModel.code) throw new Error('Nombre y Código son requeridos.');
        const org = this.orgService.organizations().find(o => o.id === this.formModel.orgId);
        this.formModel.orgName = org ? org.name : '';
        if (id) {
          this.branchService.update(id, this.formModel);
          this.auditLog('branches', id, 'UPDATE', null, this.formModel);
        } else {
          this.branchService.create(this.formModel);
          this.auditLog('branches', 'new', 'CREATE', null, this.formModel);
        }
      } else if (module === 'sections') {
        if (!this.formModel.code || !this.formModel.name) throw new Error('Código y Nombre son requeridos.');
        const branch = this.branchService.branches().find(b => b.id === this.formModel.branchId);
        this.formModel.branchName = branch ? branch.name : '';
        if (id) {
          this.sectionService.update(id, this.formModel);
          this.auditLog('sections', id, 'UPDATE', null, this.formModel);
        } else {
          this.sectionService.create(this.formModel);
          this.auditLog('sections', 'new', 'CREATE', null, this.formModel);
        }
      } else if (module === 'locations') {
        if (!this.formModel.zone) throw new Error('Zona es requerida.');
        const branch = this.branchService.branches().find(b => b.id === this.formModel.branchId);
        const section = this.sectionService.sections().find(s => s.id === this.formModel.sectionId);
        this.formModel.branchName = branch ? branch.name : '';
        this.formModel.sectionName = section ? section.name : '';
        
        // Bloqueo cascada
        if (this.formModel.isBlocked && !this.formModel.blockReason) {
          throw new Error('Debe especificar una razón de bloqueo si activa la casilla.');
        }

        if (id) {
          this.locationService.update(id, this.formModel);
          this.auditLog('locations', id, 'UPDATE', null, this.formModel);
        } else {
          this.locationService.create(this.formModel);
          this.auditLog('locations', 'new', 'CREATE', null, this.formModel);
        }
      } else if (module === 'clients') {
        if (!this.formModel.name) throw new Error('Nombre del Cliente es requerido.');
        const org = this.orgService.organizations().find(o => o.id === this.formModel.orgId);
        this.formModel.orgName = org ? org.name : '';
        if (id) {
          this.clientService.update(id, this.formModel);
          this.auditLog('clients', id, 'UPDATE', null, this.formModel);
        } else {
          this.clientService.create(this.formModel);
          this.auditLog('clients', 'new', 'CREATE', null, this.formModel);
        }
      } else if (module === 'skus') {
        if (!this.formModel.code || !this.formModel.name) throw new Error('Código SKU y Nombre comercial son requeridos.');
        const client = this.clientService.clients().find(c => c.id === this.formModel.clientId);
        this.formModel.clientName = client ? client.name : '';
        if (id) {
          this.skuService.update(id, this.formModel);
          this.auditLog('skus', id, 'UPDATE', null, this.formModel);
        } else {
          this.skuService.create(this.formModel);
          this.auditLog('skus', 'new', 'CREATE', null, this.formModel);
        }
      } else if (module === 'users') {
        if (!this.formModel.username || !this.formModel.email) throw new Error('Usuario y Email son requeridos.');
        const org = this.orgService.organizations().find(o => o.id === this.formModel.orgId);
        this.formModel.orgName = org ? org.name : '';
        if (this.formModel.branchId) {
          const branch = this.branchService.branches().find(b => b.id === this.formModel.branchId);
          this.formModel.branchName = branch ? branch.name : 'Corporativo';
        } else {
          this.formModel.branchName = 'Corporativo';
        }

        if (id) {
          this.userAdminService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('users', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al actualizar el usuario: ' + (err.message || 'Error inesperado'));
            }
          });
        } else {
          this.userAdminService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('users', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al crear el usuario: ' + (err.message || 'Error inesperado'));
            }
          });
          return; // No cerrar modal sincrónicamente
        }
      } else if (module === 'roles') {
        if (!this.formModel.name) throw new Error('Nombre del Rol es requerido.');
        if (id) {
          this.roleService.updateRole(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('roles', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al actualizar el rol: ' + (err.message || 'Error inesperado'));
            }
          });
        } else {
          this.roleService.createRole(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('roles', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al crear el rol: ' + (err.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      }

      this.closeModal();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el registro.');
    }
  }

  protected deleteItem(id: string): void {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    const module = this.selectedModule();

    if (module === 'organizations') {
      this.orgService.delete(id).subscribe({
        next: () => {
          this.auditLog('organizations', id, 'DELETE', null, null);
        },
        error: (err) => {
          alert('Error al eliminar la organización: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (module === 'branches') {
      this.branchService.delete(id);
      this.auditLog('branches', id, 'DELETE', null, null);
    } else if (module === 'sections') {
      this.sectionService.delete(id);
      this.auditLog('sections', id, 'DELETE', null, null);
    } else if (module === 'locations') {
      this.locationService.delete(id);
      this.auditLog('locations', id, 'DELETE', null, null);
    } else if (module === 'clients') {
      this.clientService.delete(id);
      this.auditLog('clients', id, 'DELETE', null, null);
    } else if (module === 'skus') {
      this.skuService.delete(id);
      this.auditLog('skus', id, 'DELETE', null, null);
    } else if (module === 'users') {
      this.userAdminService.delete(id).subscribe({
        next: () => {
          this.auditLog('users', id, 'DELETE', null, null);
        },
        error: (err) => {
          alert('Error al eliminar el usuario: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (module === 'roles') {
      this.roleService.deleteRole(id).subscribe({
        next: () => {
          this.auditLog('roles', id, 'DELETE', null, null);
        },
        error: (err) => {
          alert('Error al eliminar el rol: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (module === 'incidences') {
      this.incidenceService.delete(id);
    } else if (module === 'notifications') {
      this.notifService.delete(id);
    }
  }

  // Acciones específicas de negocios
  protected toggleOrgStatus(id: string): void {
    const org = this.orgService.organizations().find(o => o.id === id);
    const oldStatus = org?.status;
    const newStatus = oldStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.orgService.toggleStatus(id).subscribe({
      next: () => {
        this.auditLog('organizations', id, 'UPDATE', { status: oldStatus }, { status: newStatus });
      },
      error: (err) => {
        alert('Error al cambiar el estado de la organización: ' + (err.message || 'Error inesperado'));
      }
    });
  }

  protected toggleBranchStatus(id: string): void {
    this.branchService.toggleStatus(id);
    this.auditLog('branches', id, 'UPDATE', { desc: 'Toggle status' }, null);
  }

  protected toggleClientStatus(id: string): void {
    this.clientService.toggleStatus(id);
    this.auditLog('clients', id, 'UPDATE', { desc: 'Toggle status' }, null);
  }

  protected toggleLocationBlock(loc: Location): void {
    if (loc.isBlocked) {
      // Desbloquear directamente
      this.locationService.toggleBlock(loc.id, false, '');
      this.auditLog('locations', loc.id, 'UPDATE', { block: true }, { block: false });
    } else {
      const reason = prompt('Escriba el motivo de bloqueo para la ubicación:');
      if (!reason) return;
      this.locationService.toggleBlock(loc.id, true, reason);
      this.auditLog('locations', loc.id, 'UPDATE', { block: false }, { block: true, reason });
      
      // Lanzar notificación administrativa
      this.notifService.create({
        title: 'Ubicación Bloqueada por Calidad',
        message: `La ubicación física ${loc.branchName} - ${loc.zone} ha sido bloqueada. Motivo: ${reason}`,
        severity: 'WARNING',
        technicalMetadata: JSON.stringify({ locationId: loc.id, zone: loc.zone, reason })
      });
    }
  }

  protected toggleUserStatus(id: string): void {
    const user = this.userAdminService.users().find(u => u.id === id);
    if (!user) return;
    const newStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.userAdminService.update(id, { 
      status: newStatus,
      isEnabled: newStatus === 'ACTIVE'
    }).subscribe({
      next: () => {
        this.auditLog('users', id, 'UPDATE', { status: user.status }, { status: newStatus });
      },
      error: (err) => {
        alert('Error al actualizar el estado del usuario: ' + (err.message || 'Error inesperado'));
      }
    });
  }

  protected resetAttempts(user: UserAdminItem): void {
    this.userAdminService.resetFailedAttempts(user.id).subscribe({
      next: () => {
        alert(`Intentos fallidos de acceso restablecidos para: ${user.username}`);
        this.auditLog('users', user.id, 'UPDATE', { failedAttempts: user.failedAttempts }, { failedAttempts: 0 });
      },
      error: (err) => {
        alert('Error al restablecer intentos: ' + (err.message || 'Error inesperado'));
      }
    });
  }

  protected unlockUserAccount(user: UserAdminItem): void {
    this.userAdminService.unlockAccount(user.id).subscribe({
      next: () => {
        alert(`Cuenta de usuario desbloqueada con éxito: ${user.username}`);
        this.auditLog('users', user.id, 'UPDATE', { status: 'SUSPENDED' }, { status: 'ACTIVE' });
      },
      error: (err) => {
        alert('Error al desbloquear usuario: ' + (err.message || 'Error inesperado'));
      }
    });
  }

  protected toggleUserPermanentLock(user: UserAdminItem): void {
    const val = !user.permanentlyLocked;
    const newStatus: UserStatus = val ? 'SUSPENDED' : 'ACTIVE';
    this.userAdminService.update(user.id, { 
      permanentlyLocked: val, 
      status: newStatus,
      isEnabled: !val
    }).subscribe({
      next: () => {
        this.auditLog('users', user.id, 'UPDATE', { locked: user.permanentlyLocked }, { locked: val });
      },
      error: (err) => {
        alert('Error al cambiar el bloqueo permanente: ' + (err.message || 'Error inesperado'));
      }
    });
  }

  // Control de Matriz de Permisos en Formularios
  protected togglePermissionInRole(permCode: string): void {
    const permissions = this.formModel.permissions as string[];
    const idx = permissions.indexOf(permCode);
    if (idx > -1) {
      permissions.splice(idx, 1);
    } else {
      permissions.push(permCode);
    }
  }

  protected hasPermissionSelected(permCode: string): boolean {
    return this.formModel.permissions?.includes(permCode) || false;
  }

  // Cuarentena de inventarios
  protected toggleInventoryQuarantine(item: InventoryItem): void {
    if (item.state === 'AVAILABLE') {
      const reason = prompt('Ingrese el motivo de retención / cuarentena preventiva:');
      if (!reason) return;
      this.inventoryService.setQuarantineState(item.id, 'QUARANTINE', reason);
      this.movementService.addLog({
        type: 'ADJUSTMENT',
        sscc: item.sscc,
        originLocation: item.locationCode,
        destinationLocation: item.locationCode,
        username: 'enrique',
        reason: `Retención preventiva. Motivo: ${reason}`
      });
      alert(`Contenedor ${item.sscc} puesto en cuarentena preventiva.`);
    } else {
      this.inventoryService.setQuarantineState(item.id, 'AVAILABLE', '');
      this.movementService.addLog({
        type: 'ADJUSTMENT',
        sscc: item.sscc,
        originLocation: item.locationCode,
        destinationLocation: item.locationCode,
        username: 'enrique',
        reason: 'Liberación de inventario retenido'
      });
      alert(`Contenedor ${item.sscc} liberado a Disponible.`);
    }
  }

  // Modificar estado de calidad
  protected changeInventoryQualityState(item: InventoryItem, event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select) {
      const state = select.value as InventoryState;
      const reason = state !== 'AVAILABLE' ? (prompt('Escriba la razón del cambio de estado:') || '') : '';
      this.inventoryService.setQuarantineState(item.id, state, reason);
    }
  }

  // Gestión de Incidencias
  protected openIncidenceResolution(incidence: Incidence): void {
    this.detailModel = { ...incidence, newStatus: incidence.status, newNotes: incidence.resolutionNotes };
    this.isDetailModalOpen.set(true);
  }

  protected saveIncidenceResolution(): void {
    if (!this.detailModel) return;
    this.incidenceService.updateStatus(this.detailModel.id, this.detailModel.newStatus, this.detailModel.newNotes);
    
    // Si se cierra, agregar log
    if (this.detailModel.newStatus === 'CLOSED') {
      this.movementService.addLog({
        type: 'ADJUSTMENT',
        sscc: this.detailModel.sscc,
        originLocation: 'CUARENTENA / CALIDAD',
        destinationLocation: 'LIBERADO / DESECHO',
        username: 'enrique',
        reason: `Cierre de Incidencia ${this.detailModel.folio}. Notas: ${this.detailModel.newNotes}`
      });
    }

    this.closeModal();
    alert('Acción correctiva registrada con éxito.');
  }

  // Visualizador de auditoría y notificaciones
  protected openAuditDetail(log: AuditLog): void {
    this.detailModel = log;
    this.isDetailModalOpen.set(true);
  }

  protected openNotificationDetail(n: NotificationAdminItem): void {
    this.notifService.markAsRead(n.id);
    this.detailModel = n;
    this.isDetailModalOpen.set(true);
  }

  // Cierre de modales
  protected closeModal(): void {
    this.isFormModalOpen.set(false);
    this.isDetailModalOpen.set(false);
    this.editingItemId.set(null);
    this.detailModel = null;
  }

  // Helper para auditoría forense interna
  private auditLog(entity: string, id: string, action: 'CREATE' | 'UPDATE' | 'DELETE', before: any, after: any): void {
    this.auditService.logAction({
      username: 'enrique',
      entityType: entity,
      entityId: id,
      action,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 WMS Console Client',
      beforeState: before ? JSON.stringify(before, null, 2) : 'null',
      afterState: after ? JSON.stringify(after, null, 2) : 'null'
    });
  }

  // Helpers de Formateo Visual
  protected getSeverityBadgeClass(severity: NotificationSeverity | IncidenceSeverity): string {
    switch (severity) {
      case 'CRITICAL': return 'bg-danger-opaque text-danger';
      case 'WARNING': return 'bg-warning-opaque text-warning';
      case 'INFO': return 'bg-info-opaque text-info';
      default: return '';
    }
  }

  protected getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
      case 'AVAILABLE':
      case 'CLOSED':
        return 'badge-success';
      case 'INACTIVE':
      case 'DAMAGED':
      case 'SUSPENDED':
        return 'badge-danger';
      case 'IN_PROGRESS':
      case 'IN_QUALITY':
      case 'PENDING':
        return 'badge-warning';
      case 'QUARANTINE':
      case 'OPEN':
        return 'badge-purple';
      default:
        return 'badge-neutral';
    }
  }

  protected getActionBadgeClass(action: string): string {
    switch (action) {
      case 'CREATE': return 'badge-success';
      case 'UPDATE': return 'badge-warning';
      case 'DELETE': return 'badge-danger';
      case 'LOGIN': return 'badge-info';
      default: return 'badge-purple';
    }
  }
}

