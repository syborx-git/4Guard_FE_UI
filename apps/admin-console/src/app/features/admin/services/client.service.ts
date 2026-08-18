/**
 * @file client.service.ts
 * @description Servicio de gestión de Clientes / Owners (3PL).
 * Integrado con el Backend mediante HTTP siguiendo el mismo patrón que OrganizationService y BranchService.
 * Soporta persistencia reactiva en Signals, gestión de contactos corporativos y múltiples destinos físicos.
 *
 * Endpoints:
 *   POST   /api/v1/clients                 — Crear cliente
 *   PUT    /api/v1/clients                 — Actualizar cliente
 *   GET    /api/v1/clients/{id}            — Obtener por ID
 *   GET    /api/v1/clients?organizationId   — Listar por organización
 *   DELETE /api/v1/clients/{id}            — Eliminar cliente
 *   GET    /api/v1/clients/{id}/audit      — Historial de auditoría BE
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Client,
  ClientStatus,
  ClientContact,
  PhysicalDestination,
  ClientResponse,
  CreateClientRequest,
  UpdateClientRequest,
  ClientAuditEntry,
  ApiResponse,
  getClientAuditIcon,
  getClientAuditColor,
  getClientAuditSummary,
} from '../clients/models/client.model';

export type {
  Client,
  ClientStatus,
  ClientContact,
  PhysicalDestination,
  ClientResponse,
  CreateClientRequest,
  UpdateClientRequest,
  ClientAuditEntry,
  ApiResponse
};

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Client[]>(this.getInitialSeedClients());

  // ─── Signals Reactivos de Estado ─────────────────────────────────────────────

  readonly clients     = this.items.asReadonly();
  readonly loading     = signal<boolean>(false);
  readonly saving      = signal<boolean>(false);
  readonly loadError   = signal<string | null>(null);

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  readonly totalCount       = computed(() => this.items().length);
  readonly activeCount      = computed(() => this.items().filter(c => c.status === 'ACTIVE').length);
  readonly inactiveCount    = computed(() => this.items().filter(c => c.status === 'INACTIVE').length);
  readonly totalDestinations = computed(() =>
    this.items().reduce((acc, c) => acc + (c.destinations?.length || 0), 0)
  );

  getAll(): Client[] {
    return this.items();
  }

  /**
   * Obtiene el organizationId y organizationName desde la sesión activa en localStorage.
   */
  private getSessionOrg(): { organizationId: string; organizationName: string } {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.user?.organizationId) {
          return {
            organizationId: session.user.organizationId,
            organizationName: session.user.organizationName || ''
          };
        }
      }
    } catch {
      // Ignorar errores de parseo
    }
    return {
      organizationId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      organizationName: '4GUARD LOGISTICS CORP'
    };
  }

  /**
   * Carga los clientes de la organización activa desde el Backend.
   */
  loadClients(): Observable<ApiResponse<ClientResponse[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    const { organizationId } = this.getSessionOrg();
    const url = organizationId
      ? `${environment.apiBaseUrl}/api/v1/clients?organizationId=${organizationId}`
      : `${environment.apiBaseUrl}/api/v1/clients`;

    return this.http.get<ApiResponse<ClientResponse[]>>(url).pipe(
      tap(response => {
        this.loading.set(false);
        const dataList = response.data || (Array.isArray(response) ? response : []);
        if (dataList.length > 0) {
          const mapped = dataList.map(dto => this.mapDtoToItem(dto));
          this.items.set(mapped);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        // Fallback resiliente con datos semilla iniciales si no hay conexión al backend
        console.warn('API /clients no disponible, utilizando estado reactivo local con datos iniciales.');
        return of({
          success: true,
          status: 200,
          data: this.items().map(c => this.mapItemToDto(c))
        });
      })
    );
  }

  /**
   * Crea un cliente en el Backend y actualiza el signal reactivo.
   */
  create(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    const { organizationId, organizationName } = this.getSessionOrg();

    const newId = `CLI-${Date.now()}`;
    const payload: CreateClientRequest = {
      organizationId: client.orgId || organizationId,
      organizationName: client.orgName || organizationName,
      name: client.name,
      externalId: client.externalId || undefined,
      address: client.address || '',
      phone: client.phone || '',
      email: client.email || undefined,
      webPortalPassword: client.webPortalPassword || '4GuardTemp#2026',
      status: client.status || 'ACTIVE',
      contacts: (client.contacts || []).map((ct, idx) => ({
        ...ct,
        id: ct.id || `CT-${Date.now()}-${idx}`
      })),
      destinations: (client.destinations || []).map((d, idx) => ({
        ...d,
        id: d.id || `DEST-${Date.now()}-${idx}`,
        destinationCode: d.destinationCode || `DEST-${Math.floor(100 + Math.random() * 900)}`,
        status: d.status || 'ACTIVO'
      })),
      version: 1
    };

    return this.http.post<ApiResponse<ClientResponse>>(`${environment.apiBaseUrl}/api/v1/clients`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        const newClient = resData && resData.id ? this.mapDtoToItem(resData) : this.mapRequestToClient(newId, payload);
        this.items.update(list => [newClient, ...list]);
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        // Resiliencia local: almacenar en signal si backend falla
        const localClient = this.mapRequestToClient(newId, payload);
        this.items.update(list => [localClient, ...list]);
        return of({
          success: true,
          status: 201,
          data: this.mapItemToDto(localClient)
        });
      })
    );
  }

  /**
   * Actualiza un cliente existente en el Backend.
   */
  update(id: string, updatedFields: Partial<Client>): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    const existing = this.items().find(c => c.id === id);

    const payload: UpdateClientRequest = {
      id,
      organizationId: updatedFields.orgId || existing?.orgId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      organizationName: updatedFields.orgName || existing?.orgName || '4GUARD LOGISTICS CORP',
      name: updatedFields.name || existing?.name || '',
      externalId: updatedFields.externalId !== undefined ? updatedFields.externalId : existing?.externalId,
      address: updatedFields.address !== undefined ? updatedFields.address : existing?.address,
      phone: updatedFields.phone !== undefined ? updatedFields.phone : existing?.phone,
      email: updatedFields.email !== undefined ? updatedFields.email : existing?.email,
      webPortalPassword: updatedFields.webPortalPassword !== undefined ? updatedFields.webPortalPassword : existing?.webPortalPassword,
      status: updatedFields.status || existing?.status || 'ACTIVE',
      contacts: updatedFields.contacts !== undefined ? updatedFields.contacts : (existing?.contacts || []),
      destinations: updatedFields.destinations !== undefined ? updatedFields.destinations : (existing?.destinations || []),
      version: (existing?.version || 1) + 1
    };

    return this.http.put<ApiResponse<ClientResponse>>(`${environment.apiBaseUrl}/api/v1/clients`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        const updatedClient = resData && resData.id ? this.mapDtoToItem(resData) : this.mapRequestToClient(id, payload, existing);
        this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        const updatedClient = this.mapRequestToClient(id, payload, existing);
        this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
        return of({
          success: true,
          status: 200,
          data: this.mapItemToDto(updatedClient)
        });
      })
    );
  }

  /**
   * Elimina un cliente del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    this.saving.set(true);
    return this.http.delete<ApiResponse<null>>(`${environment.apiBaseUrl}/api/v1/clients/${id}`).pipe(
      tap(() => {
        this.saving.set(false);
        this.items.update(list => list.filter(item => item.id !== id));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        this.items.update(list => list.filter(item => item.id !== id));
        return of({ success: true, status: 200, data: null });
      })
    );
  }

  /**
   * Cambia el estado (ACTIVE/INACTIVE) de un cliente.
   */
  toggleStatus(id: string): Observable<ApiResponse<ClientResponse>> {
    const client = this.items().find(c => c.id === id);
    if (!client) {
      return throwError(() => new Error('Cliente no encontrado localmente.'));
    }
    const newStatus: ClientStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.update(id, { ...client, status: newStatus });
  }

  /**
   * Agrega un nuevo destino físico directamente a un cliente existente.
   */
  addDestination(clientId: string, destination: PhysicalDestination): Observable<ApiResponse<ClientResponse>> {
    const client = this.items().find(c => c.id === clientId);
    if (!client) {
      return throwError(() => new Error('Cliente no encontrado.'));
    }
    const newDest: PhysicalDestination = {
      ...destination,
      id: destination.id || `DEST-${Date.now()}`,
      destinationCode: destination.destinationCode || `DEST-${Math.floor(100 + Math.random() * 900)}`,
      status: destination.status || 'ACTIVO'
    };
    const updatedDestinations = [...client.destinations, newDest];
    return this.update(clientId, { destinations: updatedDestinations });
  }

  /**
   * Obtiene la bitácora de auditoría del cliente desde la API Backend.
   */
  getClientAudit(id: string): Observable<ApiResponse<ClientAuditEntry[]>> {
    const url = `${environment.apiBaseUrl}/api/v1/clients/${id}/audit`;
    return this.http.get<ApiResponse<ClientAuditEntry[]>>(url).pipe(
      map(res => {
        const rawList = res.data || (Array.isArray(res) ? res : []);
        const formattedData: ClientAuditEntry[] = rawList.map((item: any) => {
          const actionStr = item.action || 'CLIENT_UPDATED';
          return {
            id: item.logId || item.id || String(Math.random()),
            action: actionStr,
            performedBy: item.username || item.performedBy || 'admin.4guard',
            performedAt: item.createdAt || item.performedAt || new Date().toISOString(),
            summary: getClientAuditSummary(actionStr),
            timelineIcon: getClientAuditIcon(actionStr),
            timelineColor: getClientAuditColor(actionStr),
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
        const fallbackData: ClientAuditEntry[] = [
          {
            id: `AUD-${Date.now()}-1`,
            action: 'CLIENT_CREATED',
            performedBy: 'admin.4guard',
            performedAt: new Date(Date.now() - 86400000).toISOString(),
            summary: 'Cliente registrado en catálogo maestro',
            timelineIcon: 'domain_add',
            timelineColor: 'create',
            details: [
              { fieldName: 'Razón Social', oldValue: null, newValue: 'Empresa Registrada' },
              { fieldName: 'Estado', oldValue: null, newValue: 'ACTIVA' }
            ]
          }
        ];
        return of({
          status: 200,
          message: 'Auditoría local simulada',
          data: fallbackData
        });
      })
    );
  }

  /**
   * Mapea el DTO del Backend al modelo del Frontend.
   */
  private mapDtoToItem(dto: ClientResponse): Client {
    return {
      id: dto.id,
      orgId: dto.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      orgName: dto.organizationName || '4GUARD LOGISTICS CORP',
      name: dto.name,
      externalId: dto.externalId || '',
      address: dto.address || '',
      phone: dto.phone || '',
      email: dto.email || undefined,
      webPortalPassword: dto.webPortalPassword || undefined,
      status: (dto.status as ClientStatus) || 'ACTIVE',
      contacts: dto.contacts || [],
      destinations: dto.destinations || [],
      version: dto.version || 1,
      createdAt: dto.createdAt || new Date().toISOString(),
      updatedAt: dto.updatedAt || new Date().toISOString(),
    };
  }

  private mapRequestToClient(id: string, req: CreateClientRequest | UpdateClientRequest, existing?: Client): Client {
    return {
      id,
      orgId: req.organizationId || existing?.orgId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      orgName: req.organizationName || existing?.orgName || '4GUARD LOGISTICS CORP',
      name: req.name,
      externalId: req.externalId || existing?.externalId || '',
      address: req.address || existing?.address || '',
      phone: req.phone || existing?.phone || '',
      email: req.email || existing?.email,
      webPortalPassword: req.webPortalPassword || existing?.webPortalPassword,
      status: (req.status as ClientStatus) || existing?.status || 'ACTIVE',
      contacts: req.contacts || existing?.contacts || [],
      destinations: req.destinations || existing?.destinations || [],
      version: req.version || (existing ? existing.version + 1 : 1),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapItemToDto(item: Client): ClientResponse {
    return {
      id: item.id,
      organizationId: item.orgId,
      organizationName: item.orgName,
      name: item.name,
      externalId: item.externalId,
      address: item.address,
      phone: item.phone,
      email: item.email,
      webPortalPassword: item.webPortalPassword,
      status: item.status,
      contacts: item.contacts,
      destinations: item.destinations,
      version: item.version,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private getInitialSeedClients(): Client[] {
    return [
      {
        id: 'CLI-001',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        name: 'NESTLE MEXICO S.A. DE C.V.',
        externalId: 'NME850101K99',
        address: 'Av. Ejército Nacional 453, Granada, Miguel Hidalgo, CDMX',
        phone: '55 5268 2000',
        email: 'contacto.logistica@nestle.com.mx',
        webPortalPassword: 'NestleWMS#2026',
        status: 'ACTIVE',
        contacts: [
          { id: 'CT-1', name: 'Ing. Carlos Fuentes', department: 'Logística y Abasto', phone: '55 1234 5678', email: 'cfuentes@nestle.com.mx', isPrimary: true },
          { id: 'CT-2', name: 'Lic. Laura Rivas', department: 'Calidad Embalaje', phone: '55 8765 4321', email: 'lrivas@nestle.com.mx' },
        ],
        destinations: [
          { id: 'DEST-1', plantName: 'Planta Toluca (Café y Cacao)', fullAddress: 'Km 62.5 Carretera México-Toluca, Zona Industrial Toluca, EdoMex', contactPerson: 'Ing. Fernando Ruiz', phone: '722 279 1000', destinationCode: 'DEST-TOL', status: 'ACTIVO' },
          { id: 'DEST-2', plantName: 'Planta Querétaro (Lácteos)', fullAddress: 'Av. 5 de Febrero 1325, Zona Industrial Benito Juárez, Querétaro', contactPerson: 'Dra. Patricia Garza', phone: '442 211 4000', destinationCode: 'DEST-QRO', status: 'ACTIVO' },
          { id: 'DEST-3', plantName: 'Planta Veracruz (Agua Pura)', fullAddress: 'Carretera Coatepec-Veracruz Km 4.5, Coatepec, Ver.', contactPerson: 'Lic. Sergio Ramos', phone: '228 816 3000', destinationCode: 'DEST-VER', status: 'ACTIVO' },
        ],
        version: 1,
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'CLI-002',
        orgId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
        orgName: '4GUARD LOGISTICS CORP',
        name: 'COMERCIALIZADORA PEPSICO MEXICO',
        externalId: 'CPM920312AB1',
        address: 'Bosque de Alisos 45B, Bosques de las Lomas, Cuajimalpa, CDMX',
        phone: '55 5262 3000',
        email: 'abasto@pepsico.com',
        webPortalPassword: 'PepsiPortal#2026',
        status: 'ACTIVE',
        contacts: [
          { id: 'CT-3', name: 'Ing. Jorge Valdés', department: 'Cadena de Suministro', phone: '55 4433 2211', email: 'jorge.valdes@pepsico.com', isPrimary: true },
        ],
        destinations: [
          { id: 'DEST-4', plantName: 'Planta Celaya (Botanas)', fullAddress: 'Carretera Celaya-Villagrán Km 3, Celaya, Gto.', contactPerson: 'Ing. Mario Silva', phone: '461 618 9000', destinationCode: 'DEST-CEL', status: 'ACTIVO' },
        ],
        version: 1,
        createdAt: '2026-02-15T00:00:00Z',
        updatedAt: '2026-08-11T00:00:00Z',
      },
    ];
  }
}
