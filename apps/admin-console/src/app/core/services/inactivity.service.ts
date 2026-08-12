/**
 * @file inactivity.service.ts
 * @description Servicio global para la gestión de inactividad (HU-005) en 4GUARD WMS.
 *
 * Escucha eventos globales del usuario (mousemove, keydown, click, scroll) con RxJS.
 * Si no hay actividad durante 15 minutos (o el tiempo configurado), despliega el modal de advertencia con cuenta regresiva.
 * Si el usuario confirma "Mantener sesión activa", renueva el token y extiende la sesión sin cerrarla.
 * Si expira la cuenta regresiva de 60s o se solicita salir, limpia la sesión y redirige de forma limpia a /login.
 */

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer, of } from 'rxjs';
import { switchMap, throttleTime } from 'rxjs/operators';
import { AuthState } from '../auth/auth.state';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InactivityService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthState);
  private readonly authService = inject(AuthService);

  private readonly BASE_URL = `${environment.apiBaseUrl}/api/v1/auth`;

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
   * Empieza a escuchar eventos globales del usuario para reiniciar el temporizador de inactividad.
   */
  startTracking(): void {
    this.stopTracking();

    // Sembrar con un timer inicial inmediato para que el conteo comience desde el inicio de la sesión
    const initialTimer$ = timer(this.INACTIVITY_TIME);

    const activityEvents$ = merge(
      fromEvent(window, 'mousemove'),
      fromEvent(window, 'keydown'),
      fromEvent(window, 'click'),
      fromEvent(window, 'scroll')
    ).pipe(
      throttleTime(2000)
    );

    // Cada evento reinicia el temporizador de inactividad
    this.activitySub = merge(initialTimer$, activityEvents$.pipe(
      switchMap(() => timer(this.INACTIVITY_TIME))
    )).subscribe(() => {
      // Se cumplió el tiempo de inactividad si el usuario está autenticado y no hay advertencia previa
      if (this.authState.currentUser() && !this.showWarning()) {
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
    this.isProcessing.set(false);

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
    if (this.countdownSub) {
      this.countdownSub.unsubscribe();
      this.countdownSub = undefined;
    }
  }

  /**
   * Mantiene la sesión activa extendiendo los tokens de forma transparente.
   * Si la API falla (ej: entorno mock/local), renueva la sesión localmente sin cerrar la cuenta.
   */
  keepSessionAlive(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    const refreshToken = this.authService.getRefreshToken();

    if (!refreshToken) {
      this.handleKeepAliveSuccess();
      return;
    }

    this.http.post<any>(`${this.BASE_URL}/refresh`, { refreshToken }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.authState.setSession(response.data);
        }
        this.handleKeepAliveSuccess();
      },
      error: () => {
        // En entorno mock o fallo de red: si el usuario aún tiene sesión, extender localmente
        if (this.authState.currentUser()) {
          this.handleKeepAliveSuccess();
        } else {
          this.autoLogout();
        }
      }
    });
  }

  private handleKeepAliveSuccess(): void {
    this.isProcessing.set(false);
    this.showWarning.set(false);
    this.stopCountdown();

    // Renovar timestamp de expiración local (+1 hora)
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    localStorage.setItem('4g_expires_at', newExpiresAt);

    this.writeAuditLog('SESSION_KEEP_ALIVE_REFRESHED');
    this.startTracking();
  }

  /**
   * Cierre de sesión por inactividad. Oculta el modal de inmediato y limpia los estados de bloqueo.
   */
  autoLogout(): void {
    this.stopCountdown();
    this.showWarning.set(false);

    const refreshToken = this.authService.getRefreshToken();
    const accessToken  = this.authService.getAccessToken();
    const headers      = new HttpHeaders(accessToken ? { Authorization: `Bearer ${accessToken}` } : {});

    if (!refreshToken) {
      this.finalizeLogout();
      return;
    }

    this.http.post<any>(`${this.BASE_URL}/logout`, { refreshToken }, { headers }).subscribe({
      next: () => this.finalizeLogout(),
      error: () => this.finalizeLogout()
    });
  }

  private finalizeLogout(): void {
    this.isProcessing.set(false);
    this.showWarning.set(false);
    this.stopCountdown();

    this.writeAuditLog('SESSION_TIMEOUT_LOGOUT');

    // Preservar la ruta y proceso actual antes de limpiar la sesión (HU-005 / Reanudación de Proceso)
    const currentUrl = this.router.url;
    if (currentUrl && !currentUrl.includes('/login') && !currentUrl.includes('/change-password')) {
      const processName = this.getProcessNameFromUrl(currentUrl);
      localStorage.setItem('4g_return_url', currentUrl);
      localStorage.setItem('4g_pending_process_name', processName);
      localStorage.setItem('4g_inactivity_timestamp', new Date().toISOString());
    }

    this.authState.clearSession();

    // Limpieza completa de tokens y eliminación de estados de bloqueo residuales
    localStorage.removeItem('4g_token');
    localStorage.removeItem('4g_refresh');
    localStorage.removeItem('4g_expires_at');
    localStorage.removeItem('4guard_auth_lockout');
    localStorage.removeItem('4guard_failed_attempts');

    this.router.navigate(['/login'], { queryParams: { reason: 'inactivity' } });
  }

  private getProcessNameFromUrl(url: string): string {
    if (url.includes('/warehouse-movements/receiving')) return 'Recepción de Mercancía (Movimientos)';
    if (url.includes('/warehouse-movements/transfers')) return 'Cambio de Almacén (Traspasos)';
    if (url.includes('/warehouse-movements/outbound')) return 'Salidas de Almacén (Despacho)';
    if (url.includes('/warehouse-movements')) return 'Movimientos de Almacén';
    if (url.includes('/receiving')) return 'Recepción de Mercancía';
    if (url.includes('/inventory')) return 'Gestión de Inventario';
    if (url.includes('/shipping')) return 'Despacho y Embarques';
    if (url.includes('/quality')) return 'Control de Calidad';
    if (url.includes('/layout')) return 'Gestión de Layout';
    if (url.includes('/performance')) return 'Rendimiento Operativo';
    if (url.includes('/admin')) return 'Administración y Usuarios';
    if (url.includes('/profile')) return 'Mi Perfil';
    return 'Consola Operativa';
  }

  private writeAuditLog(event: string): void {
    const user = this.authState.currentUser();
    const email = user?.email || 'operador@4guard.com';
    const log = JSON.parse(localStorage.getItem('4guard_audit_log') ?? '[]');
    log.push({
      timestamp: new Date().toISOString(),
      event,
      email,
      ip: '127.0.0.1',
    });
    localStorage.setItem('4guard_audit_log', JSON.stringify(log));
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }
}
