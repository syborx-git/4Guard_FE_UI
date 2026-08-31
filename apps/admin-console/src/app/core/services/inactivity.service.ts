/**
 * @file inactivity.service.ts
 * @description Servicio de detección de inactividad del usuario con auto-renovación y cierre de sesión seguro.
 */

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer, of } from 'rxjs';
<<<<<<< HEAD
import { switchMap, throttleTime, startWith, timeout, catchError } from 'rxjs/operators';
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

  // Configuración de tiempos (15 minutos de inactividad real, 60 segundos de aviso)
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
   * Empieza a escuchar todos los eventos del usuario para reiniciar el temporizador de inactividad.
   * Utiliza startWith(null) y switchMap() para garantizar que CADA interacción del usuario
   * cancele el temporizador anterior y reinicie el conteo de 15 minutos desde cero.
   * Solo si transcurren 15 minutos CONTINUOS de inactividad absoluta se desplegará la advertencia.
   */
  startTracking(): void {
    this.stopTracking();

    const activityEvents$ = merge(
      fromEvent(window, 'mousemove'),
      fromEvent(window, 'keydown'),
      fromEvent(window, 'click'),
      fromEvent(window, 'scroll'),
      fromEvent(window, 'touchstart'),
      fromEvent(window, 'pointermove'),
      fromEvent(window, 'wheel')
    ).pipe(
      throttleTime(1000)
    );

    // Un solo flujo unificado: al iniciar o tras cada evento del usuario,
    // switchMap CANCELA el temporizador anterior y arranca un NUEVO conteo de 15 minutos.
    this.activitySub = activityEvents$.pipe(
      startWith(null),
      switchMap(() => timer(this.INACTIVITY_TIME))
    ).subscribe(() => {
      // Se cumplió el tiempo de inactividad real si el usuario está autenticado y no hay advertencia previa
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
   * Si la API tarda o falla (ej: entorno mock/local/latencia en Render), renueva la sesión localmente sin cerrar la cuenta ni atascar la UI.
   */
  keepSessionAlive(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    const refreshToken = this.authService.getRefreshToken();

    if (!refreshToken) {
      this.handleKeepAliveSuccess();
      return;
    }

    this.http.post<any>(`${this.BASE_URL}/refresh`, { refreshToken }).pipe(
      timeout(4000),
      catchError(() => of(null))
    ).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.authState.setSession(response.data);
        }
        this.handleKeepAliveSuccess();
      },
      error: () => {
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

    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    localStorage.setItem('4g_expires_at', newExpiresAt);

    this.writeAuditLog('SESSION_KEEP_ALIVE_REFRESHED');
    this.startTracking();
  }

  /**
   * Cierre de sesión por inactividad real.
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

    const currentUrl = this.router.url;
    if (currentUrl && !currentUrl.includes('/login') && !currentUrl.includes('/change-password')) {
      const processName = this.getProcessNameFromUrl(currentUrl);
      localStorage.setItem('4g_return_url', currentUrl);
      localStorage.setItem('4g_pending_process_name', processName);
      localStorage.setItem('4g_inactivity_timestamp', new Date().toISOString());
    }

    this.authState.clearSession();

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
