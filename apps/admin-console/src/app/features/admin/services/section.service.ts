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
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWarehouseSectionRequest {
  branchId: string;
  code: string;
  name: string;
}

export interface UpdateWarehouseSectionRequest {
  id: string;
  branchId: string;
  code: string;
  name: string;
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
      name: section.name
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
      name: section.name || ''
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
