/**
 * @file client.service.ts
 * @description Servicio de gestión de Clientes / Owners (3PL).
 * Integrado con el Backend mediante HTTP siguiendo el mismo patrón que OrganizationService.
 *
 * El organizationId se obtiene de la sesión activa en localStorage (key: 'session').
 * Endpoints:
 *   POST   /api/v1/clients               — Crear cliente
 *   PUT    /api/v1/clients               — Actualizar cliente
 *   GET    /api/v1/clients/{id}          — Obtener por ID
 *   GET    /api/v1/clients?organizationId — Listar por organización
 *   DELETE /api/v1/clients/{id}          — Eliminar cliente
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ─── Tipos / Enums ────────────────────────────────────────────────────────────

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

// ─── Modelo Frontend ──────────────────────────────────────────────────────────

export interface Client {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  externalId: string;    // Código ERP/SAP (max 50 chars)
  status: ClientStatus;
  version: number;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

// ─── DTOs de Backend ─────────────────────────────────────────────────────────

export interface ClientResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  externalId: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  status?: string;
  version?: number;
}

export interface UpdateClientRequest {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  status?: string;
  version?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Client[]>([]);

  readonly clients = this.items.asReadonly();

  getAll(): Client[] {
    return this.items();
  }

  /**
   * Obtiene el organizationId y organizationName desde la sesión activa en localStorage.
   * La sesión se guarda bajo la key 'session' por SessionStorageService.
   */
  private getSessionOrg(): { organizationId: string; organizationName: string } {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        // El JwtSession tiene { user: AuthenticatedUser, ... }
        // AuthenticatedUser puede contener organizationId si el backend lo retorna en el JWT
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
    // Fallback: ID de la organización de referencia del sistema (4GUARD LOGISTICS CORP)
    return {
      organizationId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      organizationName: '4GUARD LOGISTICS CORP'
    };
  }

  /**
   * Carga los clientes de la organización activa desde el Backend.
   * Si no hay organizationId en la sesión, carga todos los clientes del sistema.
   */
  loadClients(): Observable<ApiResponse<ClientResponse[]>> {
    const { organizationId } = this.getSessionOrg();
    const url = organizationId
      ? `${environment.apiBaseUrl}/api/v1/clients?organizationId=${organizationId}`
      : `${environment.apiBaseUrl}/api/v1/clients`;

    return this.http.get<ApiResponse<ClientResponse[]>>(url).pipe(
      tap(response => {
        if (response.success && response.data) {
          const mapped = response.data.map(dto => this.mapDtoToItem(dto));
          this.items.set(mapped);
        } else if (response.success && response.data !== undefined) {
          // Lista vacía exitosa
          this.items.set([]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Crea un cliente en el Backend.
   */
  create(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Observable<ApiResponse<ClientResponse>> {
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
        if (response.success && response.data) {
          const newClient = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newClient]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Actualiza un cliente existente en el Backend.
   */
  update(id: string, updatedFields: Partial<Client>): Observable<ApiResponse<ClientResponse>> {
    const existing = this.items().find(c => c.id === id);
    if (!existing) {
      return throwError(() => new Error('Cliente no encontrado localmente.'));
    }

    const payload: UpdateClientRequest = {
      id,
      organizationId: updatedFields.orgId || existing.orgId,
      organizationName: updatedFields.orgName || existing.orgName,
      name: updatedFields.name || existing.name,
      externalId: updatedFields.externalId !== undefined ? updatedFields.externalId : existing.externalId,
      status: updatedFields.status || existing.status,
      version: existing.version
    };

    return this.http.put<ApiResponse<ClientResponse>>(`${environment.apiBaseUrl}/api/v1/clients`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedClient = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedClient : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina un cliente del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${environment.apiBaseUrl}/api/v1/clients/${id}`).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
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
   * Mapea el DTO del Backend al modelo del Frontend.
   */
  private mapDtoToItem(dto: ClientResponse): Client {
    return {
      id: dto.id,
      orgId: dto.organizationId,
      orgName: dto.organizationName,
      name: dto.name,
      externalId: dto.externalId || '',
      status: dto.status as ClientStatus,
      version: dto.version,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  /**
   * Manejador centralizado de errores HTTP.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
