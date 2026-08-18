/**
 * @file client.service.ts
 * @description Servicio de Gestión de Clientes / Owners 3PL — 4GUARD WMS.
 *
 * Integrado con el Backend mediante HTTP real (sin fallback a datos simulados).
 * Soporta persistencia reactiva en Signals, gestión de contactos corporativos y
 * múltiples destinos físicos (Ship-to Locations).
 *
 * Endpoints Backend (4guard_be — rama edj-cliente-destino-be):
 *   POST   /api/v1/clients                             — Crear cliente
 *   PUT    /api/v1/clients                             — Actualizar cliente
 *   GET    /api/v1/clients/{id}                        — Obtener por ID
 *   GET    /api/v1/clients?organizationId={id}         — Listar por organización
 *   DELETE /api/v1/clients/{id}                        — Eliminar cliente
 *   PATCH  /api/v1/clients/{id}/status                 — Toggle ACTIVE ↔ INACTIVE
 *   GET    /api/v1/clients/{id}/audit                  — Historial de auditoría
 *   GET    /api/v1/clients/{id}/destinations           — Listar destinos
 *   POST   /api/v1/clients/{id}/destinations           — Agregar destino
 *   PUT    /api/v1/clients/{id}/destinations/{destId}  — Actualizar destino
 *   DELETE /api/v1/clients/{id}/destinations/{destId}  — Eliminar destino
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
  private readonly items = signal<Client[]>([]);

  private readonly BASE_URL = `${environment.apiBaseUrl}/api/v1/clients`;

  // ─── Signals Reactivos de Estado ─────────────────────────────────────────────

  readonly clients     = this.items.asReadonly();
  readonly loading     = signal<boolean>(false);
  readonly saving      = signal<boolean>(false);
  readonly loadError   = signal<string | null>(null);

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  readonly totalCount        = computed(() => this.items().length);
  readonly activeCount       = computed(() => this.items().filter(c => c.status === 'ACTIVE').length);
  readonly inactiveCount     = computed(() => this.items().filter(c => c.status === 'INACTIVE').length);
  readonly totalDestinations = computed(() =>
    this.items().reduce((acc, c) => acc + (c.destinations?.length || 0), 0)
  );

  getAll(): Client[] {
    return this.items();
  }

  // ─── Obtener organizationId de la sesión activa ──────────────────────────────

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
      // Ignorar errores de parseo silenciosamente
    }
    return {
      organizationId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      organizationName: '4GUARD LOGISTICS CORP'
    };
  }

  // ─── Carga de Clientes desde el Backend ─────────────────────────────────────

  loadClients(): Observable<ApiResponse<ClientResponse[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    const { organizationId } = this.getSessionOrg();
    const url = `${this.BASE_URL}?organizationId=${organizationId}`;

    return this.http.get<ApiResponse<ClientResponse[]>>(url).pipe(
      tap(response => {
        this.loading.set(false);
        const dataList = response.data || (Array.isArray(response) ? response : []);
        const mapped = dataList.map(dto => this.mapDtoToItem(dto));
        this.items.set(mapped);
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        const msg = error?.error?.message || 'Error al cargar los clientes. Verifica la conexión con el servidor.';
        this.loadError.set(msg);
        return throwError(() => error);
      })
    );
  }

  // ─── Crear Cliente ───────────────────────────────────────────────────────────

  create(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    const { organizationId, organizationName } = this.getSessionOrg();

    const payload: CreateClientRequest = {
      organizationId: client.orgId || organizationId,
      organizationName: client.orgName || organizationName,
      name: client.name,
      externalId: client.externalId || undefined,
      taxId: client.taxId || undefined,
      address: client.address || '',
      phone: client.phone || '',
      email: client.email || undefined,
      webPortalPassword: client.webPortalPassword || undefined,
      status: client.status || 'ACTIVE',
      contacts: client.contacts || [],
      destinations: client.destinations || [],
    };

    return this.http.post<ApiResponse<ClientResponse>>(this.BASE_URL, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData?.id) {
          const newClient = this.mapDtoToItem(resData);
          this.items.update(list => [newClient, ...list]);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  // ─── Actualizar Cliente ──────────────────────────────────────────────────────

  update(id: string, updatedFields: Partial<Client>): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    const existing = this.items().find(c => c.id === id);

    const payload: UpdateClientRequest = {
      id,
      organizationId: updatedFields.orgId || existing?.orgId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      organizationName: updatedFields.orgName || existing?.orgName || '4GUARD LOGISTICS CORP',
      name: updatedFields.name || existing?.name || '',
      externalId: updatedFields.externalId !== undefined ? updatedFields.externalId : existing?.externalId,
      taxId: updatedFields.taxId !== undefined ? updatedFields.taxId : existing?.taxId,
      address: updatedFields.address !== undefined ? updatedFields.address : existing?.address,
      phone: updatedFields.phone !== undefined ? updatedFields.phone : existing?.phone,
      email: updatedFields.email !== undefined ? updatedFields.email : existing?.email,
      webPortalPassword: updatedFields.webPortalPassword !== undefined ? updatedFields.webPortalPassword : existing?.webPortalPassword,
      status: updatedFields.status || existing?.status || 'ACTIVE',
      contacts: updatedFields.contacts !== undefined ? updatedFields.contacts : (existing?.contacts || []),
      destinations: updatedFields.destinations !== undefined ? updatedFields.destinations : (existing?.destinations || []),
      version: (existing?.version || 1) + 1
    };

    return this.http.put<ApiResponse<ClientResponse>>(this.BASE_URL, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData?.id) {
          const updatedClient = this.mapDtoToItem(resData);
          this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  // ─── Eliminar Cliente ────────────────────────────────────────────────────────

  delete(id: string): Observable<ApiResponse<null>> {
    this.saving.set(true);
    return this.http.delete<ApiResponse<null>>(`${this.BASE_URL}/${id}`).pipe(
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

  // ─── Toggle de Estado (ACTIVE ↔ INACTIVE) ────────────────────────────────────

  toggleStatus(id: string): Observable<ApiResponse<ClientResponse>> {
    this.saving.set(true);
    return this.http.patch<ApiResponse<ClientResponse>>(`${this.BASE_URL}/${id}/status`, {}).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData?.id) {
          const updatedClient = this.mapDtoToItem(resData);
          this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  // ─── Gestión de Destinos Físicos (Endpoints Granulares) ──────────────────────

  addDestination(clientId: string, destination: PhysicalDestination): Observable<ApiResponse<PhysicalDestination>> {
    this.saving.set(true);
    return this.http.post<ApiResponse<PhysicalDestination>>(
      `${this.BASE_URL}/${clientId}/destinations`, destination
    ).pipe(
      tap(response => {
        this.saving.set(false);
        const newDest = response.data || (response as any);
        if (newDest?.id) {
          // Actualizar el signal reactivo agregando el destino al cliente correspondiente
          this.items.update(list => list.map(client =>
            client.id === clientId
              ? { ...client, destinations: [...client.destinations, newDest] }
              : client
          ));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  updateDestination(clientId: string, destinationId: string, destination: PhysicalDestination): Observable<ApiResponse<PhysicalDestination>> {
    this.saving.set(true);
    return this.http.put<ApiResponse<PhysicalDestination>>(
      `${this.BASE_URL}/${clientId}/destinations/${destinationId}`, destination
    ).pipe(
      tap(response => {
        this.saving.set(false);
        const updatedDest = response.data || (response as any);
        if (updatedDest?.id) {
          this.items.update(list => list.map(client =>
            client.id === clientId
              ? {
                  ...client,
                  destinations: client.destinations.map(d =>
                    d.id === destinationId ? updatedDest : d
                  )
                }
              : client
          ));
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  deleteDestination(clientId: string, destinationId: string): Observable<ApiResponse<null>> {
    this.saving.set(true);
    return this.http.delete<ApiResponse<null>>(
      `${this.BASE_URL}/${clientId}/destinations/${destinationId}`
    ).pipe(
      tap(() => {
        this.saving.set(false);
        this.items.update(list => list.map(client =>
          client.id === clientId
            ? { ...client, destinations: client.destinations.filter(d => d.id !== destinationId) }
            : client
        ));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  // ─── Historial de Auditoría (BE Endpoint) ────────────────────────────────────

  getClientAudit(id: string): Observable<ApiResponse<ClientAuditEntry[]>> {
    const url = `${this.BASE_URL}/${id}/audit`;
    return this.http.get<ApiResponse<ClientAuditEntry[]>>(url).pipe(
      map(res => {
        const rawList = res.data || (Array.isArray(res) ? res : []);
        const formattedData: ClientAuditEntry[] = rawList.map((item: any) => {
          const actionStr = item.action || 'CLIENT_UPDATED';
          return {
            id: item.logId || item.id || String(Math.random()),
            action: actionStr,
            performedBy: item.username || item.performedBy || 'sistema',
            performedAt: item.createdAt || item.performedAt || new Date().toISOString(),
            summary: getClientAuditSummary(actionStr),
            timelineIcon: getClientAuditIcon(actionStr),
            timelineColor: getClientAuditColor(actionStr),
            details: item.details || []
          };
        });
        return { status: res.status || 200, message: res.message || 'Auditoría recuperada', data: formattedData };
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  // ─── Mappers DTO ↔ Modelo Frontend ───────────────────────────────────────────

  private mapDtoToItem(dto: ClientResponse): Client {
    return {
      id: dto.id,
      orgId: dto.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      orgName: dto.organizationName || '4GUARD LOGISTICS CORP',
      name: dto.name,
      externalId: dto.externalId || '',
      taxId: dto.taxId || undefined,
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
      createdBy: dto.createdBy,
      updatedBy: dto.updatedBy,
    };
  }
}
