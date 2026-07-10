import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ---- Enums ----
export type OrganizationType =
  | 'WAREHOUSE'
  | 'DISTRIBUTION'
  | 'MANUFACTURING'
  | 'RETAIL'
  | 'LOGISTICS'
  | 'THIRD_PARTY';

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

// ---- Frontend Model ----
export interface Organization {
  id: string;
  name: string;
  code: string; // unique, locked in edit
  taxId: string;
  type: OrganizationType;
  status: OrganizationStatus;
  settings: string; // JSON string for textarea
  createdAt: Date;
}

// ---- Backend Models ----
export interface OrganizationResponse {
  id:         string;               // UUID
  name:       string;
  code:       string;               // Inmutable tras la creación
  taxId:      string | null;
  type:       OrganizationType;
  status:     OrganizationStatus;
  settings:   Record<string, any>;  // JSON libre
  version:    number;               // Control de concurrencia optimista
  createdAt:  string;               // ISO 8601
  updatedAt:  string | null;
}

export interface CreateOrganizationRequest {
  name:      string;
  code:      string;
  taxId?:    string;
  type:      OrganizationType;
  settings?: Record<string, any>;
}

export interface UpdateOrganizationRequest {
  id:        string;                // UUID obligatorio
  name:      string;
  taxId?:    string;
  type:      OrganizationType;
  status:    OrganizationStatus;
  settings?: Record<string, any>;
}

export interface ApiResponse<T> {
  success:   boolean;
  message:   string;
  data:      T | null;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Organization[]>([]);

  readonly organizations = this.items.asReadonly();

  getAll(): Organization[] {
    return this.items();
  }

  /**
   * Carga las organizaciones del backend.
   */
  loadOrganizations(): Observable<ApiResponse<OrganizationResponse[]>> {
    return this.http.get<ApiResponse<OrganizationResponse[]>>(`${environment.apiBaseUrl}/api/v1/organizations`).pipe(
      tap(response => {
        if (response.success && response.data) {
          const mapped = response.data.map(dto => this.mapDtoToItem(dto));
          this.items.set(mapped);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Crea una organización en el backend.
   */
  create(org: Omit<Organization, 'id' | 'createdAt'>): Observable<ApiResponse<OrganizationResponse>> {
    let settingsObj: Record<string, any> = {};
    if (org.settings) {
      try {
        settingsObj = JSON.parse(org.settings);
      } catch (e) {
        return throwError(() => new Error('La configuración JSONB del Tenant no es un JSON válido.'));
      }
    }

    const payload: CreateOrganizationRequest = {
      name: org.name,
      code: org.code,
      taxId: org.taxId || undefined,
      type: org.type,
      settings: settingsObj
    };

    return this.http.post<ApiResponse<OrganizationResponse>>(`${environment.apiBaseUrl}/api/v1/organizations`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const newOrg = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newOrg]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Actualiza una organización en el backend.
   */
  update(id: string, updatedFields: Partial<Organization>): Observable<ApiResponse<OrganizationResponse>> {
    let settingsObj: Record<string, any> | undefined;
    if (updatedFields.settings) {
      try {
        settingsObj = JSON.parse(updatedFields.settings);
      } catch (e) {
        return throwError(() => new Error('La configuración JSONB del Tenant no es un JSON válido.'));
      }
    }

    const payload: UpdateOrganizationRequest = {
      id,
      name: updatedFields.name ?? '',
      taxId: updatedFields.taxId || undefined,
      type: updatedFields.type ?? 'LOGISTICS',
      status: updatedFields.status ?? 'ACTIVE',
      settings: settingsObj
    };

    return this.http.put<ApiResponse<OrganizationResponse>>(`${environment.apiBaseUrl}/api/v1/organizations`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedOrg = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedOrg : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina una organización del backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${environment.apiBaseUrl}/api/v1/organizations/${id}`).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Cambia el estado de la organización (toggle).
   */
  toggleStatus(id: string): Observable<ApiResponse<OrganizationResponse>> {
    const org = this.items().find(item => item.id === id);
    if (!org) {
      return throwError(() => new Error('Organización no encontrada localmente.'));
    }
    const newStatus: OrganizationStatus = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.update(id, { ...org, status: newStatus });
  }

  /**
   * Mapea el formato del Backend (DTO) al formato del Frontend.
   */
  private mapDtoToItem(dto: OrganizationResponse): Organization {
    return {
      id: dto.id,
      name: dto.name,
      code: dto.code,
      taxId: dto.taxId || '',
      type: dto.type,
      status: dto.status,
      settings: dto.settings ? JSON.stringify(dto.settings, null, 2) : '{}',
      createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date()
    };
  }

  /**
   * Manejador centralizado de errores HTTP.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
