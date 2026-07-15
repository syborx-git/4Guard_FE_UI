import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface Branch {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: BranchStatus;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  organizationId: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
}

export interface UpdateBranchRequest {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Branch[]>([]);

  readonly branches = this.items.asReadonly();

  getAll(): Branch[] {
    return this.items();
  }

  /**
   * Obtiene la organización activa de la sesión en localStorage.
   */
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

  /**
   * Carga los branches correspondientes a la organización del usuario logueado.
   */
  loadBranches(): Observable<ApiResponse<BranchResponse[]>> {
    const orgId = this.getSessionOrgId();
    const url = `${environment.apiBaseUrl}/api/v1/branches?organizationId=${orgId}`;

    return this.http.get<ApiResponse<BranchResponse[]>>(url).pipe(
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
   * Crea un branch en el Backend.
   */
  create(branch: Omit<Branch, 'id' | 'orgName'>): Observable<ApiResponse<BranchResponse>> {
    const orgId = this.getSessionOrgId();
    const payload: CreateBranchRequest = {
      organizationId: branch.orgId || orgId,
      name: branch.name,
      code: branch.code,
      timezone: branch.timezone || 'America/Mexico_City',
      addressLine1: branch.addressLine1 || '',
      status: branch.status || 'ACTIVE'
    };

    return this.http.post<ApiResponse<BranchResponse>>(`${environment.apiBaseUrl}/api/v1/branches`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const newBranch = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newBranch]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Actualiza un branch en el Backend.
   */
  update(id: string, updatedFields: Partial<Branch>): Observable<ApiResponse<BranchResponse>> {
    const existing = this.items().find(b => b.id === id);
    if (!existing) {
      return throwError(() => new Error('Sucursal no encontrada localmente.'));
    }

    const payload: UpdateBranchRequest = {
      id,
      organizationId: updatedFields.orgId || existing.orgId,
      name: updatedFields.name || existing.name,
      code: updatedFields.code || existing.code,
      timezone: updatedFields.timezone || existing.timezone,
      addressLine1: updatedFields.addressLine1 || existing.addressLine1,
      status: updatedFields.status || existing.status
    };

    return this.http.put<ApiResponse<BranchResponse>>(`${environment.apiBaseUrl}/api/v1/branches`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedBranch = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedBranch : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina un branch del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${environment.apiBaseUrl}/api/v1/branches/${id}`).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Cambia el estado (ACTIVE/INACTIVE) de una sucursal.
   */
  toggleStatus(id: string): Observable<ApiResponse<BranchResponse>> {
    const branch = this.items().find(b => b.id === id);
    if (!branch) {
      return throwError(() => new Error('Sucursal no encontrada localmente.'));
    }
    const newStatus: BranchStatus = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.update(id, { ...branch, status: newStatus });
  }

  private mapDtoToItem(dto: BranchResponse): Branch {
    return {
      id: dto.id,
      orgId: dto.organizationId,
      orgName: dto.organizationName,
      name: dto.name,
      code: dto.code,
      timezone: dto.timezone,
      addressLine1: dto.addressLine1,
      status: dto.status as BranchStatus,
      version: dto.version,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
