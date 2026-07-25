/**
 * @file client.service.ts
 * @description Servicio de gestión de Clientes / Owners (3PL).
 * Integrado con el Backend mediante HTTP siguiendo el mismo patrón que OrganizationService y BranchService.
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
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Client,
  ClientStatus,
  ClientResponse,
  CreateClientRequest,
  UpdateClientRequest,
  ClientAuditEntry,
  ApiResponse,
  getClientAuditIcon,
  getClientAuditColor,
  getClientAuditSummary,
} from '../clients/models/client.model';

export type { Client, ClientStatus, ClientResponse, CreateClientRequest, UpdateClientRequest, ClientAuditEntry, ApiResponse };

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Client[]>([]);

  // ─── Signals Reactivos de Estado ─────────────────────────────────────────────

  readonly clients     = this.items.asReadonly();
  readonly loading     = signal<boolean>(false);
  readonly saving      = signal<boolean>(false);
  readonly loadError   = signal<string | null>(null);

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  readonly totalCount    = computed(() => this.items().length);
  readonly activeCount   = computed(() => this.items().filter(c => c.status === 'ACTIVE').length);
  readonly inactiveCount = computed(() => this.items().filter(c => c.status === 'INACTIVE').length);

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
        const mapped = dataList.map(dto => this.mapDtoToItem(dto));
        this.items.set(mapped);
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        const msg = error?.error?.message || error?.message || 'Error al cargar los clientes del servidor.';
        this.loadError.set(msg);
        return throwError(() => error);
      })
    );
  }

  /**
   * Crea un cliente en el Backend.
   */
  create(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    const { organizationId, organizationName } = this.getSessionOrg();

    const payload: CreateClientRequest = {
      organizationId: client.orgId || organizationId,
      organizationName: client.orgName || organizationName,
      name: client.name,
      externalId: client.externalId || undefined,
      status: client.status || 'ACTIVE',
      version: 1
    };

    return this.http.post<ApiResponse<ClientResponse>>(`${environment.apiBaseUrl}/api/v1/clients`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData && resData.id) {
          const newClient = this.mapDtoToItem(resData);
          this.items.update(list => [newClient, ...list]);
        } else {
          // Re-cargar si el DTO no vino completo
          this.loadClients().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
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
      status: updatedFields.status || existing?.status || 'ACTIVE',
      version: existing?.version || 1
    };

    return this.http.put<ApiResponse<ClientResponse>>(`${environment.apiBaseUrl}/api/v1/clients`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData && resData.id) {
          const updatedClient = this.mapDtoToItem(resData);
          this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
        } else {
          this.loadClients().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
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
        return throwError(() => error);
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
   * Obtiene la bitácora de auditoría del cliente desde la API Backend.
   * Endpoint: GET /api/v1/clients/{id}/audit
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
            performedBy: item.username || item.performedBy || 'enrique',
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
        console.error('Error al recuperar historial de auditoría de cliente:', error);
        return throwError(() => error);
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
      status: (dto.status as ClientStatus) || 'ACTIVE',
      version: dto.version || 1,
      createdAt: dto.createdAt || new Date().toISOString(),
      updatedAt: dto.updatedAt || new Date().toISOString(),
    };
  }
}
