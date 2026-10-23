/**
 * @file shift-context.service.ts
 * @description Contexto reactivo del turno vigente de la sucursal activa.
 *
 * Fase 2 (solo lectura): resuelve el turno con GET /shifts/active.
 * No persiste sesiones ni filtra tableros todavía; eso corresponde a Fase 3+.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of, tap } from 'rxjs';
import { AuthState } from '../auth/auth.state';
import { ActiveShiftResponse } from '../models/active-shift.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ShiftContextService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthState);

  readonly activeShift = signal<ActiveShiftResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly configured = computed(() => this.activeShift()?.configured ?? false);
  readonly hasActiveShift = computed(() => !!this.activeShift()?.shiftId);

  private lastBranchId: string | null = null;
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  loadActiveShift(force = false): void {
    const branchId = this.authState.currentUser()?.branchId ?? null;

    if (!branchId) {
      this.activeShift.set(null);
      this.error.set('El usuario no tiene una sucursal asociada.');
      return;
    }

    if (!force && this.lastBranchId === branchId && this.activeShift() !== null) {
      return;
    }

    this.ensureAutoRefresh();
    this.lastBranchId = branchId;
    this.isLoading.set(true);
    this.error.set(null);

    this.http
      .get<{ success: boolean; message: string; data: ActiveShiftResponse }>(
        `${environment.apiBaseUrl}/api/v1/shifts/active`,
        { params: { branchId } }
      )
      .pipe(
        tap((response) => this.activeShift.set(response?.data ?? null)),
        catchError((err) => {
          this.activeShift.set(null);
          this.error.set(
            err?.error?.message || err?.message || 'No se pudo resolver el turno vigente.'
          );
          return of(null);
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  refresh(): void {
    this.loadActiveShift(true);
  }

  /**
   * Refresca el turno vigente cada minuto para que, al llegar la hora de corte,
   * el tablero se re-encuadre automáticamente en el nuevo turno.
   */
  private ensureAutoRefresh(): void {
    if (this.refreshHandle !== null) return;
    this.refreshHandle = setInterval(() => {
      if (this.authState.currentUser()?.branchId) {
        this.loadActiveShift(true);
      }
    }, 60_000);
  }
}
