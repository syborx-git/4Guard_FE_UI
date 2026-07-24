import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { BranchService } from './branch.service';

export interface WarehouseSection {
  id: string;
  branchId: string;
  branchName: string;
  code: string; // short code (max 10 chars)
  name: string; // name (max 100 chars)
  status: 'ACTIVE' | 'INACTIVE';
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWarehouseSectionRequest {
  branchId: string;
  code: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateWarehouseSectionRequest {
  id: string;
  branchId: string;
  code: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface SectionStatusPatchRequest {
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SectionAuditDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface SectionAuditLogEntry {
  id?: string;
  logId?: string;
  action: string;
  username: string;
  createdAt: string;
  details?: SectionAuditDetail[];
  summary?: string;
  timelineIcon?: string;
  timelineColor?: 'create' | 'update' | 'status';
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

const AUDIT_SECTION_ICONS: Record<string, string> = {
  SECTION_CREATED: 'add_circle',
  SECTION_UPDATED: 'edit',
  SECTION_STATUS_UPDATED: 'swap_horiz',
  SECTION_DELETED: 'delete_forever',
};

const AUDIT_SECTION_COLORS: Record<string, 'create' | 'update' | 'status'> = {
  SECTION_CREATED: 'create',
  SECTION_UPDATED: 'update',
  SECTION_STATUS_UPDATED: 'status',
  SECTION_DELETED: 'status',
};

@Injectable({
  providedIn: 'root'
})
export class SectionService {
  private readonly http = inject(HttpClient);
  private readonly branchService = inject(BranchService);
  private readonly items = signal<WarehouseSection[]>([]);

  readonly sections = this.items.asReadonly();

  getAll(): WarehouseSection[] {
    return this.items();
  }

  /**
   * Obtiene la organización activa de la sesión del usuario.
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
   * Carga las secciones correspondientes a las sucursales de la organización del usuario firmado.
   */
  loadSections(): Observable<WarehouseSection[]> {
    const orgId = this.getSessionOrgId();
    // Obtener las sucursales pertenecientes a la organización
    const orgBranches = this.branchService.branches().filter(b => b.orgId === orgId);

    if (orgBranches.length === 0) {
      // Fallback si no hay sucursales cargadas
      return this.loadSectionsForBranch('b73f0907-9fa5-4bdf-87db-2eb5e7683936').pipe(
        tap(sections => this.items.set(sections))
      );
    }

    // Cargar secciones de todas las sucursales pertenecientes a la organización en paralelo
    const requests = orgBranches.map(b => this.loadSectionsForBranch(b.id));
    return forkJoin(requests).pipe(
      map(results => results.reduce((acc, val) => acc.concat(val), [])),
      tap(allSections => {
        this.items.set(allSections);
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Obtiene las secciones de una sucursal en específico de forma individual.
   */
  private loadSectionsForBranch(branchId: string): Observable<WarehouseSection[]> {
    return this.getSectionsByBranch(branchId).pipe(
      map(response => (response.success && response.data) ? response.data : []),
      catchError(() => of([])) // Prevenir que falle todo el flujo si una sucursal no responde
    );
  }

  /**
   * Obtiene las secciones de una sucursal en específico de forma individual (Público).
   */
  getSectionsByBranch(branchId: string): Observable<ApiResponse<WarehouseSection[]>> {
    return this.http.get<ApiResponse<WarehouseSection[]>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections?branchId=${branchId}`
    );
  }

  /**
   * Crea una sección de almacén en el Backend.
   */
  create(section: Omit<WarehouseSection, 'id' | 'branchName'>): Observable<ApiResponse<WarehouseSection>> {
    const payload: CreateWarehouseSectionRequest = {
      branchId: section.branchId,
      code: section.code,
      name: section.name,
      status: section.status || 'ACTIVE'
    };

    return this.http.post<ApiResponse<WarehouseSection>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.items.update(list => [...list, response.data]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Modifica una sección de almacén existente en el Backend.
   */
  update(id: string, section: Partial<WarehouseSection>): Observable<ApiResponse<WarehouseSection>> {
    const payload: UpdateWarehouseSectionRequest = {
      id: id,
      branchId: section.branchId || '',
      code: section.code || '',
      name: section.name || '',
      status: section.status || 'ACTIVE'
    };

    return this.http.put<ApiResponse<WarehouseSection>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.items.update(list => list.map(item => item.id === id ? response.data : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Modifica el estatus (ACTIVE / INACTIVE) de una sección mediante el endpoint dedicado PATCH /api/v1/warehouse-sections/{id}/status.
   */
  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Observable<ApiResponse<WarehouseSection>> {
    const payload: SectionStatusPatchRequest = { status };
    return this.http.patch<ApiResponse<WarehouseSection>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections/${id}/status`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.items.update(list => list.map(item => item.id === id ? response.data : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Consulta el historial de auditoría (Audit Log) de una sección por su ID.
   * GET /api/v1/warehouse-sections/{id}/audit
   */
  getSectionAudit(id: string): Observable<ApiResponse<SectionAuditLogEntry[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections/${id}/audit`
    ).pipe(
      map(res => ({
        ...res,
        data: (res.data || []).map(dto => this.mapAuditDtoToEntry(dto))
      })),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private mapAuditDtoToEntry(dto: any): SectionAuditLogEntry {
    const details: SectionAuditDetail[] = (dto.details || []).map((d: any) => ({
      fieldName: d.fieldName,
      oldValue: d.oldValue,
      newValue: d.newValue
    }));

    const action = dto.action || '';
    let summary = '';
    if (action === 'SECTION_CREATED') {
      summary = 'Sección creada';
    } else if (action === 'SECTION_STATUS_UPDATED') {
      const statusDet = details.find(d => d.fieldName === 'status');
      if (statusDet && statusDet.oldValue && statusDet.newValue) {
        summary = `Cambio de estatus: ${statusDet.oldValue} ➔ ${statusDet.newValue}`;
      } else if (statusDet && statusDet.newValue) {
        summary = `Estatus cambiado a ${statusDet.newValue}`;
      } else {
        summary = 'Estatus de la sección actualizado';
      }
    } else if (action === 'SECTION_UPDATED') {
      summary = 'Información de la sección actualizada';
    } else if (action === 'SECTION_DELETED') {
      summary = 'Sección eliminada';
    } else {
      summary = action;
    }

    return {
      id: dto.logId || dto.id || `log-${Date.now()}`,
      logId: dto.logId || dto.id,
      action: action,
      username: dto.username || 'sistema',
      createdAt: dto.createdAt,
      details: details,
      summary: summary,
      timelineIcon: AUDIT_SECTION_ICONS[action] || 'info',
      timelineColor: AUDIT_SECTION_COLORS[action] || 'update'
    };
  }

  /**
   * Elimina una sección de almacén del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${environment.apiBaseUrl}/api/v1/warehouse-sections/${id}`
    ).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
