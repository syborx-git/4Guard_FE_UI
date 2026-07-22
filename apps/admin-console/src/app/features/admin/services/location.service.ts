import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { BranchService } from './branch.service';

export type LocationType = 'PALLET' | 'BIN' | 'SHELF' | 'RAMP';
export type LocationStatus = 'ACTIVE' | 'BLOCKED' | 'MAINTENANCE' | 'INACTIVE';

export interface Location {
  id: string;
  branchId: string;
  branchName: string;
  sectionId: string;
  sectionName: string;
  zone: string;
  aisle: string;
  rack: string;
  position: string;
  level: number;
  coordX: number;
  coordY: number;
  coordZ: number;
  type: LocationType;
  capacityUnits: number;
  currentOccupancy?: number;
  code?: string | null;
  name?: string | null;
  status?: LocationStatus;
  statusReason?: string | null;
  isBlocked: boolean;
  blockReason: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationResponse {
  id: string;
  branchId: string;
  branchName: string;
  sectionId: string;
  sectionName: string;
  zone: string;
  aisle: string;
  rack: string;
  level: number;
  position: string;
  coordX: number;
  coordY: number;
  coordZ: number;
  type: string;
  capacityUnits: number;
  currentOccupancy: number;
  code: string | null;
  name: string | null;
  status: LocationStatus;
  statusReason: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationRequest {
  branchId: string;
  sectionId?: string;
  zone: string;
  aisle?: string;
  rack?: string;
  level?: number;
  position?: string;
  coordX?: number;
  coordY?: number;
  coordZ?: number;
  type: string;
  capacityUnits?: number;
  code?: string | null;
  name?: string | null;
}

export interface UpdateLocationRequest {
  id: string;
  branchId: string;
  sectionId?: string;
  zone: string;
  aisle?: string;
  rack?: string;
  level?: number;
  position?: string;
  coordX?: number;
  coordY?: number;
  coordZ?: number;
  type: string;
  capacityUnits?: number;
  isBlocked?: boolean;
  blockReason?: string | null;
  code?: string | null;
  name?: string | null;
}

export interface ChangeLocationStatusRequest {
  status: LocationStatus;
  reason?: string;
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
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly branchService = inject(BranchService);
  private readonly items = signal<Location[]>([]);

  readonly locations = this.items.asReadonly();

  getAll(): Location[] {
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
    return 'a53f0907-9fa5-4bdf-87db-2eb5e7683935'; // Fallback por defecto
  }

  /**
   * Carga las ubicaciones correspondientes a las sucursales de la organización del usuario firmado.
   */
  loadLocations(): Observable<Location[]> {
    const orgId = this.getSessionOrgId();
    // Obtener las sucursales pertenecientes a la organización
    const orgBranches = this.branchService.branches().filter(b => b.orgId === orgId);

    if (orgBranches.length === 0) {
      // Fallback si no hay sucursales cargadas
      return this.loadLocationsForBranch('b73f0907-9fa5-4bdf-87db-2eb5e7683936').pipe(
        tap(locs => this.items.set(locs))
      );
    }

    // Cargar ubicaciones de todas las sucursales pertenecientes a la organización en paralelo
    const requests = orgBranches.map(b => this.loadLocationsForBranch(b.id));
    return forkJoin(requests).pipe(
      map(results => results.reduce((acc, val) => acc.concat(val), [])),
      tap(allLocations => {
        this.items.set(allLocations);
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Obtiene las ubicaciones de una sucursal en específico.
   */
  loadLocationsForBranch(branchId: string): Observable<Location[]> {
    return this.http.get<ApiResponse<LocationResponse[]>>(
      `${environment.apiBaseUrl}/api/v1/locations?branchId=${branchId}`
    ).pipe(
      map(response => (response.success && response.data) ? response.data.map(dto => this.mapDtoToItem(dto)) : []),
      catchError(() => of([])) // Prevenir que falle todo si una sucursal falla
    );
  }

  /**
   * Crea una ubicación en el Backend.
   */
  create(loc: Partial<Location>): Observable<ApiResponse<LocationResponse>> {
    const payload: CreateLocationRequest = {
      branchId: loc.branchId!,
      sectionId: loc.sectionId,
      zone: loc.zone || 'ALMC',
      aisle: loc.aisle,
      rack: loc.rack,
      level: loc.level,
      position: loc.position,
      coordX: loc.coordX ?? 0,
      coordY: loc.coordY ?? 0,
      coordZ: loc.coordZ ?? 0,
      type: loc.type || 'PALLET',
      capacityUnits: loc.capacityUnits ?? 1,
      code: loc.code,
      name: loc.name
    };

    return this.http.post<ApiResponse<LocationResponse>>(
      `${environment.apiBaseUrl}/api/v1/locations`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const newLoc = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newLoc]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Actualiza una ubicación en el Backend.
   */
  update(id: string, loc: Partial<Location>): Observable<ApiResponse<LocationResponse>> {
    const existing = this.items().find(l => l.id === id);
    const payload: UpdateLocationRequest = {
      id: id,
      branchId: loc.branchId || existing?.branchId || '',
      sectionId: loc.sectionId !== undefined ? loc.sectionId : existing?.sectionId,
      zone: loc.zone || existing?.zone || 'ALMC',
      aisle: loc.aisle !== undefined ? loc.aisle : existing?.aisle,
      rack: loc.rack !== undefined ? loc.rack : existing?.rack,
      level: loc.level !== undefined ? loc.level : (existing?.level ?? 1),
      position: loc.position !== undefined ? loc.position : existing?.position,
      coordX: loc.coordX !== undefined ? loc.coordX : (existing?.coordX ?? 0),
      coordY: loc.coordY !== undefined ? loc.coordY : (existing?.coordY ?? 0),
      coordZ: loc.coordZ !== undefined ? loc.coordZ : (existing?.coordZ ?? 0),
      type: loc.type || existing?.type || 'PALLET',
      capacityUnits: loc.capacityUnits !== undefined ? loc.capacityUnits : (existing?.capacityUnits ?? 1),
      isBlocked: loc.isBlocked !== undefined ? loc.isBlocked : existing?.isBlocked,
      blockReason: loc.blockReason !== undefined ? loc.blockReason : (existing?.blockReason || null),
      code: loc.code !== undefined ? loc.code : existing?.code,
      name: loc.name !== undefined ? loc.name : existing?.name
    };

    return this.http.put<ApiResponse<LocationResponse>>(
      `${environment.apiBaseUrl}/api/v1/locations`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedLoc = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedLoc : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Cambia el estado FSM de una ubicación física en el Backend vía PATCH.
   */
  changeStatus(id: string, status: LocationStatus, reason?: string): Observable<ApiResponse<LocationResponse>> {
    const payload: ChangeLocationStatusRequest = {
      status,
      reason: reason || undefined
    };

    return this.http.patch<ApiResponse<LocationResponse>>(
      `${environment.apiBaseUrl}/api/v1/locations/${id}/status`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedLoc = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedLoc : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina una ubicación del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${environment.apiBaseUrl}/api/v1/locations/${id}`
    ).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Bloquea/Desbloquea una ubicación física en el Backend.
   */
  toggleBlock(id: string, isBlocked: boolean, reason: string): Observable<ApiResponse<LocationResponse>> {
    return this.changeStatus(id, isBlocked ? 'BLOCKED' : 'ACTIVE', reason);
  }

  private mapDtoToItem(dto: LocationResponse): Location {
    return {
      id: dto.id,
      branchId: dto.branchId,
      branchName: dto.branchName,
      sectionId: dto.sectionId,
      sectionName: dto.sectionName,
      zone: dto.zone,
      aisle: dto.aisle,
      rack: dto.rack,
      level: dto.level,
      position: dto.position,
      coordX: dto.coordX,
      coordY: dto.coordY,
      coordZ: dto.coordZ,
      type: (dto.type || 'PALLET') as LocationType,
      capacityUnits: dto.capacityUnits,
      currentOccupancy: dto.currentOccupancy,
      code: dto.code || undefined,
      name: dto.name || undefined,
      status: dto.status || (dto.isBlocked ? 'BLOCKED' : 'ACTIVE'),
      statusReason: dto.statusReason || dto.blockReason || null,
      isBlocked: dto.isBlocked,
      blockReason: dto.blockReason || '',
      version: dto.version,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
