/**
 * @file inactivity.service.ts
 * @description Servicio global para la gestión de inactividad (HU-004) en 4GUARD WMS.
 *
 * Escucha eventos globales del usuario (mousemove, keydown, click, scroll) con RxJS.
 * Si no hay actividad durante 15 minutos, despliega la advertencia con cuenta regresiva.
 * Si el usuario confirma "Mantener sesión activa", consume POST /api/v1/auth/refresh.
 * Si expira la cuenta regresiva de 60s, consume POST /api/v1/auth/logout, limpia sesión y redirige.
 */

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { switchMap, throttleTime } from 'rxjs/operators';
import { AuthState } from '../auth/auth.state';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class InactivityService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly authService = inject(AuthService);

  private readonly BASE_URL = 'http://localhost:8080/api/v1/auth';

  // Configuración de tiempos (15 minutos de inactividad, 60 segundos de aviso)
  private readonly INACTIVITY_TIME = 15 * 60 * 1000; // 15 minutos de inactividad
  private readonly WARNING_TIME = 60; // 60 segundos de aviso

  // Estado reactivo expuesto con signals
  readonly showWarning = signal<boolean>(false);
  readonly countdown = signal<number>(60);
  readonly isProcessing = signal<boolean>(false);

  private activitySub?: Subscription;
  private countdownSub?: Subscription;

  constructor() {
    this.startTracking();
  }

  /**
   * Empieza a escuchar eventos globales del usuario para reiniciar el temporizador.
   */
  startTracking(): void {
    this.stopTracking();

    const activityEvents$ = merge(
      fromEvent(window, 'mousemove'),
      fromEvent(window, 'keydown'),
      fromEvent(window, 'click'),
      fromEvent(window, 'scroll')
    ).pipe(
      throttleTime(2000) // Evita sobreprocesar eventos repetidos
    );

    // Cada evento reinicia el temporizador de inactividad
    this.activitySub = activityEvents$.pipe(
      switchMap(() => timer(this.INACTIVITY_TIME))
    ).subscribe(() => {
      // Se cumplió el tiempo de inactividad si el usuario está autenticado
      if (this.authState.isAuthenticated() && !this.showWarning()) {
        this.triggerWarning();
      }
    });
  }

  /**
   * Detiene el monitoreo de eventos.
   */
  stopTracking(): void {
    this.activitySub?.unsubscribe();
    this.stopCountdown();
  }

  /**
   * Inicia el estado de aviso con cuenta regresiva.
   */
  private triggerWarning(): void {
    this.showWarning.set(true);
    this.countdown.set(this.WARNING_TIME);

    this.countdownSub = timer(0, 1000).subscribe(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.stopCountdown();
        this.autoLogout();
      } else {
        this.countdown.set(current - 1);
      }
    });
  }

  /**
   * Detiene la cuenta regresiva.
   */
  private stopCountdown(): void {
    this.countdownSub?.unsubscribe();
  }

  /**
   * Mantiene la sesión activa consumiendo el endpoint POST /auth/refresh.
   * Utiliza el refreshToken guardado en el SessionStorage/LocalStorage.
   */
  keepSessionAlive(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    const refreshToken = this.authService.getRefreshToken();

    this.http.post<any>(`${this.BASE_URL}/refresh`, { refreshToken }).subscribe({
      next: (response) => {
        this.isProcessing.set(false);
        this.showWarning.set(false);
        this.stopCountdown();

        if (response.success && response.data) {
          // Actualizar tokens en el cliente
          this.authState.setSession(response.data);
        }

        // Reiniciar tracking de eventos
        this.startTracking();
      },
      error: () => {
        this.isProcessing.set(false);
        // Si falla el refresh, forzar logout por seguridad
        this.autoLogout();
      }
    });
  }

  /**
   * Cierre de sesión automático consumiendo POST /auth/logout.
   */
  autoLogout(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    this.stopCountdown();

    this.http.post<any>(`${this.BASE_URL}/logout`, {}).subscribe({
      next: () => {
        this.finalizeLogout();
      },
      error: () => {
        // Aún si el backend falla, limpiamos en el cliente por seguridad
        this.finalizeLogout();
      }
    });
  }

  private finalizeLogout(): void {
    this.isProcessing.set(false);
    this.showWarning.set(false);
    this.authState.clearSession();

    // Limpieza de tokens del LocalStorage solicitados
    localStorage.removeItem('4g_token');
    localStorage.removeItem('4g_refresh');

    this.router.navigate(['/login'], { queryParams: { reason: 'inactivity' } });
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }
}
