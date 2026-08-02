/**
 * @file shift.service.ts
 * @description Servicio de Gestión de Turnos y Horarios (HU-140) — 4GUARD WMS.
 *
 * Consume el API REST de Spring Boot (/api/v1/shifts) conectándose directamente
 * al Backend en cumplimiento con las reglas del Spec-Driven Development (SDD Level 5).
 * Cero Mocks (ADR-007).
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  UpdateShiftStatusRequest,
  ShiftFilters,
  ShiftAuditLogResponse,
} from '../models/shift.model';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ShiftService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/shifts`;

  // ID de sucursal por defecto (RLS) si no hay contexto de sesión activo
  private readonly DEFAULT_BRANCH_ID = 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

  // ─── Estado Reactivo (Angular Signals) ─────────────────────────────────────
  public readonly shifts = signal<Shift[]>([]);
  public readonly loading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);
  public readonly selectedShiftId = signal<string | null>(null);
  public readonly filters = signal<ShiftFilters>({
    searchTerm: '',
    status: 'ALL',
    day: 'ALL',
  });

  // ─── Detección de solapamientos de turnos (conflictos) ────────────────────────
  private hasOverlap(a: Shift, b: Shift): boolean {
    if (a.status !== 'ACTIVE' || b.status !== 'ACTIVE') return false;
    const branchA = a.branchId ?? this.DEFAULT_BRANCH_ID;
    const branchB = b.branchId ?? this.DEFAULT_BRANCH_ID;
    if (branchA !== branchB) return false;
    const commonDays = a.operatingDays.filter(d => b.operatingDays.includes(d));
    if (commonDays.length === 0) return false;

    const toMinutes = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return h * 60 + m;
    };
    const startA = toMinutes(a.startTime);
    const endA = toMinutes(a.endTime);
    const startB = toMinutes(b.startTime);
    const endB = toMinutes(b.endTime);

    const normalize = (start: number, end: number) => {
      return end <= start ? [start, end + 24 * 60] : [start, end];
    };
    const [sA, eA] = normalize(startA, endA);
    const [sB, eB] = normalize(startB, endB);
    return sA < eB && sB < eA;
  }

  public readonly conflictPairs = computed(() => {
    const all = this.shifts();
    const active = all.filter(s => s.status === 'ACTIVE');
    const pairs: [Shift, Shift][] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        if (this.hasOverlap(active[i], active[j])) {
          pairs.push([active[i], active[j]]);
        }
      }
    }
    return pairs;
  });

  public readonly conflictCount = computed(() => this.conflictPairs().length);

  public hasConflict(shiftId: string): boolean {
    return this.conflictPairs().some(pair => pair[0].id === shiftId || pair[1].id === shiftId);
  }

  // ─── Signals Computadas (Derivadas) ───────────────────────────────────────
  public readonly filteredShifts = computed(() => {
    const all = this.shifts();
    const { searchTerm, status, day } = this.filters();
    const term = (searchTerm || '').trim().toLowerCase();

    const filtered = all.filter((s) => {
      if (status && status !== 'ALL' && s.status !== status) {
        return false;
      }
      if (day && day !== 'ALL' && !s.operatingDays.includes(day)) {
        return false;
      }
      if (term) {
        const matchesName = s.name.toLowerCase().includes(term);
        const matchesCode = s.code.toLowerCase().includes(term);
        const matchesStart = (s.startTime || '').includes(term);
        const matchesEnd = (s.endTime || '').includes(term);
        const matchesStatus = (s.status || '').toLowerCase().includes(term);

        if (!matchesName && !matchesCode && !matchesStart && !matchesEnd && !matchesStatus) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  });

  public readonly selectedShift = computed(() => {
    const id = this.selectedShiftId();
    if (!id) return null;
    return this.shifts().find((s) => s.id === id) || null;
  });

  public readonly totalShiftCount = computed(() => this.shifts().length);

  public readonly activeShiftCount = computed(
    () => this.shifts().filter((s) => s.status === 'ACTIVE').length
  );

  constructor() {
    // La carga se realiza de manera perezosa (lazy) desde ShiftManagementComponent.ngOnInit()
  }

  // ─── Métodos HTTP para Backend (Spring Boot) ──────────────────────────────

  /**
   * Carga inicial y filtrada de turnos desde GET /api/v1/shifts
   */
  public loadShifts(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    const currentFilters = this.filters();
    if (currentFilters.status && currentFilters.status !== 'ALL') {
      params = params.set('status', currentFilters.status);
    }
    if (currentFilters.day && currentFilters.day !== 'ALL') {
      params = params.set('dayOfWeek', currentFilters.day);
    }
    if (currentFilters.searchTerm && currentFilters.searchTerm.trim()) {
      params = params.set('search', currentFilters.searchTerm.trim());
    }

    this.http.get<ApiResponse<Shift[]>>(this.API_URL, { params }).pipe(
      map(res => res.data || []),
      catchError((err: HttpErrorResponse) => {
        const errMsg = err.error?.message || 'Error al conectar con el servidor para cargar los turnos.';
        this.error.set(errMsg);
        this.toast.error(errMsg);
        return [];
      })
    ).subscribe((data) => {
      const sorted = [...data].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      this.shifts.set(sorted);

      if (sorted.length > 0 && !this.selectedShiftId()) {
        this.selectedShiftId.set(sorted[0].id);
      }
      this.loading.set(false);
    });
  }

  public selectShift(id: string | null): void {
    this.selectedShiftId.set(id);
  }

  public setFilters(newFilters: Partial<ShiftFilters>): void {
    this.filters.update((prev) => ({ ...prev, ...newFilters }));
  }

  /**
   * Registra un nuevo turno mediante POST /api/v1/shifts
   */
  public createShift(request: CreateShiftRequest): Observable<Shift> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<ApiResponse<Shift>>(this.API_URL, request).pipe(
      map(res => res.data),
      tap((created) => {
        const updatedList = [...this.shifts(), created].sort((a, b) =>
          (a.startTime || '').localeCompare(b.startTime || '')
        );
        this.shifts.set(updatedList);
        this.selectedShiftId.set(created.id);
        this.loading.set(false);
        this.toast.success(`Turno "${created.name}" registrado exitosamente.`);
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading.set(false);
        const errMsg = err.error?.message || `Error al crear el turno ${request.code}.`;
        this.error.set(errMsg);
        this.toast.error(errMsg);
        return throwError(() => new Error(errMsg));
      })
    );
  }

  /**
   * Actualiza un turno existente mediante PUT /api/v1/shifts/{id}
   */
  public updateShift(id: string, request: UpdateShiftRequest): Observable<Shift> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.put<ApiResponse<Shift>>(`${this.API_URL}/${id}`, request).pipe(
      map(res => res.data),
      tap((updated) => {
        const currentShifts = this.shifts();
        const existingIndex = currentShifts.findIndex((s) => s.id === id);
        if (existingIndex !== -1) {
          const newShifts = [...currentShifts];
          newShifts[existingIndex] = updated;
          newShifts.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
          this.shifts.set(newShifts);
        }
        this.selectedShiftId.set(updated.id);
        this.loading.set(false);
        this.toast.success(`Turno "${updated.name}" actualizado correctamente.`);
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading.set(false);
        const errMsg = err.error?.message || 'Error al actualizar el turno.';
        this.error.set(errMsg);
        this.toast.error(errMsg);
        return throwError(() => new Error(errMsg));
      })
    );
  }

  /**
   * Cambia el estatus de un turno entre ACTIVE e INACTIVE mediante PATCH /api/v1/shifts/{id}/status
   */
  public toggleShiftStatus(id: string): Observable<Shift> {
    const existing = this.shifts().find((s) => s.id === id);
    if (!existing) {
      return throwError(() => new Error('Turno no encontrado'));
    }

    const nextStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const body: UpdateShiftStatusRequest = { status: nextStatus };

    return this.http.patch<ApiResponse<Shift>>(`${this.API_URL}/${id}/status`, body).pipe(
      map(res => res.data || { ...existing, status: nextStatus }),
      tap((updated) => {
        const currentShifts = this.shifts();
        const existingIndex = currentShifts.findIndex((s) => s.id === id);
        if (existingIndex !== -1) {
          const newShifts = [...currentShifts];
          newShifts[existingIndex] = { ...newShifts[existingIndex], status: updated.status };
          this.shifts.set(newShifts);
        }
        const actionLabel = updated.status === 'ACTIVE' ? 'activado' : 'desactivado';
        this.toast.success(`Turno "${existing.name}" ${actionLabel} correctamente.`);
      }),
      catchError((err: HttpErrorResponse) => {
        const errMsg = err.error?.message || 'Error al cambiar estatus del turno.';
        this.error.set(errMsg);
        this.toast.error(errMsg);
        return throwError(() => new Error(errMsg));
      })
    );
  }

  /**
   * Elimina lógicamente un turno mediante DELETE /api/v1/shifts/{id}
   */
  public deleteShift(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/${id}`).pipe(
      map(res => res.data),
      tap(() => {
        this.shifts.update(list => list.filter(s => s.id !== id));
        if (this.selectedShiftId() === id) {
          const remaining = this.shifts();
          this.selectedShiftId.set(remaining.length > 0 ? remaining[0].id : null);
        }
        this.toast.success('Turno eliminado correctamente.');
      }),
      catchError((err: HttpErrorResponse) => {
        const errMsg = err.error?.message || 'Error al eliminar el turno.';
        this.toast.error(errMsg);
        return throwError(() => new Error(errMsg));
      })
    );
  }

  /**
   * Obtiene el historial de auditoría mediante GET /api/v1/shifts/{id}/audit
   */
  public getAuditLogs(id: string): Observable<ShiftAuditLogResponse[]> {
    return this.http.get<ApiResponse<ShiftAuditLogResponse[]>>(`${this.API_URL}/${id}/audit`).pipe(
      map(res => res.data || []),
      catchError((err: HttpErrorResponse) => {
        const errMsg = err.error?.message || 'Error al recuperar historial de auditoría.';
        this.toast.error(errMsg);
        return throwError(() => new Error(errMsg));
      })
    );
  }
}
