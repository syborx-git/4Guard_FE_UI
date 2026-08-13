/**
 * @file catalogs.service.ts
 * @description Servicio reactivo unificado basado en Angular Signals para el módulo de Catálogos Maestros.
 * Administra la persistencia en memoria y estado reactivo para Usuarios, Clientes, Productos/SKUs,
 * Almacén/Topología y Montacarguistas.
 */

import { Injectable, signal, computed } from '@angular/core';
import { CatalogUser, CreateUserDto, USER_ROLES } from '../models/users-catalog.models';
import { CatalogClient, CreateClientDto } from '../models/clients-catalog.models';
import { CatalogProduct, CreateProductDto, OFFICIAL_4GUARD_SUPPLIERS } from '../models/products-catalog.models';
import { WarehouseBay, WarehouseZoneCode, WAREHOUSE_ZONES } from '../models/warehouse-catalog.models';
import { ForkliftOperator, CreateForkliftOperatorDto, calculateLicenseStatus } from '../models/forklift-catalog.models';

@Injectable({
  providedIn: 'root',
})
export class CatalogsService {
  // ── Signals de Catálogos ──────────────────────────────────
  private readonly usersSignal = signal<CatalogUser[]>(this.getInitialUsers());
  private readonly clientsSignal = signal<CatalogClient[]>(this.getInitialClients());
  private readonly productsSignal = signal<CatalogProduct[]>(this.getInitialProducts());
  private readonly baysSignal = signal<WarehouseBay[]>(this.generateInitialBays());
  private readonly forkliftOperatorsSignal = signal<ForkliftOperator[]>(this.getInitialForkliftOperators());

  // ── Lecturas Públicas (Readonly Signals & Computeds) ─────
  public readonly users = this.usersSignal.asReadonly();
  public readonly clients = this.clientsSignal.asReadonly();
  public readonly products = this.productsSignal.asReadonly();
  public readonly bays = this.baysSignal.asReadonly();
  public readonly forkliftOperators = this.forkliftOperatorsSignal.asReadonly();

  // Computeds útiles
  public readonly activeUsersCount = computed(() =>
    this.usersSignal().filter((u) => u.status === 'ACTIVO').length
  );

  public readonly activeClientsCount = computed(() =>
    this.clientsSignal().filter((c) => c.status === 'ACTIVO').length
  );

  public readonly activeProductsCount = computed(() =>
    this.productsSignal().filter((p) => p.status === 'ACTIVO').length
  );

  public readonly emptyBaysCount = computed(() =>
    this.baysSignal().filter((b) => b.occupiedPallets === 0).length
  );

  public readonly activeForkliftOperatorsCount = computed(() =>
    this.forkliftOperatorsSignal().filter((f) => f.status === 'ACTIVO').length
  );

  // ── Métodos: CATÁLOGO DE USUARIOS ─────────────────────────

  createUser(dto: CreateUserDto): CatalogUser {
    const roleObj = USER_ROLES.find((r) => r.code === dto.role);
    const newUser: CatalogUser = {
      id: `USR-${Date.now()}`,
      username: dto.username.toLowerCase().trim(),
      firstName: dto.firstName,
      lastNamePaterno: dto.lastNamePaterno,
      lastNameMaterno: dto.lastNameMaterno,
      fullName: `${dto.firstName} ${dto.lastNamePaterno} ${dto.lastNameMaterno}`.trim(),
      role: dto.role,
      roleLabel: roleObj?.label || dto.role,
      status: 'ACTIVO',
      lastAccess: 'Sin acceso registrado',
      createdAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${dto.username}`,
      auditLogs: [
        {
          id: `LOG-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          action: 'ALTA_USUARIO',
          performedBy: 'Sistema Admin',
          details: `Usuario ${dto.username} creado exitosamente con rol ${roleObj?.label || dto.role}.`,
        },
      ],
    };

    this.usersSignal.update((list) => [newUser, ...list]);
    return newUser;
  }

  updateUserStatus(userId: string, status: 'ACTIVO' | 'INACTIVO'): void {
    this.usersSignal.update((list) =>
      list.map((u) => {
        if (u.id === userId) {
          const updatedLogs = [
            {
              id: `LOG-${Date.now()}`,
              timestamp: new Date().toLocaleString(),
              action: status === 'ACTIVO' ? 'REACTIVACION' : 'BAJA_LOGICA',
              performedBy: 'Sistema Admin',
              details: `Estatus cambiado a ${status}.`,
            },
            ...u.auditLogs,
          ];
          return { ...u, status, auditLogs: updatedLogs };
        }
        return u;
      })
    );
  }

  resetUserPassword(userId: string): boolean {
    let success = false;
    this.usersSignal.update((list) =>
      list.map((u) => {
        if (u.id === userId) {
          success = true;
          const updatedLogs = [
            {
              id: `LOG-${Date.now()}`,
              timestamp: new Date().toLocaleString(),
              action: 'RESTABLECER_PASSWORD',
              performedBy: 'Sistema Admin',
              details: 'Se emitió restablecimiento de contraseña temporal.',
            },
            ...u.auditLogs,
          ];
          return { ...u, auditLogs: updatedLogs };
        }
        return u;
      })
    );
    return success;
  }

  // ── Métodos: CATÁLOGO DE CLIENTES ─────────────────────────

  createClient(dto: CreateClientDto): CatalogClient {
    const newClient: CatalogClient = {
      id: `CLI-${Date.now()}`,
      code: `C-${Math.floor(1000 + Math.random() * 9000)}`,
      businessName: dto.businessName,
      rfc: dto.rfc.toUpperCase().trim(),
      phone: dto.phone,
      address: dto.address,
      webPortalPassword: dto.webPortalPassword || '4GuardTemp#2026',
      status: 'ACTIVO',
      contacts: dto.contacts.map((c, idx) => ({ ...c, id: `CT-${Date.now()}-${idx}` })),
      destinations: dto.destinations.map((d, idx) => ({
        ...d,
        id: `DEST-${Date.now()}-${idx}`,
        destinationCode: `DEST-${Math.floor(100 + Math.random() * 900)}`,
        status: 'ACTIVO',
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.clientsSignal.update((list) => [newClient, ...list]);
    return newClient;
  }

  updateClient(clientId: string, updatedData: Partial<CatalogClient>): void {
    this.clientsSignal.update((list) =>
      list.map((c) => (c.id === clientId ? { ...c, ...updatedData, updatedAt: new Date().toISOString() } : c))
    );
  }

  // ── Métodos: CATÁLOGO DE PRODUCTOS / SKUS (NOM-251) ───────

  createProduct(dto: CreateProductDto): CatalogProduct {
    const newProduct: CatalogProduct = {
      id: `PROD-${Date.now()}`,
      sku: dto.sku.toUpperCase().trim(),
      description: dto.description,
      lotNumber: dto.lotNumber,
      supplier: dto.supplier,
      uom: dto.uom,
      expirationDays: dto.expirationDays,
      status: 'ACTIVO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.productsSignal.update((list) => [newProduct, ...list]);
    return newProduct;
  }

  /**
   * Conmuta el estado del producto (ACTIVO <-> INACTIVO).
   * REGLA DE EXIGENCIA NOM-251: Los SKUs NO se eliminan físicamente para mantener trazabilidad de auditoría.
   */
  toggleProductStatus(productId: string): void {
    this.productsSignal.update((list) =>
      list.map((p) => {
        if (p.id === productId) {
          const newStatus = p.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
          return { ...p, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );
  }

  // ── Métodos: CATÁLOGO DE MONTACARGUISTAS (HARD DELETE) ───

  createForkliftOperator(dto: CreateForkliftOperatorDto): ForkliftOperator {
    const licStatus = calculateLicenseStatus(dto.licenseExpirationDate);
    const newOperator: ForkliftOperator = {
      id: `MC-${Date.now()}`,
      employeeCode: `OP-${Math.floor(100 + Math.random() * 900)}`,
      firstName: dto.firstName,
      lastNamePaterno: dto.lastNamePaterno,
      lastNameMaterno: dto.lastNameMaterno,
      fullName: `${dto.firstName} ${dto.lastNamePaterno} ${dto.lastNameMaterno}`.trim(),
      hireDate: new Date().toISOString().split('T')[0],
      licenseNumber: dto.licenseNumber,
      licenseExpirationDate: dto.licenseExpirationDate,
      licenseStatus: licStatus,
      scorecard: {
        movementsThisMonth: 0,
        locationAccuracyPercentage: 100.0,
        safetyRating: 5.0,
        shift: dto.shift || 'Primer Turno (Matutino)',
      },
      status: 'ACTIVO',
    };

    this.forkliftOperatorsSignal.update((list) => [newOperator, ...list]);
    return newOperator;
  }

  /**
   * Elimina FÍSICAMENTE al operador de montacargas de la Signal (Hard Delete).
   * REGLA DE EXIGENCIA: Debido a la alta rotación de personal en andén, se permite remoción física directa.
   */
  deleteForkliftOperator(operatorId: string): void {
    this.forkliftOperatorsSignal.update((list) => list.filter((op) => op.id !== operatorId));
  }

  // ── DATOS INICIALES SEMILLAS ──────────────────────────────

  private getInitialUsers(): CatalogUser[] {
    return [
      {
        id: 'USR-001',
        username: 'admin.4guard',
        firstName: 'Christian',
        lastNamePaterno: 'Duran',
        lastNameMaterno: 'Mora',
        fullName: 'Christian Duran Mora',
        role: 'ROLE_ADMIN',
        roleLabel: 'Administrador del Sistema',
        status: 'ACTIVO',
        lastAccess: 'Hace 5 minutos',
        createdAt: '2026-01-15T08:00:00Z',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        auditLogs: [
          {
            id: 'LOG-001',
            timestamp: '2026-08-12 10:15:00',
            action: 'ACCESO_SISTEMA',
            performedBy: 'admin.4guard',
            details: 'Inicio de sesión exitoso desde consola admin.',
          },
        ],
      },
      {
        id: 'USR-002',
        username: 'gerencia.nestle',
        firstName: 'Roberto',
        lastNamePaterno: 'Gómez',
        lastNameMaterno: 'Bolaños',
        fullName: 'Roberto Gómez Bolaños',
        role: 'OPERATIONS_MANAGER',
        roleLabel: 'Gerente de Operaciones',
        status: 'ACTIVO',
        lastAccess: 'Hace 1 hora',
        createdAt: '2026-02-01T10:00:00Z',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=roberto',
        auditLogs: [
          {
            id: 'LOG-002',
            timestamp: '2026-08-12 09:00:00',
            action: 'CONSULTA_INVENTARIO',
            performedBy: 'gerencia.nestle',
            details: 'Exportación de reporte de bahías de Bodega A.',
          },
        ],
      },
      {
        id: 'USR-003',
        username: 'calidad.inspeccion',
        firstName: 'Mariana',
        lastNamePaterno: 'López',
        lastNameMaterno: 'Sánchez',
        fullName: 'Mariana López Sánchez',
        role: 'QUALITY_INSPECTOR',
        roleLabel: 'Inspector de Calidad',
        status: 'ACTIVO',
        lastAccess: 'Ayer, 16:30',
        createdAt: '2026-03-10T12:00:00Z',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mariana',
        auditLogs: [],
      },
    ];
  }

  private getInitialClients(): CatalogClient[] {
    return [
      {
        id: 'CLI-001',
        code: 'CLI-NESTLE',
        businessName: 'NESTLE MEXICO S.A. DE C.V.',
        rfc: 'NME850101K99',
        phone: '55 5268 2000',
        address: 'Av. Ejército Nacional 453, Granada, Miguel Hidalgo, CDMX',
        webPortalPassword: 'NestleWMS#2026',
        status: 'ACTIVO',
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
        contacts: [
          { id: 'CT-1', name: 'Ing. Carlos Fuentes', department: 'Logística y Abasto', phone: '55 1234 5678', email: 'cfuentes@nestle.com.mx' },
          { id: 'CT-2', name: 'Lic. Laura Rivas', department: 'Calidad Embalaje', phone: '55 8765 4321', email: 'lrivas@nestle.com.mx' },
        ],
        destinations: [
          { id: 'DEST-1', plantName: 'Planta Toluca (Café y Cacao)', fullAddress: 'Km 62.5 Carretera México-Toluca, Zona Industrial Toluca, EdoMex', contactPerson: 'Ing. Fernando Ruiz', phone: '722 279 1000', destinationCode: 'DEST-TOL', status: 'ACTIVO' },
          { id: 'DEST-2', plantName: 'Planta Querétaro (Lácteos)', fullAddress: 'Av. 5 de Febrero 1325, Zona Industrial Benito Juárez, Querétaro', contactPerson: 'Dra. Patricia Garza', phone: '442 211 4000', destinationCode: 'DEST-QRO', status: 'ACTIVO' },
          { id: 'DEST-3', plantName: 'Planta Veracruz (Agua Pura)', fullAddress: 'Carretera Coatepec-Veracruz Km 4.5, Coatepec, Ver.', contactPerson: 'Lic. Sergio Ramos', phone: '228 816 3000', destinationCode: 'DEST-VER', status: 'ACTIVO' },
        ],
      },
      {
        id: 'CLI-002',
        code: 'CLI-PEPSI',
        businessName: 'COMERCIALIZADORA PEPSICO MEXICO',
        rfc: 'CPM920312AB1',
        phone: '55 5262 3000',
        address: 'Bosque de Alisos 45B, Bosques de las Lomas, Cuajimalpa, CDMX',
        webPortalPassword: 'PepsiPortal#2026',
        status: 'ACTIVO',
        createdAt: '2026-02-15T00:00:00Z',
        updatedAt: '2026-08-11T00:00:00Z',
        contacts: [
          { id: 'CT-3', name: 'Ing. Jorge Valdés', department: 'Cadena de Suministro', phone: '55 4433 2211', email: 'jorge.valdes@pepsico.com' },
        ],
        destinations: [
          { id: 'DEST-4', plantName: 'Planta Celaya (Botanas)', fullAddress: 'Carretera Celaya-Villagrán Km 3, Celaya, Gto.', contactPerson: 'Ing. Mario Silva', phone: '461 618 9000', destinationCode: 'DEST-CEL', status: 'ACTIVO' },
        ],
      },
    ];
  }

  private getInitialProducts(): CatalogProduct[] {
    return [
      {
        id: 'PROD-001',
        sku: 'SK-10023',
        description: 'TAPA PLASTICA VERDE 38MM C/LINER SILICONA (NESTLE)',
        lotNumber: 'LOT-2026-A19',
        supplier: 'GLASS MEXICO',
        uom: 'CAJ',
        expirationDays: 365,
        status: 'ACTIVO',
        createdAt: '2026-01-20T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'PROD-002',
        sku: 'SK-99411',
        description: 'BOTELLA PET 500ML TRANSPARENTE ALTA DENSIDAD',
        lotNumber: 'LOT-PET-8812',
        supplier: 'AMCOR',
        uom: 'PZA',
        expirationDays: 60, // Expiración Precaución (30-90 días)
        status: 'ACTIVO',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-08-11T00:00:00Z',
      },
      {
        id: 'PROD-003',
        sku: 'SK-77302',
        description: 'SUSTITUTO DE CREMA EN POLVO GRADO ALIMENTICIO 25KG',
        lotNumber: 'LOT-DAIRY-009',
        supplier: 'ARLA FOODS',
        uom: 'KG',
        expirationDays: 20, // Expiración Crítica NOM-251 (< 30 días)
        status: 'ACTIVO',
        createdAt: '2026-04-12T00:00:00Z',
        updatedAt: '2026-08-12T00:00:00Z',
      },
      {
        id: 'PROD-004',
        sku: 'SK-55100',
        description: 'TARIMA PLASTICA DE ALTO IMPACTO CHEP 120X100 CM',
        lotNumber: 'LOT-CHEP-2026',
        supplier: 'CHEP MEXICO',
        uom: 'TAR',
        expirationDays: 730,
        status: 'INACTIVO', // Inactivado bajo regla NOM-251
        createdAt: '2026-02-10T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ];
  }

  private generateInitialBays(): WarehouseBay[] {
    const bays: WarehouseBay[] = [];

    // 1. Bodega A: Posiciones A-1 a A-175
    for (let i = 1; i <= 175; i++) {
      const isOccupied = i % 3 !== 0; // 2 de cada 3 ocupadas
      const occPallets = isOccupied ? (i % 2 === 0 ? 2 : 1) : 0;
      const status = occPallets === 2 ? 'SATURADA' : occPallets === 1 ? 'PARCIAL' : 'DESOCUPADA';
      bays.push({
        id: `BAY-A-${i}`,
        bayCode: `A-${i}`,
        warehouseZone: 'A',
        description: `Bodega A - Posición de Almacenamiento A-${i}`,
        capacityPallets: 2,
        occupiedPallets: occPallets,
        occupancyPercentage: occPallets === 2 ? 100 : occPallets === 1 ? 50 : 0,
        status,
        skuStored: isOccupied ? (i % 2 === 0 ? 'SK-10023' : 'SK-99411') : undefined,
        lotStored: isOccupied ? `LOT-A-${100 + i}` : undefined,
        lastMovement: '2026-08-12 14:20',
      });
    }

    // 2. Bodega APC (Pre-Carga / Staging): APC-1 a APC-6
    for (let i = 1; i <= 6; i++) {
      const occPallets = i <= 4 ? 4 : 0;
      bays.push({
        id: `BAY-APC-${i}`,
        bayCode: `APC-${i}`,
        warehouseZone: 'APC',
        description: `Bodega APC - Bahía de Pre-Carga / Staging Outbound APC-${i}`,
        capacityPallets: 4,
        occupiedPallets: occPallets,
        occupancyPercentage: Math.round((occPallets / 4) * 100),
        status: occPallets === 4 ? 'SATURADA' : 'DESOCUPADA',
        skuStored: occPallets > 0 ? 'SK-10023' : undefined,
        lotStored: occPallets > 0 ? 'LOT-STAGING-01' : undefined,
        lastMovement: '2026-08-12 18:45',
      });
    }

    // 3. Bodega AT (Saturación Temporal Nestlé): AT-1 a AT-46
    for (let i = 1; i <= 46; i++) {
      const isOcc = i <= 30;
      const occPallets = isOcc ? 2 : 0;
      bays.push({
        id: `BAY-AT-${i}`,
        bayCode: `AT-${i}`,
        warehouseZone: 'AT',
        description: `Bodega AT - Saturación Temporal Nestlé AT-${i}`,
        capacityPallets: 2,
        occupiedPallets: occPallets,
        occupancyPercentage: isOcc ? 100 : 0,
        status: isOcc ? 'SATURADA' : 'DESOCUPADA',
        skuStored: isOcc ? 'SK-77302' : undefined,
        lotStored: isOcc ? `LOT-NESTLE-AT-${i}` : undefined,
        lastMovement: '2026-08-11 11:30',
      });
    }

    // 4. Bodega B: B-1 a B-37
    for (let i = 1; i <= 37; i++) {
      const isOcc = i % 2 === 0;
      bays.push({
        id: `BAY-B-${i}`,
        bayCode: `B-${i}`,
        warehouseZone: 'B',
        description: `Bodega B - Posición B-${i}`,
        capacityPallets: 2,
        occupiedPallets: isOcc ? 1 : 0,
        occupancyPercentage: isOcc ? 50 : 0,
        status: isOcc ? 'PARCIAL' : 'DESOCUPADA',
        skuStored: isOcc ? 'SK-99411' : undefined,
        lastMovement: '2026-08-10 09:15',
      });
    }

    // 5. Bodega BPC: BPC-1 a BPC-6
    for (let i = 1; i <= 6; i++) {
      bays.push({
        id: `BAY-BPC-${i}`,
        bayCode: `BPC-${i}`,
        warehouseZone: 'BPC',
        description: `Bodega BPC - Pre-Carga Secundarias BPC-${i}`,
        capacityPallets: 4,
        occupiedPallets: 0,
        occupancyPercentage: 0,
        status: 'DESOCUPADA',
        lastMovement: '2026-08-09 17:00',
      });
    }

    // 6. Bodega BT: BT-1 a BT-12
    for (let i = 1; i <= 12; i++) {
      const isOcc = i <= 6;
      bays.push({
        id: `BAY-BT-${i}`,
        bayCode: `BT-${i}`,
        warehouseZone: 'BT',
        description: `Bodega BT - Saturación Temporal BT-${i}`,
        capacityPallets: 2,
        occupiedPallets: isOcc ? 2 : 0,
        occupancyPercentage: isOcc ? 100 : 0,
        status: isOcc ? 'SATURADA' : 'DESOCUPADA',
        skuStored: isOcc ? 'SK-10023' : undefined,
        lastMovement: '2026-08-12 08:00',
      });
    }

    return bays;
  }

  private getInitialForkliftOperators(): ForkliftOperator[] {
    return [
      {
        id: 'MC-101',
        employeeCode: 'OP-501',
        firstName: 'Juan Manuel',
        lastNamePaterno: 'Pérez',
        lastNameMaterno: 'Hernández',
        fullName: 'Juan Manuel Pérez Hernández',
        hireDate: '2024-03-15',
        licenseNumber: 'LIC-MC-9921',
        licenseExpirationDate: '2027-05-20', // Vigente
        licenseStatus: 'VIGENTE',
        scorecard: {
          movementsThisMonth: 412,
          locationAccuracyPercentage: 99.2,
          safetyRating: 4.9,
          shift: 'Turno 1 - Matutino',
        },
        status: 'ACTIVO',
      },
      {
        id: 'MC-102',
        employeeCode: 'OP-502',
        firstName: 'Carlos Eduardo',
        lastNamePaterno: 'Gómez',
        lastNameMaterno: 'Trejo',
        fullName: 'Carlos Eduardo Gómez Trejo',
        hireDate: '2025-01-10',
        licenseNumber: 'LIC-MC-8834',
        licenseExpirationDate: '2026-09-05', // Por Vencer (dentro de 30 días)
        licenseStatus: 'POR_VENCER',
        scorecard: {
          movementsThisMonth: 348,
          locationAccuracyPercentage: 98.5,
          safetyRating: 4.7,
          shift: 'Turno 2 - Vespertino',
        },
        status: 'ACTIVO',
      },
      {
        id: 'MC-103',
        employeeCode: 'OP-503',
        firstName: 'Ricardo',
        lastNamePaterno: 'Morales',
        lastNameMaterno: 'Castillo',
        fullName: 'Ricardo Morales Castillo',
        hireDate: '2023-11-01',
        licenseNumber: 'LIC-MC-7712',
        licenseExpirationDate: '2026-07-15', // Vencida
        licenseStatus: 'VENCIDA',
        scorecard: {
          movementsThisMonth: 120,
          locationAccuracyPercentage: 94.1,
          safetyRating: 3.8,
          shift: 'Turno 3 - Nocturno',
        },
        status: 'INACTIVO',
      },
    ];
  }
}
