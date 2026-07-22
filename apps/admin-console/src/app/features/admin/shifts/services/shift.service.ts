/**
 * @file shift.service.ts
 * @description Servicio de Gestión de Turnos y Horarios (HU-140) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MODOS DE FUNCIONAMIENTO Y ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 *  - MODO MOCK EXPLÍCITO TEMPORAL: Centraliza todas las lecturas y escrituras
 *    sobre la señal `shifts` utilizando los datos iniciales de `shift.mock.ts`.
 *  - REEMPLAZABLE SIN TOCAR LA UI: Cuando se despliegue el controlador Spring Boot
 *    (/api/shifts) en 4guard_be, únicamente se cambiarán los métodos de este servicio
 *    para consumir `HttpClient`, sin tocar componentes, formularios, HTML o Signals.
 *  - SINO FALLBACK SILENCIOSO: No utiliza `catchError` con datos falsos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REGLAS DE NEGOCIO Y AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Los turnos se ordenan siempre cronológicamente por `startTime` (ej. 06:00 -> 14:00 -> 22:00).
 *  - Las escrituras locales actualizan `updatedAt` y `updatedBy` con la sesión activa.
 *  - No se realiza borrado físico; se utiliza cambio de estado (ACTIVE / INACTIVE).
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import {
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  ShiftFilters,
} from '../models/shift.model';
import { INITIAL_MOCK_SHIFTS } from '../mocks/shift.mock';

@Injectable({
  providedIn: 'root',
})
export class ShiftService {
  private readonly authService = inject(AuthService);

  // ID de sucursal por defecto (RLS) si no hay contexto de sesión activo
  private readonly DEFAULT_BRANCH_ID = 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
  private readonly DEFAULT_BRANCH_NAME = 'CENTRO DE DISTRIBUCION CDMX';

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
  /**
   * Determina si dos turnos se solapan considerando días operativos, vigencia y horarios.
   * Incluye turnos que cruzan medianoche.
   */
  private hasOverlap(a: Shift, b: Shift): boolean {
    // Solo considerar turnos activos
    if (a.status !== 'ACTIVE' || b.status !== 'ACTIVE') return false;
    // Mismo almacén (branchId) o ambos sin branch (tratar como mismo)
    const branchA = a.branchId ?? this.DEFAULT_BRANCH_ID;
    const branchB = b.branchId ?? this.DEFAULT_BRANCH_ID;
    if (branchA !== branchB) return false;
    // Días comunes
    const commonDays = a.operatingDays.filter(d => b.operatingDays.includes(d));
    if (commonDays.length === 0) return false;
    // Convertir tiempos a minutos desde inicio del día, manejando cruce de medianoche
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const startA = toMinutes(a.startTime);
    const endA = toMinutes(a.endTime);
    const startB = toMinutes(b.startTime);
    const endB = toMinutes(b.endTime);

    const normalize = (start: number, end: number) => {
      // Si termina antes o igual que inicia, se interpreta que cruza medianoche
      return end <= start ? [start, end + 24 * 60] : [start, end];
    };
    const [sA, eA] = normalize(startA, endA);
    const [sB, eB] = normalize(startB, endB);
    // Verificar intersección de intervalos
    return sA < eB && sB < eA;
  }

  /**
   * Lista de pares de turnos que presentan conflicto.
   */
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

  /** Número total de conflictos detectados (cada par cuenta como 1). */
  public readonly conflictCount = computed(() => this.conflictPairs().length);

  /**
   * Verifica si un turno específico forma parte de algún conflicto.
   */
  public hasConflict(shiftId: string): boolean {
    return this.conflictPairs().some(pair => pair[0].id === shiftId || pair[1].id === shiftId);
  }

  // ─── Signals Computadas (Derivadas) ───────────────────────────────────────
  /** Turnos filtrados por búsqueda y estatus/día, ordenados cronológicamente por startTime */
  public readonly filteredShifts = computed(() => {
    const all = this.shifts();
    const { searchTerm, status, day } = this.filters();

    const term = (searchTerm || '').trim().toLowerCase();

    const filtered = all.filter((s) => {
      // Filtro por Estatus
      if (status && status !== 'ALL' && s.status !== status) {
        return false;
      }

      // Filtro por Día
      if (day && day !== 'ALL' && !s.operatingDays.includes(day)) {
        return false;
      }

      // Filtro de Búsqueda multicampo (nombre, código, startTime, endTime, status)
      if (term) {
        const matchesName = s.name.toLowerCase().includes(term);
        const matchesCode = s.code.toLowerCase().includes(term);
        const matchesStart = s.startTime.includes(term);
        const matchesEnd = s.endTime.includes(term);
        const matchesStatus = s.status.toLowerCase().includes(term);

        if (!matchesName && !matchesCode && !matchesStart && !matchesEnd && !matchesStatus) {
          return false;
        }
      }

      return true;
    });

    // Ordenamiento cronológico por hora de inicio (startTime)
    return [...filtered].sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  /** Turno seleccionado actualmente */
  public readonly selectedShift = computed(() => {
    const id = this.selectedShiftId();
    if (!id) return null;
    return this.shifts().find((s) => s.id === id) || null;
  });

  /** Contador total de turnos */
  public readonly totalShiftCount = computed(() => this.shifts().length);

  /** Contador de turnos activos */
  public readonly activeShiftCount = computed(
    () => this.shifts().filter((s) => s.status === 'ACTIVE').length
  );

  constructor() {
    this.loadShifts();
  }

  // ─── Métodos de Estado y Filtros ──────────────────────────────────────────

  /** Carga inicial de turnos en modo mock */
  public loadShifts(): void {
    this.loading.set(true);
    this.error.set(null);

    // Simula retardo controlado y determinista de red
    setTimeout(() => {
      const sortedMocks = [...INITIAL_MOCK_SHIFTS].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      this.shifts.set(sortedMocks);

      // Autoseleccionar el primer turno si no hay ninguno seleccionado
      if (sortedMocks.length > 0 && !this.selectedShiftId()) {
        this.selectedShiftId.set(sortedMocks[0].id);
      }

      this.loading.set(false);
    }, 250);
  }

  /** Selecciona un turno por ID */
  public selectShift(id: string | null): void {
    this.selectedShiftId.set(id);
  }

  /** Actualiza los filtros de búsqueda y estado */
  public setFilters(newFilters: Partial<ShiftFilters>): void {
    this.filters.update((prev) => ({ ...prev, ...newFilters }));
  }

  // ─── Operaciones CRUD MOCK Deterministas ──────────────────────────────────

  /**
   * Crea un nuevo turno en el catálogo local.
   * Valida unicidad de código antes de insertar.
   */
  public createShift(request: CreateShiftRequest): Observable<Shift> {
    this.loading.set(true);
    this.error.set(null);

    // Validación de unicidad de código en frontend
    const exists = this.shifts().some(
      (s) => s.code.trim().toUpperCase() === request.code.trim().toUpperCase()
    );

    if (exists) {
      this.loading.set(false);
      const errMsg = `El código de turno "${request.code.toUpperCase()}" ya se encuentra registrado en el sistema.`;
      this.error.set(errMsg);
      return throwError(() => new Error(errMsg));
    }

    const currentUser = this.authService.getCurrentUser();
    const updaterName = currentUser
      ? currentUser.fullName || currentUser.username || currentUser.email
      : 'Administrador WMS';

    const newShift: Shift = {
      id: `shf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      description: request.description?.trim(),
      startTime: request.startTime,
      endTime: request.endTime,
      operatingDays: [...request.operatingDays],
      status: request.status,
      restBreakMinutes: Number(request.restBreakMinutes) || 0,
      toleranceMinutes: Number(request.toleranceMinutes) || 0,
      branchId: request.branchId || this.DEFAULT_BRANCH_ID,
      branchName: this.DEFAULT_BRANCH_NAME,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: updaterName,
    };

    return of(newShift).pipe(
      delay(300),
      tap((created) => {
        const updatedList = [...this.shifts(), created].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );
        this.shifts.set(updatedList);
        this.selectedShiftId.set(created.id);
        this.loading.set(false);
      })
    );
  }

  /**
   * Actualiza un turno existente en el catálogo local.
   */
  public updateShift(id: string, request: UpdateShiftRequest): Observable<Shift> {
    this.loading.set(true);
    this.error.set(null);

    const currentShifts = this.shifts();
    const existingIndex = currentShifts.findIndex((s) => s.id === id);

    if (existingIndex === -1) {
      this.loading.set(false);
      const errMsg = 'El turno solicitado para actualización no existe.';
      this.error.set(errMsg);
      return throwError(() => new Error(errMsg));
    }

    // Validar duplicado de código si cambió
    const codeConflict = currentShifts.some(
      (s) => s.id !== id && s.code.trim().toUpperCase() === request.code.trim().toUpperCase()
    );

    if (codeConflict) {
      this.loading.set(false);
      const errMsg = `El código de turno "${request.code.toUpperCase()}" ya pertenece a otro turno registrado.`;
      this.error.set(errMsg);
      return throwError(() => new Error(errMsg));
    }

    const currentUser = this.authService.getCurrentUser();
    const updaterName = currentUser
      ? currentUser.fullName || currentUser.username || currentUser.email
      : 'Administrador WMS';

    const updatedShift: Shift = {
      ...currentShifts[existingIndex],
      code: request.code.trim().toUpperCase(),
      name: request.name.trim(),
      description: request.description?.trim(),
      startTime: request.startTime,
      endTime: request.endTime,
      operatingDays: [...request.operatingDays],
      status: request.status,
      restBreakMinutes: Number(request.restBreakMinutes) || 0,
      toleranceMinutes: Number(request.toleranceMinutes) || 0,
      updatedAt: new Date().toISOString(),
      updatedBy: updaterName,
    };

    return of(updatedShift).pipe(
      delay(300),
      tap((updated) => {
        const newShifts = [...currentShifts];
        newShifts[existingIndex] = updated;
        newShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

        this.shifts.set(newShifts);
        this.selectedShiftId.set(updated.id);
        this.loading.set(false);
      })
    );
  }

  /**
   * Cambia el estatus de un turno entre ACTIVE e INACTIVE (desactivación lógica).
   */
  public toggleShiftStatus(id: string): Observable<Shift> {
    const currentShifts = this.shifts();
    const existing = currentShifts.find((s) => s.id === id);

    if (!existing) {
      return throwError(() => new Error('Turno no encontrado'));
    }

    const nextStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateShift(id, {
      code: existing.code,
      name: existing.name,
      description: existing.description,
      startTime: existing.startTime,
      endTime: existing.endTime,
      operatingDays: existing.operatingDays,
      status: nextStatus,
      restBreakMinutes: existing.restBreakMinutes,
      toleranceMinutes: existing.toleranceMinutes,
      branchId: existing.branchId,
    });
  }
}
