/**
 * @file mock-backend.interceptor.ts
 * @description Interceptor HTTP funcional que simula el Backend (Spring Boot) en memoria
 * y persiste el estado en localStorage para permitir flujos completos sin servidor real.
 */

import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { InventoryStatus } from '../../domain/enums/inventory-status.enum';
import { UserRole } from '../../domain/enums/role.enum';
import { Item, UnitOfMeasure } from '../../domain/models/item.model';

/**
 * Base de datos mock en localStorage para persistencia de estado de la demo
 */
const DB_KEY = '4guard_mock_db';

interface MockDatabase {
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    branchId: string;
    isActive: boolean;
  }>;
  items: Item[];
}

const INITIAL_DB: MockDatabase = {
  users: [
    { id: 'u-001', fullName: 'Carlos Herrera', email: 'admin@4guard.mx', role: UserRole.ADMIN, branchId: 'BR-MTY-01', isActive: true },
    { id: 'u-002', fullName: 'Sofía Ramírez', email: 'manager@4guard.mx', role: UserRole.WAREHOUSE_MANAGER, branchId: 'BR-MTY-01', isActive: true },
    { id: 'u-003', fullName: 'Miguel Torres', email: 'dock@4guard.mx', role: UserRole.DOCK_SUPERVISOR, branchId: 'BR-MTY-01', isActive: true },
    { id: 'u-004', fullName: 'Ana López', email: 'qm@4guard.mx', role: UserRole.QM_INSPECTOR, branchId: 'BR-MTY-01', isActive: true },
    { id: 'u-005', fullName: 'Roberto Sánchez', email: 'op1@4guard.mx', role: UserRole.WAREHOUSE_OPERATOR, branchId: 'BR-MTY-01', isActive: true }
  ],
  items: [
    {
      id: 'SSCC-0001',
      sku: 'SKU-CAFE-001',
      description: 'Café Molido Premium 500g',
      clientId: 'CLI-NESPRESSO',
      clientName: 'Nespresso México',
      batchNumber: 'L2024-001',
      expiryDate: '2025-06-10T00:00:00Z',
      quantity: 48,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-A1-01',
      status: InventoryStatus.AVAILABLE,
      branchId: 'BR-MTY-01',
      weightKg: 24,
      volumeM3: 0.1,
      barcode: '7501020304051',
      sscc: '375010203040500018',
      receivedAt: '2024-06-10T08:00:00Z',
      lastStatusChangeAt: '2024-06-10T08:00:00Z',
      notes: 'Ingreso inicial',
      metadata: null
    },
    {
      id: 'SSCC-0002',
      sku: 'SKU-CAFE-001',
      description: 'Café Molido Premium 500g',
      clientId: 'CLI-NESPRESSO',
      clientName: 'Nespresso México',
      batchNumber: 'L2024-002',
      expiryDate: '2025-06-12T00:00:00Z',
      quantity: 36,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-A1-02',
      status: InventoryStatus.AVAILABLE,
      branchId: 'BR-MTY-01',
      weightKg: 18,
      volumeM3: 0.08,
      barcode: '7501020304051',
      sscc: '375010203040500025',
      receivedAt: '2024-06-12T10:30:00Z',
      lastStatusChangeAt: '2024-06-12T10:30:00Z',
      notes: 'Lote secundario',
      metadata: null
    },
    {
      id: 'SSCC-0003',
      sku: 'SKU-AGUA-002',
      description: 'Agua Purificada 19L',
      clientId: 'CLI-BONAFONT',
      clientName: 'Bonafont S.A.',
      batchNumber: 'L2024-003',
      expiryDate: '2024-12-14T00:00:00Z',
      quantity: 24,
      unitOfMeasure: UnitOfMeasure.UNIT,
      locationId: 'LOC-Q-01',
      status: InventoryStatus.QUARANTINE,
      branchId: 'BR-MTY-01',
      weightKg: 456,
      volumeM3: 0.5,
      barcode: '7501008003123',
      sscc: '375010080031200032',
      receivedAt: '2024-06-14T09:00:00Z',
      lastStatusChangeAt: '2024-06-14T09:00:00Z',
      notes: 'En cuarentena preventiva',
      metadata: null
    },
    {
      id: 'SSCC-0004',
      sku: 'SKU-LECHE-003',
      description: 'Leche Entera UHT 1L',
      clientId: 'CLI-LALA',
      clientName: 'Lala S.A.',
      batchNumber: 'L2024-004',
      expiryDate: '2024-09-08T00:00:00Z',
      quantity: 120,
      unitOfMeasure: UnitOfMeasure.UNIT,
      locationId: 'LOC-B2-03',
      status: InventoryStatus.QM_BLOCKED,
      branchId: 'BR-MTY-01',
      weightKg: 120,
      volumeM3: 0.2,
      barcode: '7501020304060',
      sscc: '375010203040600010',
      receivedAt: '2024-06-08T07:00:00Z',
      lastStatusChangeAt: '2024-06-15T14:00:00Z',
      notes: 'Bloqueado por falla de temperatura',
      metadata: null
    }
  ]
};

function getDb(): MockDatabase {
  const data = localStorage.getItem(DB_KEY);
  if (!data) {
    localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DB));
    return INITIAL_DB;
  }
  return JSON.parse(data) as MockDatabase;
}

function saveDb(db: MockDatabase): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/**
 * Interceptor de Backend Simulado
 */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;

  // Interceptar endpoint de Login
  if (url.includes('/api/auth/login') && req.method === 'POST') {
    const db = getDb();
    const body = req.body as { email?: string; password?: string };
    const user = db.users.find(u => u.email === body.email);

    if (user) {
      const response = {
        accessToken: `mock-jwt-token-for-${user.role}-${Date.now()}`,
        refreshToken: `mock-refresh-token-for-${user.role}-${Date.now()}`,
        user: user
      };
      return of(new HttpResponse({ status: 200, body: response })).pipe(delay(500));
    } else {
      return throwError(() => new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        error: { message: 'Usuario no registrado en la base de datos de la demo.' }
      })).pipe(delay(500));
    }
  }

  // Interceptar endpoint de Refresh Token
  if (url.includes('/api/auth/refresh') && req.method === 'POST') {
    const db = getDb();
    const body = req.body as { refreshToken?: string };
    // Extraer rol del token simulado
    const match = body.refreshToken?.match(/mock-refresh-token-for-(ROLE_[A-Z_]+)-/);
    const role = match ? match[1] as UserRole : UserRole.ADMIN;
    const user = db.users.find(u => u.role === role) || db.users[0];

    const response = {
      accessToken: `mock-jwt-token-for-${role}-${Date.now()}`,
      refreshToken: `mock-refresh-token-for-${role}-${Date.now()}`,
      user: user
    };
    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  // Interceptar GET Items del Inventario
  if (url.includes('/api/inventory/items') && req.method === 'GET') {
    const db = getDb();

    // Filtros de URL
    const statusParam = req.params.get('status');
    const skuParam = req.params.get('sku');

    let filteredItems = db.items;
    if (statusParam) {
      filteredItems = filteredItems.filter(i => i.status === Number(statusParam));
    }
    if (skuParam) {
      filteredItems = filteredItems.filter(i => i.sku.toLowerCase().includes(skuParam.toLowerCase()));
    }

    const response = {
      content: filteredItems,
      totalElements: filteredItems.length,
      totalPages: 1,
      page: 0,
      size: 20
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(300));
  }

  // Pasar peticiones no mockeadas al backend real
  return next(req);
};
