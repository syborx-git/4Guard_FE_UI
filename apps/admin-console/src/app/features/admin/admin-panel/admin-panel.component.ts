/**
 * @file admin-panel.component.ts
 * @description Panel central de administración de 4GUARD WMS (Admin Hub).
 * Orquesta 13 módulos JPA mediante servicios separados e inyecciones de Signals.
 * El módulo de Clientes está integrado con el Backend mediante HTTP.
 */

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
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
import { RestrictSpecialCharsDirective } from '../../../shared/directives/restrict-special-chars.directive';

interface AdminModuleCard {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: 'STRUCTURE' | 'MERCHANDISE' | 'SECURITY' | 'SUPPORT';
  badgeCount?: () => number;
}

export interface AdminModuleMeta {
  categoryLabel: string;
  title: string;
  description: string;
  icon: string;
}

export interface AdminMetric {
  label: string;
  value: number;
  icon: string;
  description?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}




@Component({
  selector: 'fg-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RestrictSpecialCharsDirective],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.css',
  host: { '[class]': 'themeClass()' }
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);

  /** Reactive signal that tracks the active theme class */
  protected readonly themeClass = signal<string>(this.getThemeClass());

  private themeObserver?: MutationObserver;

  private getThemeClass(): string {
    return this.doc.documentElement.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
  }

  ngOnInit(): void {
    // Observar cambios de clase en <html> para mantener el tema sincronizado
    this.themeObserver = new MutationObserver(() => {
      this.themeClass.set(this.getThemeClass());
    });
    this.themeObserver.observe(this.doc.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Carga inicial de organizaciones para poblar los selectores del formulario en otros módulos
    this.orgService.loadOrganizations().subscribe({
      error: (err) => {
        console.error('Error al precargar organizaciones del backend:', err);
      }
    });

    // Carga inicial de sucursales del usuario logueado en sesión
    this.branchService.loadBranches().subscribe({
      error: (err) => {
        console.error('Error al precargar sucursales del backend:', err);
      }
    });

    // Carga inicial de clientes (Depositantes) correspondientes al organizationId en sesión
    this.clientService.loadClients().subscribe({
      error: (err) => {
        console.error('Error al precargar clientes del backend:', err);
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

  protected readonly activeModuleMeta = computed<AdminModuleMeta | null>(() => {
    const module = this.selectedModule();
    if (!module) return null;

    const metaMap: Record<string, AdminModuleMeta> = {
      organizations: {
        categoryLabel: 'ESTRUCTURA DE ALMACÉN · MAESTROS',
        title: 'Gestión de Organizaciones',
        description: 'Jerarquía superior de la corporación. Administre las empresas matrices, holdings y subsidiarias en un entorno multi-tenancy aislado y totalmente seguro.',
        icon: 'corporate_fare'
      },
      branches: {
        categoryLabel: 'ESTRUCTURA DE ALMACÉN · MAESTROS',
        title: 'Gestión de Sucursales (Branches)',
        description: 'Gestión de centros de distribución, almacenes centrales y sucursales metropolitanas. Configure zonas horarias, direcciones físicas y control de andenes de carga.',
        icon: 'domain'
      },
      sections: {
        categoryLabel: 'ESTRUCTURA DE ALMACÉN · MAESTROS',
        title: 'Secciones de Almacén',
        description: 'Zonificación lógica y térmica de la red de almacenamiento. Defina pasillos, áreas de recibo, cámaras de congelado frío y zonas de cuarentena técnica.',
        icon: 'grid_view'
      },
      locations: {
        categoryLabel: 'ESTRUCTURA DE ALMACÉN · MAESTROS',
        title: 'Catálogo de Ubicaciones (Locations)',
        description: 'Catálogo completo de ubicaciones físicas y posiciones de rack en el almacén. Gestione coordenadas tridimensionales, capacidades y bloqueos.',
        icon: 'location_on'
      },
      clients: {
        categoryLabel: 'CATÁLOGOS DE MERCANCÍA · CONTROL',
        title: 'Gestión de Clientes (Depositantes)',
        description: 'Gestión de depositantes logísticos y dueños de mercancía (3PL). Administre perfiles comerciales, giros comerciales, códigos tributarios y SLAs de servicio.',
        icon: 'partner_exchange'
      },
      skus: {
        categoryLabel: 'CATÁLOGOS DE MERCANCÍA · CONTROL',
        title: 'Catálogo de Productos / SKUs',
        description: 'Catálogo maestro de unidades de mantenimiento de stock (SKUs). Defina pesos, dimensiones, unidades de medida y clasificaciones.',
        icon: 'inventory'
      },
      users: {
        categoryLabel: 'SEGURIDAD Y CONTROL DE ACCESO',
        title: 'Control de Usuarios y Seguridad',
        description: 'Administración de cuentas de usuario, operadores, credenciales y estados de conexión. Gestione bloqueos por intentos fallidos.',
        icon: 'manage_accounts'
      },
      roles: {
        categoryLabel: 'SEGURIDAD Y CONTROL DE ACCESO',
        title: 'Roles y Matriz de Permisos',
        description: 'Matriz de control de acceso basada en roles (RBAC). Configure perfiles de permisos y niveles jerárquicos de autorización.',
        icon: 'shield_person'
      },
      inventory: {
        categoryLabel: 'MONITOREO Y SOPORTE',
        title: 'Monitor de Inventario Activo',
        description: 'Consulta en tiempo real de existencias por contenedor (SSCC), SKU y lote. Gestione cuarentenas preventivas y estados de calidad.',
        icon: 'shelves'
      },
      movements: {
        categoryLabel: 'MONITOREO Y SOPORTE',
        title: 'Bitácora Histórica de Movimientos',
        description: 'Registro inmutable de transacciones físicas, traslados internos, recepciones y despachos dentro del centro de distribución.',
        icon: 'history'
      },
      incidences: {
        categoryLabel: 'MONITOREO Y SOPORTE',
        title: 'Control de Incidencias de Calidad',
        description: 'Bitácora de incidencias de calidad, mermas, daños y bloqueos preventivos registrados en la operación diaria.',
        icon: 'report_problem'
      },
      audit: {
        categoryLabel: 'MONITOREO Y SOPORTE',
        title: 'Consola de Auditoría Forense',
        description: 'Historial detallado de auditoría forense del sistema. Registro de llamadas a API, modificaciones JSON y direcciones IP.',
        icon: 'find_in_page'
      },
      notifications: {
        categoryLabel: 'MONITOREO Y SOPORTE',
        title: 'Notificaciones y Alertas del Sistema',
        description: 'Centro técnico de alertas, notificaciones críticas de integración y mensajería del sistema en tiempo real.',
        icon: 'notifications_active'
      }
    };

    return metaMap[module] || {
      categoryLabel: 'MONITOREO Y SOPORTE',
      title: 'Consola Administrativa',
      description: 'Panel de control administrativo.',
      icon: 'admin_panel_settings'
    };
  });

  protected readonly activeModuleMetrics = computed<AdminMetric[]>(() => {
    const module = this.selectedModule();
    if (!module) return [];

    switch (module) {
      case 'organizations': {
        const orgs = this.orgService.organizations();
        return [
          {
            label: 'Total Organizaciones',
            value: orgs.length,
            icon: 'corporate_fare',
            tone: 'neutral'
          },
          {
            label: 'Organizaciones Activas',
            value: orgs.filter(o => o.status === 'ACTIVE').length,
            icon: 'check_circle',
            tone: 'success'
          },
          {
            label: 'Sucursales registradas',
            value: this.branchService.branches().length,
            icon: 'domain',
            tone: 'info'
          }
        ];
      }
      case 'branches': {
        const branches = this.branchService.branches();
        return [
          {
            label: 'Total Sucursales',
            value: branches.length,
            icon: 'domain',
            tone: 'neutral'
          },
          {
            label: 'Sucursales Activas',
            value: branches.filter(b => b.status === 'ACTIVE').length,
            icon: 'check_circle',
            tone: 'success'
          }
        ];
      }
      case 'sections': {
        return [
          {
            label: 'Secciones Definidas',
            value: this.sectionService.sections().length,
            icon: 'grid_view',
            tone: 'neutral'
          }
        ];
      }
      case 'locations': {
        const locs = this.locationService.locations();
        return [
          {
            label: 'Total Ubicaciones',
            value: locs.length,
            icon: 'location_on',
            tone: 'neutral'
          },
          {
            label: 'Ubicaciones Disponibles',
            value: locs.filter(l => !l.isBlocked).length,
            icon: 'check_circle',
            tone: 'success'
          },
          {
            label: 'Ubicaciones Bloqueadas',
            value: locs.filter(l => l.isBlocked).length,
            icon: 'block',
            tone: 'danger'
          }
        ];
      }
      case 'clients': {
        const clients = this.clientService.clients();
        return [
          {
            label: 'Total Clientes',
            value: clients.length,
            icon: 'partner_exchange',
            tone: 'neutral'
          },
          {
            label: 'Clientes Activos',
            value: clients.filter(c => c.status === 'ACTIVE').length,
            icon: 'check_circle',
            tone: 'success'
          }
        ];
      }
      case 'skus': {
        const skus = this.skuService.skus();
        return [
          {
            label: 'Total SKUs',
            value: skus.length,
            icon: 'inventory',
            tone: 'neutral'
          },
          {
            label: 'Clientes Únicos',
            value: new Set(skus.map(s => s.clientId)).size,
            icon: 'partner_exchange',
            tone: 'info'
          },
          {
            label: 'Unidades de Medida Únicas',
            value: new Set(skus.map(s => s.unit)).size,
            icon: 'square_foot',
            tone: 'neutral'
          }
        ];
      }
      case 'users': {
        const users = this.userAdminService.users();
        return [
          {
            label: 'Total Usuarios',
            value: users.length,
            icon: 'manage_accounts',
            tone: 'neutral'
          },
          {
            label: 'Usuarios Activos',
            value: users.filter(u => u.status === 'ACTIVE').length,
            icon: 'check_circle',
            tone: 'success'
          },
          {
            label: 'Usuarios Bloqueados',
            value: users.filter(u => u.permanentlyLocked || u.status === 'SUSPENDED').length,
            icon: 'lock',
            tone: 'danger'
          }
        ];
      }
      case 'roles': {
        const roles = this.roleService.roles();
        return [
          {
            label: 'Total Roles',
            value: roles.length,
            icon: 'shield_person',
            tone: 'neutral'
          },
          {
            label: 'Roles de Sistema',
            value: roles.filter(r => r.isSystem).length,
            icon: 'admin_panel_settings',
            tone: 'info'
          },
          {
            label: 'Roles Personalizados',
            value: roles.filter(r => !r.isSystem).length,
            icon: 'person_outline',
            tone: 'neutral'
          }
        ];
      }
      case 'inventory': {
        const items = this.inventoryService.inventoryItems();
        return [
          {
            label: 'Total Registros',
            value: items.length,
            icon: 'shelves',
            tone: 'neutral'
          },
          {
            label: 'Disponibles',
            value: items.filter(i => i.state === 'AVAILABLE').length,
            icon: 'check_circle',
            tone: 'success'
          },
          {
            label: 'En Calidad',
            value: items.filter(i => i.state === 'IN_QUALITY').length,
            icon: 'verified_user',
            tone: 'info'
          },
          {
            label: 'Retenidos',
            value: items.filter(i => i.state === 'QUARANTINE' || i.state === 'DAMAGED').length,
            icon: 'report_problem',
            tone: 'danger'
          }
        ];
      }
      case 'movements': {
        const movs = this.movementService.movements();
        return [
          {
            label: 'Total Movimientos',
            value: movs.length,
            icon: 'history',
            tone: 'neutral'
          },
          {
            label: 'Tipos Únicos',
            value: new Set(movs.map(m => m.type)).size,
            icon: 'category',
            tone: 'info'
          },
          {
            label: 'Operadores Únicos',
            value: new Set(movs.map(m => m.username)).size,
            icon: 'person',
            tone: 'neutral'
          }
        ];
      }
      case 'incidences': {
        const incs = this.incidenceService.incidences();
        return [
          {
            label: 'Total Incidencias',
            value: incs.length,
            icon: 'report_problem',
            tone: 'neutral'
          },
          {
            label: 'Activas',
            value: incs.filter(i => i.status !== 'CLOSED').length,
            icon: 'pending',
            tone: 'warning'
          },
          {
            label: 'Cerradas',
            value: incs.filter(i => i.status === 'CLOSED').length,
            icon: 'check_circle',
            tone: 'success'
          },
          {
            label: 'Críticas',
            value: incs.filter(i => i.severity === 'CRITICAL').length,
            icon: 'gavel',
            tone: 'danger'
          }
        ];
      }
      case 'audit': {
        const logs = this.auditService.auditLogs();
        return [
          {
            label: 'Total Logs',
            value: logs.length,
            icon: 'find_in_page',
            tone: 'neutral'
          },
          {
            label: 'Creaciones',
            value: logs.filter(l => l.action === 'CREATE').length,
            icon: 'add_circle',
            tone: 'success'
          },
          {
            label: 'Modificaciones',
            value: logs.filter(l => l.action === 'UPDATE').length,
            icon: 'edit',
            tone: 'info'
          },
          {
            label: 'Eliminaciones',
            value: logs.filter(l => l.action === 'DELETE').length,
            icon: 'delete',
            tone: 'danger'
          }
        ];
      }
      case 'notifications': {
        const notifs = this.notifService.notifications();
        return [
          {
            label: 'Total Alertas',
            value: notifs.length,
            icon: 'notifications_active',
            tone: 'neutral'
          },
          {
            label: 'Sin Leer',
            value: notifs.filter(n => !n.read).length,
            icon: 'mark_email_unread',
            tone: 'warning'
          },
          {
            label: 'Críticas',
            value: notifs.filter(n => n.severity === 'CRITICAL').length,
            icon: 'warning',
            tone: 'danger'
          },
          {
            label: 'Leídas',
            value: notifs.filter(n => n.read).length,
            icon: 'mark_email_read',
            tone: 'success'
          }
        ];
      }
      default:
        return [];
    }
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
  protected readonly activeFormSections = signal<WarehouseSection[]>([]);
  protected detailModel: any = null;

  // Catálogo de tarjetas de administración
  protected readonly modules: AdminModuleCard[] = [
    // Estructura
    { id: 'organizations', title: 'Organizaciones', icon: 'corporate_fare', description: 'Administra empresas y holdings raíz (Multi-Tenancy).', category: 'STRUCTURE' },
    { id: 'branches', title: 'Sucursales / Almacenes', icon: 'domain', description: 'Sedes físicas, zonas horarias e información de contacto.', category: 'STRUCTURE' },
    { id: 'sections', title: 'Secciones de Almacén', icon: 'grid_view', description: 'Áreas lógicas del almacén (recibo, frío, pasillos).', category: 'STRUCTURE' },
    { id: 'locations', title: 'Ubicaciones físicas', icon: 'location_on', description: 'Coordenadas 3D, capacidades y bloqueos de posiciones.', category: 'STRUCTURE' },
    
    // Mercancía y Operatividad Logística
    { id: 'clients', title: 'Clientes / Owners', icon: 'partner_exchange', description: 'Dueños de mercancía y stock depositado (3PL).', category: 'MERCHANDISE' },
    { id: 'skus', title: 'Catálogo de SKUs', icon: 'inventory', description: 'Unidades de medida, pesos y descripciones de stock.', category: 'MERCHANDISE' },
    { id: 'carriers', title: 'Transportistas', icon: 'local_shipping', description: 'Empresas transportistas, capacidades de vehículos y licencias.', category: 'MERCHANDISE' },
    { id: 'suppliers', title: 'Proveedores', icon: 'storefront', description: 'Catálogo maestro de proveedores, condiciones operativas y alcance WMS.', category: 'MERCHANDISE' },
    
    // Seguridad
    { id: 'users', title: 'Control de Usuarios', icon: 'manage_accounts', description: 'Cuentas de operadores, intentos de acceso y bloqueos.', category: 'SECURITY' },
    { id: 'roles', title: 'Roles y Matriz de Permisos', icon: 'shield_person', description: 'Nivel de jerarquía y matriz de accesos y llamadas a API.', category: 'SECURITY' },
    { id: 'shifts', title: 'Turnos y Horarios', icon: 'schedule', description: 'Configuración de jornadas operativas, horarios y disponibilidad de almacén.', category: 'SECURITY' },
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
    if (moduleId === 'organizations') {
      this.router.navigate(['/organizations']);
      return;
    }
    if (moduleId === 'branches') {
      this.router.navigate(['/branches']);
      return;
    }
    if (moduleId === 'clients') {
      this.router.navigate(['/clients']);
      return;
    }
    if (moduleId === 'skus') {
      this.router.navigate(['/skus']);
      return;
    }
    if (moduleId === 'users') {
      this.router.navigate(['/admin/users']);
      return;
    }
    if (moduleId === 'carriers') {
      this.router.navigate(['/carriers']);
      return;
    }
    if (moduleId === 'sections') {
      this.router.navigate(['/sections']);
      return;
    }
    if (moduleId === 'suppliers') {
      this.router.navigate(['/suppliers']);
      return;
    }
    if (moduleId === 'locations') {
      this.router.navigate(['/layout']);
      return;
    }
    if (moduleId === 'shifts') {
      this.router.navigate(['/admin/shifts']);
      return;
    }
    this.selectedModule.set(moduleId);

    this.searchTerm.set('');
    this.currentPage.set(1);
    this.closeModal();

    if (moduleId === 'organizations') {
      this.orgService.loadOrganizations().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de organizaciones del backend: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'branches') {
      this.branchService.loadBranches().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de sucursales del backend: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'clients') {
      this.clientService.loadClients().subscribe({
        error: (err: any) => {
          alert('Error al cargar la lista de clientes del backend: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'locations') {
      this.locationService.loadLocations().subscribe({
        error: (err: any) => {
          alert('Error al cargar la lista de ubicaciones del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'skus') {
      // Cargar clientes para asegurar que la lista de clientes se obtenga filtrada por organizationId del usuario en sesión
      this.clientService.loadClients().subscribe({
        next: () => {
          this.skuService.loadSkus().subscribe({
            error: (err: any) => {
              alert('Error al cargar la lista de SKUs del backend: ' + (err.message || 'Error inesperado'));
            }
          });
        },
        error: (err: any) => {
          console.error('Error al precargar clientes para SKUs:', err);
          // Fallback: cargar los SKUs de todas formas
          this.skuService.loadSkus().subscribe({
            error: (errSku: any) => {
              alert('Error al cargar la lista de SKUs del backend: ' + (errSku.message || 'Error inesperado'));
            }
          });
        }
      });
    } else if (moduleId === 'sections') {
      this.sectionService.loadSections().subscribe({
        error: (err: any) => {
          alert('Error al cargar la lista de secciones del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'locations') {
      this.locationService.loadLocations().subscribe({
        error: (err) => {
          alert('Error al cargar la lista de ubicaciones del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'users') {
      this.userAdminService.loadUsers().subscribe({
        error: (err: any) => {
          alert('Error al cargar la lista de usuarios del backend: ' + (err.message || 'Error inesperado'));
        }
      });
    } else if (moduleId === 'roles') {
      this.roleService.loadRolesAndPermissions().subscribe({
        error: (err: any) => {
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
      this.formModel = {
        branchId: branches[0]?.id || '',
        sectionId: '',
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
      if (this.formModel.branchId) {
        this.loadSectionsForActiveForm(this.formModel.branchId);
      }
    } else if (module === 'clients') {
      const orgs = this.orgService.organizations();
      this.formModel = {
        orgId: orgs[0]?.id || '',
        orgName: orgs[0]?.name || '',
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
      if (this.formModel.branchId) {
        this.loadSectionsForActiveForm(this.formModel.branchId);
      }
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
        if (!this.formModel.name) throw new Error('El nombre de la organización es requerido.');
        if (!this.formModel.code) throw new Error('El código de la organización es requerido.');
        if (id) {
          this.orgService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('organizations', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err) => {
              alert('Error al actualizar la organización: ' + (err?.error?.message || err?.message || 'Error inesperado'));
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
              alert('Error al crear la organización: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      } else if (module === 'branches') {
        if (!this.formModel.name || !this.formModel.code) throw new Error('Nombre y Código son requeridos.');
        const org = this.orgService.organizations().find(o => o.id === this.formModel.orgId);
        this.formModel.orgName = org ? org.name : '';
        if (id) {
          this.branchService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('branches', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al actualizar la sucursal: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        } else {
          this.branchService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('branches', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al crear la sucursal: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      } else if (module === 'sections') {
        if (!this.formModel.code || !this.formModel.name) throw new Error('Código y Nombre son requeridos.');
        const branch = this.branchService.branches().find(b => b.id === this.formModel.branchId);
        this.formModel.branchName = branch ? branch.name : '';
        if (id) {
          this.sectionService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('sections', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al actualizar la sección: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        } else {
          this.sectionService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('sections', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al crear la sección: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
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
          this.locationService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('locations', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al actualizar la ubicación: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        } else {
          this.locationService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('locations', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al crear la ubicación: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      } else if (module === 'clients') {
        if (!this.formModel.name) throw new Error('Nombre del Cliente es requerido.');
        const org = this.orgService.organizations().find(o => o.id === this.formModel.orgId);
        this.formModel.orgName = org ? org.name : this.formModel.orgName;
        if (id) {
          this.clientService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('clients', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al actualizar el cliente: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        } else {
          this.clientService.create(this.formModel).subscribe({
            next: (response: any) => {
              const newId = response.data?.id || 'new';
              this.auditLog('clients', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al crear el cliente: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
      } else if (module === 'skus') {
        if (!this.formModel.code || !this.formModel.name) throw new Error('Código SKU y Nombre comercial son requeridos.');
        const client = this.clientService.clients().find(c => c.id === this.formModel.clientId);
        this.formModel.clientName = client ? client.name : '';
        if (id) {
          this.skuService.update(id, this.formModel).subscribe({
            next: () => {
              this.auditLog('skus', id, 'UPDATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al actualizar el SKU: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        } else {
          this.skuService.create(this.formModel).subscribe({
            next: (response) => {
              const newId = response.data?.id || 'new';
              this.auditLog('skus', newId, 'CREATE', null, this.formModel);
              this.closeModal();
            },
            error: (err: any) => {
              alert('Error al crear el SKU: ' + (err?.error?.message || err?.message || 'Error inesperado'));
            }
          });
        }
        return; // No cerrar modal sincrónicamente
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
          alert('Error al eliminar la organización: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (module === 'branches') {
      this.branchService.delete(id).subscribe({
        next: () => {
          this.auditLog('branches', id, 'DELETE', null, null);
        },
        error: (err: any) => {
          alert('Error al eliminar la sucursal: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (module === 'sections') {
      this.sectionService.delete(id).subscribe({
        next: () => {
          this.auditLog('sections', id, 'DELETE', null, null);
        },
        error: (err: any) => {
          alert('Error al eliminar la sección: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (module === 'locations') {
      this.locationService.delete(id).subscribe({
        next: () => {
          this.auditLog('locations', id, 'DELETE', null, null);
        },
        error: (err: any) => {
          alert('Error al eliminar la ubicación: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (module === 'clients') {
      this.clientService.delete(id).subscribe({
        next: () => {
          this.auditLog('clients', id, 'DELETE', null, null);
        },
        error: (err: any) => {
          alert('Error al eliminar el cliente: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else if (module === 'skus') {
      this.skuService.delete(id).subscribe({
        next: () => {
          this.auditLog('skus', id, 'DELETE', null, null);
        },
        error: (err: any) => {
          alert('Error al eliminar el SKU: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
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
        alert('Error al cambiar el estado de la organización: ' + (err?.error?.message || err?.message || 'Error inesperado'));
      }
    });
  }

  protected toggleBranchStatus(id: string): void {
    const branch = this.branchService.branches().find(b => b.id === id);
    const oldStatus = branch?.status;
    const newStatus = oldStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.branchService.toggleStatus(id).subscribe({
      next: () => {
        this.auditLog('branches', id, 'UPDATE', { status: oldStatus }, { status: newStatus });
      },
      error: (err: any) => {
        alert('Error al cambiar el estado de la sucursal: ' + (err?.error?.message || err?.message || 'Error inesperado'));
      }
    });
  }

  protected toggleClientStatus(id: string): void {
    const client = this.clientService.clients().find(c => c.id === id);
    const oldStatus = client?.status;
    const newStatus = oldStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.clientService.toggleStatus(id).subscribe({
      next: () => {
        this.auditLog('clients', id, 'UPDATE', { status: oldStatus }, { status: newStatus });
      },
      error: (err: any) => {
        alert('Error al cambiar el estado del cliente: ' + (err?.error?.message || err?.message || 'Error inesperado'));
      }
    });
  }

  protected toggleLocationBlock(loc: Location): void {
    if (loc.isBlocked) {
      // Desbloquear directamente
      this.locationService.toggleBlock(loc.id, false, '').subscribe({
        next: () => {
          this.auditLog('locations', loc.id, 'UPDATE', { block: true }, { block: false });
        },
        error: (err: any) => {
          alert('Error al desbloquear la ubicación: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    } else {
      const reason = prompt('Escriba el motivo de bloqueo para la ubicación:');
      if (!reason) return;
      this.locationService.toggleBlock(loc.id, true, reason).subscribe({
        next: () => {
          this.auditLog('locations', loc.id, 'UPDATE', { block: false }, { block: true, reason });
          
          // Lanzar notificación administrativa
          this.notifService.create({
            title: 'Ubicación Bloqueada por Calidad',
            message: `La ubicación física ${loc.branchName} - ${loc.zone} ha sido bloqueada. Motivo: ${reason}`,
            severity: 'WARNING',
            technicalMetadata: JSON.stringify({ locationId: loc.id, zone: loc.zone, reason })
          });
        },
        error: (err: any) => {
          alert('Error al bloquear la ubicación: ' + (err?.error?.message || err?.message || 'Error inesperado'));
        }
      });
    }
  }

  protected onBranchChange(branchId: string): void {
    if (this.selectedModule() === 'locations') {
      this.loadSectionsForActiveForm(branchId);
    }
  }

  private loadSectionsForActiveForm(branchId: string): void {
    this.sectionService.getSectionsByBranch(branchId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.activeFormSections.set(response.data);
          // Auto seleccionar primera sección si no hay una sección seleccionada o si la seleccionada ya no existe en el listado nuevo
          const currentSecId = this.formModel.sectionId;
          const exists = response.data.some(s => s.id === currentSecId);
          if (!exists && response.data.length > 0) {
            this.formModel.sectionId = response.data[0].id;
          }
        } else {
          this.activeFormSections.set([]);
        }
      },
      error: () => {
        this.activeFormSections.set([]);
      }
    });
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

