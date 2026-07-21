/**
 * @file supplier.service.ts
 * @description Servicio de Gestión de Proveedores (HU-125) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Responsabilidades
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Centralizar llamadas HTTP al recurso /api/suppliers
 *  - Exponer estado reactivo mediante Angular Signals
 *  - Ofrecer contadores computed (`activeCount`, `unavailableCount`, `preferredCount`, `totalCount`)
 *  - Proporcionar validación preventiva de duplicados (código, RFC/TaxID, Razón social)
 *  - Mantener datos mock robustos con soporte de alcance 3PL (GLOBAL, CLIENT, WAREHOUSE)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENDPOINTS FUTUROS DE BACKEND (SPRING BOOT + RLS)
 * ═══════════════════════════════════════════════════════════════════════════
 *  GET    /api/suppliers             — Listar proveedores (RLS aplicado en backend)
 *  POST   /api/suppliers             — Crear proveedor (Guardado transaccional en DB)
 *  PUT    /api/suppliers/{id}        — Actualizar proveedor
 *  PATCH  /api/suppliers/{id}/status — Cambiar estado (Activo / Inactivo / Bloqueado)
 *  DELETE /api/suppliers/{id}        — Archivar / Eliminación lógica (active=false, deleted=true)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REGLAS DE AUDITORÍA Y TRANSACCIONALIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *  El backend ejecutará dentro de una sola transacción:
 *   1. Guardar/Actualizar la entidad Proveedor, Contacto, Dirección y Condiciones.
 *   2. Generar el registro en la tabla `audit_logs`.
 *   3. En caso de error en cualquier paso, realiza rollback automático.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, delay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Supplier,
  SupplierApiResponse,
  SupplierListParams,
  SupplierStatusChangeRequest,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  normalizeCodeOrTaxId,
} from '../models/supplier.model';

// ─── Datos Mock (7 Proveedores Representativos 3PL) ─────────────────────────

const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'prv-001',
    code: 'PRV-0001',
    legalName: 'Empaques Nacionales del Norte S.A. de C.V.',
    commercialName: 'EmpaquesNorte',
    taxId: 'ENN980415HG8',
    type: 'PACKAGING',
    status: 'ACTIVE',
    preferred: true,
    contact: {
      fullName: 'Carlos Eduardo Mendoza',
      jobTitle: 'Gerente de Cuentas Clave',
      email: 'cmendoza@empaquesnorte.com.mx',
      phone: '8183456789',
      altPhone: '8181239900',
    },
    address: {
      country: 'México',
      state: 'Nuevo León',
      municipality: 'Apodaca',
      city: 'Monterrey',
      postalCode: '66600',
      street: 'Av. Industrias Alimentarias',
      exteriorNumber: '450',
    },
    commercialTerms: {
      leadTimeDays: 3,
      minimumOrderAmount: 15000,
      creditDays: 30,
      currency: 'MXN',
      qualityInspectionRequired: true,
    },
    scopeType: 'GLOBAL',
    notes: 'Proveedor preferente para cajas de cartón corrugado y esquineros. Contrato anual renovado.',
    active: true,
    deleted: false,
    createdAt: '2024-01-10T08:30:00Z',
    updatedAt: '2026-06-15T14:20:00Z',
    createdBy: 'admin',
    updatedBy: 'jperez',
    lastAction: 'Creación de contrato anual 2026',
  },
  {
    id: 'prv-002',
    code: 'PRV-0002',
    legalName: 'Tarimas y Tarimas del Centro S. de R.L.',
    commercialName: 'Tarimas del Centro',
    taxId: 'TTC051120AB4',
    type: 'PALLETS',
    status: 'ACTIVE',
    preferred: true,
    contact: {
      fullName: 'Gabriela Silva Paredes',
      jobTitle: 'Coordinadora de Ventas',
      email: 'gsilva@tarimasdelcentro.com',
      phone: '5557890123',
    },
    address: {
      country: 'México',
      state: 'Estado de México',
      city: 'Toluca',
      postalCode: '50070',
      street: 'Vía José López Portillo',
      exteriorNumber: '1200',
    },
    commercialTerms: {
      leadTimeDays: 2,
      minimumOrderAmount: 25000,
      creditDays: 45,
      currency: 'MXN',
      qualityInspectionRequired: true,
    },
    scopeType: 'WAREHOUSE',
    warehouseId: 'WH-4GUARD-001',
    warehouseName: '4GUARD — Almacén Principal Toluca',
    notes: 'Suministro exclusivo de tarimas CHEP y taconas tratadas con norma HT / NOM-144-SEMARNAT.',
    active: true,
    deleted: false,
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2026-05-10T11:00:00Z',
    createdBy: 'admin',
    updatedBy: 'supervisor01',
    lastAction: 'Actualización de certificación fitosanitaria HT',
  },
  {
    id: 'prv-003',
    code: 'PRV-0003',
    legalName: 'Fumigaciones y Control Ambiental Toluca S.A.',
    commercialName: 'FumiToluca 3PL',
    taxId: 'FCA120803KL9',
    type: 'PEST_CONTROL',
    status: 'ACTIVE',
    preferred: false,
    contact: {
      fullName: 'Ing. Rodrigo Alarcón',
      jobTitle: 'Director Operativo',
      email: 'ralarcon@fumitoluca.mx',
      phone: '7229876543',
    },
    address: {
      country: 'México',
      state: 'Estado de México',
      city: 'Toluca',
      postalCode: '50120',
      street: 'Av. Tecnológico',
      exteriorNumber: '88',
    },
    commercialTerms: {
      leadTimeDays: 1, // Tiempo de respuesta en días para servicio
      minimumOrderAmount: 5000,
      creditDays: 15,
      currency: 'MXN',
      qualityInspectionRequired: false,
    },
    scopeType: 'WAREHOUSE',
    warehouseId: 'WH-4GUARD-001',
    warehouseName: '4GUARD — Almacén Principal Toluca',
    notes: 'Servicio mensual de fumigación y control integrado de plagas para áreas de almacenamiento seco y perecederos.',
    active: true,
    deleted: false,
    createdAt: '2024-05-12T09:00:00Z',
    updatedAt: '2026-07-01T16:30:00Z',
    createdBy: 'jperez',
    updatedBy: 'jperez',
    lastAction: 'Ejecución de fumigación mensual de zona de andenes',
  },
  {
    id: 'prv-004',
    code: 'PRV-0004',
    legalName: 'Montacargas y Mantenimiento del Valle S.A. de C.V.',
    commercialName: 'Montacargas del Valle',
    taxId: 'MMV090214RT1',
    type: 'MAINTENANCE',
    status: 'BLOCKED',
    statusReason: 'Incumplimiento de tiempo de respuesta en reparación crítica de montacargas Reach.',
    statusChangedAt: '2026-07-10T09:15:00Z',
    statusChangedBy: 'supervisor01',
    preferred: false,
    contact: {
      fullName: 'Lic. Fernando Gutiérrez',
      jobTitle: 'Jefe de Servicio Técnico',
      email: 'fgutierrez@montacargasvalle.com',
      phone: '5543210987',
    },
    address: {
      country: 'México',
      state: 'Ciudad de México',
      city: 'Azcapotzalco',
      postalCode: '02300',
      street: 'Calzada Vallejo',
      exteriorNumber: '780',
    },
    commercialTerms: {
      leadTimeDays: 2,
      minimumOrderAmount: 8000,
      creditDays: 30,
      currency: 'MXN',
      qualityInspectionRequired: true,
    },
    scopeType: 'CLIENT',
    clientId: 'cli-01',
    clientName: 'Lala S.A.',
    notes: 'Bloqueado temporalmente hasta resolver revisión de SLA de mantenimiento preventivo y correctivo.',
    active: true,
    deleted: false,
    createdAt: '2024-06-18T11:20:00Z',
    updatedAt: '2026-07-10T09:15:00Z',
    createdBy: 'admin',
    updatedBy: 'supervisor01',
    lastAction: 'Bloqueo temporal por incumplimiento de SLA de mantenimiento',
  },
  {
    id: 'prv-005',
    code: 'PRV-0005',
    legalName: 'Tecnología y Sistemas Logísticos MX S.A. de C.V.',
    commercialName: 'TecnoLogística MX',
    taxId: 'TSL160330PQ5',
    type: 'TECHNOLOGY',
    status: 'ACTIVE',
    preferred: true,
    contact: {
      fullName: 'Dra. Sofía Hernández',
      jobTitle: 'Account Executive WMS/IoT',
      email: 'shernandez@tecnologistica.mx',
      phone: '5511223344',
    },
    address: {
      country: 'México',
      state: 'Ciudad de México',
      city: 'Miguel Hidalgo',
      postalCode: '11560',
      street: 'Av. Paseo de la Reforma',
      exteriorNumber: '222',
      interiorNumber: 'Piso 8',
    },
    commercialTerms: {
      leadTimeDays: 1,
      minimumOrderAmount: 1200,
      creditDays: 30,
      currency: 'USD',
      qualityInspectionRequired: false,
    },
    scopeType: 'GLOBAL',
    notes: 'Proveedor de licencias de colectores de datos Zebra, impresoras térmicas e infraestructura IoT de patio.',
    active: true,
    deleted: false,
    createdAt: '2024-08-01T12:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    createdBy: 'admin',
    updatedBy: 'admin',
    lastAction: 'Renovación de licencias de colectores RF 2026',
  },
  {
    id: 'prv-006',
    code: 'PRV-0006',
    legalName: 'Limpieza Industrial y Servicios 4G S.A. de C.V.',
    commercialName: 'Limpieza 4G',
    taxId: 'LIS190510UV2',
    type: 'CLEANING',
    status: 'INACTIVE',
    statusReason: 'Fin de contrato por licitación anual. Sustituido por proveedor local.',
    statusChangedAt: '2026-03-31T23:59:00Z',
    statusChangedBy: 'admin',
    preferred: false,
    contact: {
      fullName: 'Patricia Morales',
      jobTitle: 'Coordinadora de Personal',
      email: 'pmorales@limpieza4g.com',
      phone: '7224433221',
    },
    address: {
      country: 'México',
      state: 'Estado de México',
      city: 'Toluca',
      postalCode: '50000',
      street: 'Av. Morelos',
      exteriorNumber: '312',
    },
    commercialTerms: {
      leadTimeDays: 1,
      minimumOrderAmount: 10000,
      creditDays: 15,
      currency: 'MXN',
      qualityInspectionRequired: false,
    },
    scopeType: 'WAREHOUSE',
    warehouseId: 'WH-4GUARD-001',
    warehouseName: '4GUARD — Almacén Principal Toluca',
    notes: 'Inactivo. Se conserva el historial de facturación para auditoría fiscal.',
    active: true,
    deleted: false,
    createdAt: '2024-09-15T09:00:00Z',
    updatedAt: '2026-03-31T23:59:00Z',
    createdBy: 'jperez',
    updatedBy: 'admin',
    lastAction: 'Cierre de contrato de servicios de limpieza',
  },
  {
    id: 'prv-007',
    code: 'PRV-0007',
    legalName: 'Seguridad Operativa y Patrimonial del Centro S.A.',
    commercialName: 'Seguridad Operativa',
    taxId: 'SOP140108ZA9',
    type: 'SECURITY',
    status: 'ACTIVE',
    preferred: false,
    contact: {
      fullName: 'Capitán Alberto Morales',
      jobTitle: 'Comandante de Zona',
      email: 'amorales@seguridadoperativa.com.mx',
      phone: '5566778899',
    },
    address: {
      country: 'México',
      state: 'Ciudad de México',
      city: 'Cuauhtémoc',
      postalCode: '06600',
      street: 'Calle Insurgentes Sur',
      exteriorNumber: '105',
    },
    commercialTerms: {
      leadTimeDays: 1,
      minimumOrderAmount: 35000,
      creditDays: 30,
      currency: 'MXN',
      qualityInspectionRequired: true,
    },
    scopeType: 'GLOBAL',
    notes: 'Vigilancia 24/7 en casetas de control de acceso Smart Gate y patroleo perimetral en almacenes.',
    active: true,
    deleted: false,
    createdAt: '2024-11-01T08:00:00Z',
    updatedAt: '2026-06-01T09:00:00Z',
    createdBy: 'admin',
    updatedBy: 'supervisor01',
    lastAction: 'Revisión de bitácoras de turno de guardia',
  },
];

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiBaseUrl}/api/suppliers`;
  private readonly USE_MOCK = true;

  // ─── Estado Reactivo (Signals) ──────────────────────────────────────────────

  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly totalCount = signal<number>(0);

  // ─── Contadores Computed (Header KPI Cards) ───────────────────────────────

  /** Proveedores activos (status === 'ACTIVE' y no archivados). */
  readonly activeCount = computed(() =>
    this.suppliers().filter(s => s.status === 'ACTIVE' && s.active && !s.deleted).length
  );

  /** Proveedores no disponibles (status === 'INACTIVE' o 'BLOCKED'). */
  readonly unavailableCount = computed(() =>
    this.suppliers().filter(s => (s.status === 'INACTIVE' || s.status === 'BLOCKED') && s.active && !s.deleted).length
  );

  /** Proveedores preferentes (preferred === true). */
  readonly preferredCount = computed(() =>
    this.suppliers().filter(s => s.preferred && s.active && !s.deleted).length
  );

  /** Total de proveedores activos en el directorio. */
  readonly totalActiveCount = computed(() =>
    this.suppliers().filter(s => s.active && !s.deleted).length
  );

  // ─── Métodos de Lectura ──────────────────────────────────────────────────────

  /**
   * Carga la lista de proveedores aplicando filtros en memoria (mock) o query params (backend).
   * TODO: Conectar con GET /api/suppliers
   */
  loadSuppliers(params?: SupplierListParams): Observable<SupplierApiResponse<Supplier[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    if (this.USE_MOCK) {
      let result = MOCK_SUPPLIERS.filter(s => s.active && !s.deleted);

      const search = params?.search?.toLowerCase().trim();
      if (search) {
        const normalizedSearch = normalizeCodeOrTaxId(search);
        result = result.filter(s => {
          const matchCode = normalizeCodeOrTaxId(s.code).includes(normalizedSearch);
          const matchTax  = normalizeCodeOrTaxId(s.taxId).includes(normalizedSearch);
          const matchText =
            s.legalName.toLowerCase().includes(search) ||
            (s.commercialName && s.commercialName.toLowerCase().includes(search)) ||
            s.contact.fullName.toLowerCase().includes(search) ||
            s.contact.email.toLowerCase().includes(search) ||
            (s.address && s.address.city.toLowerCase().includes(search));
          return matchCode || matchTax || matchText;
        });
      }

      if (params?.status) {
        result = result.filter(s => s.status === params.status);
      }

      if (params?.type) {
        result = result.filter(s => s.type === params.type);
      }

      if (params?.scopeType) {
        result = result.filter(s => s.scopeType === params.scopeType);
      }

      if (params?.clientId) {
        result = result.filter(s => s.clientId === params.clientId);
      }

      if (params?.warehouseId) {
        result = result.filter(s => s.warehouseId === params.warehouseId);
      }

      if (params?.preferredOnly) {
        result = result.filter(s => s.preferred);
      }

      const mockResponse: SupplierApiResponse<Supplier[]> = {
        success: true,
        message: 'Catálogo de proveedores cargado correctamente (mock).',
        data: result,
        timestamp: new Date().toISOString(),
      };

      return of(mockResponse).pipe(
        delay(450),
        tap(res => {
          this.suppliers.set(res.data);
          this.totalCount.set(res.data.length);
          this.loading.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar GET /api/suppliers
    return this.http.get<SupplierApiResponse<Supplier[]>>(this.API_URL).pipe(
      tap(res => {
        this.suppliers.set(res.data);
        this.totalCount.set(res.data.length);
        this.loading.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Métodos de Escritura ────────────────────────────────────────────────────

  /**
   * Crea un nuevo proveedor en el catálogo.
   * TODO: Integrar POST /api/suppliers
   * TODO: El backend ejecutará transacción: guardar entidad + contacto + dirección + términos + audit_logs.
   */
  createSupplier(dto: CreateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const generatedCode = dto.code && dto.code.trim()
        ? normalizeCodeOrTaxId(dto.code)
        : `PRV-${String(MOCK_SUPPLIERS.length + 1).padStart(4, '0')}`;

      const newSupplier: Supplier = {
        ...dto,
        id: `prv-${Date.now()}`,
        code: generatedCode,
        taxId: normalizeCodeOrTaxId(dto.taxId),
        active: true,
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user', // TODO: Obtener usuario firmado de AuthService
        updatedBy: 'current-user',
        lastAction: 'Alta de proveedor en catálogo maestro',
      };

      MOCK_SUPPLIERS.push(newSupplier);

      const res: SupplierApiResponse<Supplier> = {
        success: true,
        message: 'Proveedor registrado exitosamente.',
        data: newSupplier,
        timestamp: new Date().toISOString(),
      };

      return of(res).pipe(
        delay(600),
        tap(() => {
          this.suppliers.update(list => [newSupplier, ...list]);
          this.totalCount.update(n => n + 1);
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar POST /api/suppliers
    return this.http.post<SupplierApiResponse<Supplier>>(this.API_URL, dto).pipe(
      tap(res => {
        this.suppliers.update(list => [res.data, ...list]);
        this.totalCount.update(n => n + 1);
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Actualiza los datos de un proveedor existente.
   * TODO: Integrar PUT /api/suppliers/{id}
   */
  updateSupplier(id: string, dto: UpdateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_SUPPLIERS.findIndex(s => s.id === id);
      if (idx === -1) {
        this.saving.set(false);
        return throwError(() => ({ status: 404, error: { message: 'Proveedor no encontrado.' } }));
      }

      const updated: Supplier = {
        ...MOCK_SUPPLIERS[idx],
        ...dto,
        id,
        taxId: normalizeCodeOrTaxId(dto.taxId),
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        lastAction: 'Actualización de datos generales y condiciones',
      };

      MOCK_SUPPLIERS[idx] = updated;

      const res: SupplierApiResponse<Supplier> = {
        success: true,
        message: 'Proveedor actualizado correctamente.',
        data: updated,
        timestamp: new Date().toISOString(),
      };

      return of(res).pipe(
        delay(600),
        tap(() => {
          this.suppliers.update(list => list.map(s => s.id === id ? updated : s));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar PUT /api/suppliers/{id}
    return this.http.put<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`, dto).pipe(
      tap(res => {
        this.suppliers.update(list => list.map(s => s.id === id ? res.data : s));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Cambia el estado del proveedor (Activo / Inactivo / Bloqueado) registrando motivo.
   * TODO: Integrar PATCH /api/suppliers/{id}/status
   */
  changeSupplierStatus(id: string, dto: SupplierStatusChangeRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_SUPPLIERS.findIndex(s => s.id === id);
      if (idx === -1) {
        this.saving.set(false);
        return throwError(() => ({ status: 404, error: { message: 'Proveedor no encontrado.' } }));
      }

      const updated: Supplier = {
        ...MOCK_SUPPLIERS[idx],
        status: dto.status,
        statusReason: dto.reason,
        statusChangedAt: new Date().toISOString(),
        statusChangedBy: 'current-user',
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        lastAction: `Cambio de estado a ${dto.status} — Motivo: ${dto.reason}`,
      };

      MOCK_SUPPLIERS[idx] = updated;

      const res: SupplierApiResponse<Supplier> = {
        success: true,
        message: `Estado de proveedor actualizado a ${dto.status}.`,
        data: updated,
        timestamp: new Date().toISOString(),
      };

      return of(res).pipe(
        delay(500),
        tap(() => {
          this.suppliers.update(list => list.map(s => s.id === id ? updated : s));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar PATCH /api/suppliers/{id}/status
    return this.http.patch<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}/status`, dto).pipe(
      tap(res => {
        this.suppliers.update(list => list.map(s => s.id === id ? res.data : s));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Archiva un proveedor (eliminación lógica).
   * El backend NUNCA borra físicamente registros con historial comercial/operativo.
   * TODO: Integrar DELETE /api/suppliers/{id}
   * TODO: Backend debe validar si existen recepciones abiertas, órdenes pendientes, citas o contratos vigentes.
   */
  archiveSupplier(id: string): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_SUPPLIERS.findIndex(s => s.id === id);
      if (idx === -1) {
        this.saving.set(false);
        return throwError(() => ({ status: 404, error: { message: 'Proveedor no encontrado.' } }));
      }

      const archived: Supplier = {
        ...MOCK_SUPPLIERS[idx],
        active: false,
        deleted: true,
        status: 'INACTIVE',
        statusReason: 'Archivado / Eliminado lógicamente del catálogo',
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        lastAction: 'Proveedor archivado del catálogo maestro',
      };

      MOCK_SUPPLIERS[idx] = archived;

      const res: SupplierApiResponse<Supplier> = {
        success: true,
        message: 'Proveedor archivado correctamente.',
        data: archived,
        timestamp: new Date().toISOString(),
      };

      return of(res).pipe(
        delay(500),
        tap(() => {
          this.suppliers.update(list => list.filter(s => s.id !== id));
          this.totalCount.update(n => Math.max(0, n - 1));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar DELETE /api/suppliers/{id}
    return this.http.delete<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`).pipe(
      tap(res => {
        this.suppliers.update(list => list.filter(s => s.id !== id));
        this.totalCount.update(n => Math.max(0, n - 1));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Validaciones Preventivas de Duplicidad ────────────────────────────────

  /** Verifica si un código de proveedor ya existe. */
  isCodeDuplicate(code: string, excludeId?: string): boolean {
    const norm = normalizeCodeOrTaxId(code);
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && normalizeCodeOrTaxId(s.code) === norm);
  }

  /** Verifica si un RFC / Tax ID ya existe dentro del mismo alcance RLS. */
  isTaxIdDuplicate(taxId: string, excludeId?: string): boolean {
    const norm = normalizeCodeOrTaxId(taxId);
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && normalizeCodeOrTaxId(s.taxId) === norm);
  }

  /** Verifica si una Razón Social ya existe normalizada. */
  isLegalNameDuplicate(legalName: string, excludeId?: string): boolean {
    const norm = legalName.trim().toLowerCase();
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && s.legalName.trim().toLowerCase() === norm);
  }

  // ─── Manejo de Errores ──────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
