import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

import {
  Branch,
  BranchStatus,
  BranchResponse,
  CreateBranchRequest,
  UpdateBranchRequest,
  BranchAuditEntry,
  BranchAuditDetail,
  AUDIT_ACTION_ICONS,
  AUDIT_ACTION_COLORS,
} from '../branches/models/branch.model';

export type { BranchStatus, Branch, BranchResponse, CreateBranchRequest, UpdateBranchRequest, BranchAuditEntry, BranchAuditDetail };

export interface ApiResponse<T> {
  success?: boolean;
  status?: number;
  message?: string;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Branch[]>([]);

  // ─── Señales reactivas de estado ───────────────────────────────────────────

  readonly branches = this.items.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly totalCount = computed(() => this.items().length);

  readonly activeCount = computed(() =>
    this.items().filter(b => b.status === 'ACTIVE').length
  );

  readonly inactiveCount = computed(() =>
    this.items().filter(b => b.status === 'INACTIVE').length
  );

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
    this.loading.set(true);
    this.loadError.set(null);
    const orgId = this.getSessionOrgId();
    const url = `${environment.apiBaseUrl}/api/v1/branches?organizationId=${orgId}`;

    return this.http.get<ApiResponse<BranchResponse[]>>(url).pipe(
      tap(response => {
        if (response && response.data) {
          const mapped = response.data.map(dto => this.mapDtoToItem(dto));
          this.items.set(mapped);
        }
        this.loading.set(false);
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(error?.error?.message || 'Error al cargar las sucursales.');
        return this.handleError(error);
      })
    );
  }

  /**
   * Crea un branch en el Backend.
   */
  create(branch: Omit<Branch, 'id' | 'orgName'>): Observable<ApiResponse<BranchResponse>> {
    this.saving.set(true);
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
        if (response && response.data) {
          const newBranch = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newBranch]);
        }
        this.saving.set(false);
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * Actualiza un branch en el Backend.
   */
  update(id: string, updatedFields: Partial<Branch>): Observable<ApiResponse<BranchResponse>> {
    this.saving.set(true);
    const existing = this.items().find(b => b.id === id);
    if (!existing) {
      this.saving.set(false);
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
        if (response && response.data) {
          const updatedBranch = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedBranch : item));
        }
        this.saving.set(false);
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * Elimina un branch del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    this.saving.set(true);
    return this.http.delete<ApiResponse<null>>(`${environment.apiBaseUrl}/api/v1/branches/${id}`).pipe(
      tap(response => {
        this.items.update(list => list.filter(item => item.id !== id));
        this.saving.set(false);
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return this.handleError(error);
      })
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

  /**
   * Obtiene el historial de auditoría de una sucursal desde el Backend.
   * Endpoint: GET /api/v1/branches/{id}/audit
   */
  getBranchAudit(id: string): Observable<ApiResponse<BranchAuditEntry[]>> {
    const url = `${environment.apiBaseUrl}/api/v1/branches/${id}/audit`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const rawList: any[] = res.data || res.items || (Array.isArray(res) ? res : []);
        const mappedData: BranchAuditEntry[] = rawList.map(item => this.mapAuditDtoToEntry(item));
        return {
          status: res.status || 200,
          message: res.message || 'Historial de auditoría recuperado con éxito',
          data: mappedData
        };
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  // ─── Mapeos DTO ─────────────────────────────────────────────────────────────

  private mapDtoToItem(dto: BranchResponse): Branch {
    return {
      id: dto.id,
      orgId: dto.organizationId,
      orgName: dto.organizationName,
      name: dto.name,
      code: dto.code,
      timezone: dto.timezone,
      addressLine1: dto.addressLine1,
      status: (dto.status || 'ACTIVE') as BranchStatus,
      version: dto.version,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  private mapAuditDtoToEntry(dto: any): BranchAuditEntry {
    const details: BranchAuditDetail[] = (dto.details || []).map((d: any) => ({
      fieldName: d.fieldName,
      oldValue: d.oldValue !== undefined ? d.oldValue : null,
      newValue: d.newValue !== undefined ? d.newValue : null,
    }));

    const action = dto.action || 'BRANCH_UPDATED';

    return {
      id: dto.logId || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: action,
      performedBy: dto.username || 'Sistema',
      performedAt: dto.createdAt || new Date().toISOString(),
      details: details,
      summary: this.getAuditSummary(action, details),
      timelineIcon: AUDIT_ACTION_ICONS[action] || 'info',
      timelineColor: AUDIT_ACTION_COLORS[action] || 'update'
    };
  }

  private getAuditSummary(action: string, details: BranchAuditDetail[]): string {
    switch (action) {
      case 'BRANCH_CREATED':
        return 'Sucursal registrada en el sistema';
      case 'BRANCH_UPDATED':
        if (details.length > 0) {
          const fields = details.map(d => d.fieldName).join(', ');
          return `Modificación de atributos (${fields})`;
        }
        return 'Actualización de datos de la sucursal';
      case 'BRANCH_DELETED':
        return 'Eliminación de la sucursal';
      default:
        return action;
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
