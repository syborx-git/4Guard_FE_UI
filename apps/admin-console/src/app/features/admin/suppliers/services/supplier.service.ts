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
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, delay, map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  Supplier,
  SupplierApiResponse,
  SupplierListParams,
  SupplierStatusChangeRequest,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  normalizeCodeOrTaxId,
  SupplierPagedResponse,
  SupplierAuditEntry,
  SupplierAuditDetail,
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
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/suppliers`;
  private readonly USE_MOCK = false;

  // ─── Estado Reactivo (Signals) ──────────────────────────────────────────────

  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly totalCount = signal<number>(0);
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(20);

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

    const orgId = this.getSessionOrgId();
    let httpParams = new HttpParams()
      .set('organizationId', orgId)
      .set('page', '0')
      .set('size', '1000') // Carga un volumen alto para soportar el filtrado reactivo local en el FE
      .set('sortBy', 'updatedAt')
      .set('sortDir', 'DESC');

    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.type) httpParams = httpParams.set('type', params.type);
      if (params.scopeType) httpParams = httpParams.set('scopeType', params.scopeType);
      if (params.clientId) httpParams = httpParams.set('clientId', params.clientId);
      if (params.warehouseId) httpParams = httpParams.set('warehouseId', params.warehouseId);
      if (params.preferredOnly !== undefined) httpParams = httpParams.set('preferredOnly', params.preferredOnly.toString());
    }

    return this.http.get<SupplierApiResponse<SupplierPagedResponse>>(this.API_URL, { params: httpParams }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.totalCount.set(res.data.totalElements);
        }
      }),
      map(res => ({
        ...res,
        data: res.data ? res.data.content : []
      })),
      tap(res => {
        this.suppliers.set(res.data);
        this.loading.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Métodos de Escritura ────────────────────────────────────────────────────

  /**
  /**
   * Obtiene el detalle completo de un proveedor.
   * GET /api/v1/suppliers/{id}
   */
  getSupplierById(id: string): Observable<SupplierApiResponse<Supplier>> {
    return this.http.get<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`).pipe(
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Obtiene el historial de auditoría de un proveedor como timeline.
   * GET /api/v1/suppliers/{id}/audit
   */
  getSupplierAudit(id: string): Observable<SupplierApiResponse<SupplierAuditEntry[]>> {
    return this.http.get<SupplierApiResponse<SupplierAuditEntry[]>>(`${this.API_URL}/${id}/audit`).pipe(
      tap(res => {
        // Enriquecer entradas con iconos y colores para el timeline
        res.data?.forEach(entry => {
          entry.timelineIcon = this.getAuditIcon(entry.action);
          entry.timelineColor = this.getAuditColor(entry.action);
          entry.summary = this.getAuditSummary(entry);
        });
      }),
      catchError(err => this.handleError(err))
    );
  }

  private getAuditIcon(action: string): string {
    const map: Record<string, string> = {
      SUPPLIER_CREATED: 'add_circle',
      SUPPLIER_UPDATED: 'edit',
      SUPPLIER_STATUS_UPDATED: 'swap_horiz',
      SUPPLIER_ARCHIVED: 'delete_forever',
    };
    return map[action] ?? 'info';
  }

  private getAuditColor(action: string): 'create' | 'update' | 'status' {
    const map: Record<string, 'create' | 'update' | 'status'> = {
      SUPPLIER_CREATED: 'create',
      SUPPLIER_UPDATED: 'update',
      SUPPLIER_STATUS_UPDATED: 'status',
      SUPPLIER_ARCHIVED: 'status',
    };
    return map[action] ?? 'update';
  }

  private getAuditSummary(entry: SupplierAuditEntry): string {
    if (entry.action === 'SUPPLIER_CREATED') {
      return 'Registró el proveedor en el catálogo maestro';
    }
    if (entry.action === 'SUPPLIER_STATUS_UPDATED') {
      const statusDet = entry.details?.find(d => d.fieldName === 'status');
      const reasonDet = entry.details?.find(d => d.fieldName === 'statusReason');
      
      const newStatus = statusDet?.newValue || '';
      const oldStatus = statusDet?.oldValue || '';
      const reason = reasonDet?.newValue;

      let msg = 'Cambió el estado';
      if (oldStatus && newStatus) {
        msg += ` de ${oldStatus} a ${newStatus}`;
      } else if (newStatus) {
        msg += ` a ${newStatus}`;
      }
      if (reason) {
        msg += `: "${reason}"`;
      }
      return msg;
    }
    if (entry.action === 'SUPPLIER_UPDATED') {
      return 'Actualizó la información del proveedor';
    }
    if (entry.action === 'SUPPLIER_ARCHIVED') {
      return 'Archivó el proveedor (eliminación lógica)';
    }
    return entry.action;
  }

  /**
   * Crea un nuevo proveedor en el catálogo.
   * El backend ejecutará transacción: guardar entidad + contacto + dirección + términos + audit_logs.
   */
  createSupplier(dto: CreateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
    const orgId = this.getSessionOrgId();
    const payload = {
      ...dto,
      organizationId: orgId
    };

    return this.http.post<SupplierApiResponse<Supplier>>(this.API_URL, payload).pipe(
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
   * GET /api/v1/suppliers/{id}
   */
  updateSupplier(id: string, dto: UpdateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
    const orgId = this.getSessionOrgId();
    const existing = this.suppliers().find(s => s.id === id);
    const currentVersion = existing ? existing.version || 1 : 1;
    const payload = {
      ...dto,
      organizationId: orgId,
      version: currentVersion
    };

    return this.http.put<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`, payload).pipe(
      tap(res => {
        this.suppliers.update(list => list.map(s => s.id === id ? res.data : s));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Cambia el estado del proveedor (Activo / Inactivo / Bloqueado) registrando motivo.
   */
  changeSupplierStatus(id: string, dto: SupplierStatusChangeRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
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
   */
  archiveSupplier(id: string): Observable<SupplierApiResponse<void>> {
    this.saving.set(true);
    return this.http.delete<SupplierApiResponse<void>>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
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

  private getSessionOrgId(): string {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.user?.organizationId) {
          return session.user.organizationId;
        }
      }
    } catch {}
    return 'a53f0907-9fa5-4bdf-87db-2eb5e7683935'; // Fallback por defecto (4GUARD)
  }

  // ─── Manejo de Errores ──────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
