/**
 * @file smart-notification.service.ts
 * @description Motor de Notificaciones Inteligentes en Tiempo Real basado en Roles,
 * Permisos y Contexto de Navegación de Ruta — 4GUARD WMS.
 *
 * Filtra y despacha notificaciones automáticas con audio y apertura de pop-ups según:
 * - Seguridad / Vigilancia: Chofer completó pre-registro QR (Pase SUBMITTED).
 * - Almacén / Recepción: Vigilancia aprobó Check-In / Arribo en Caseta (Folio REGISTERED).
 * - Calidad / QM: Desviación o reporte de producto no conforme registrado.
 * - Salidas / Outbound: Carga concluida y lista para despacho en caseta.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../auth/auth.state';
import { ToastService } from './toast.service';

export type NotificationCategory = 'SECURITY' | 'RECEIVING' | 'QUALITY' | 'OUTBOUND' | 'SYSTEM';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface SmartNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  referenceFolio?: string;
  referenceId?: string;
  route?: string;
  queryParams?: Record<string, any>;
  data?: any;
  targetRoles?: string[];
  targetRoutes?: string[];
  severity: NotificationSeverity;
  isRead: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SmartNotificationService {
  private readonly authState = inject(AuthState);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  // ── Historial y Cola Reactiva de Notificaciones ──
  private readonly _notifications = signal<SmartNotification[]>([]);
  public readonly notifications = this._notifications.asReadonly();

  // ── Señales de Conteo por Categoría ──
  public readonly unreadCount = computed(() => this._notifications().filter(n => !n.isRead).length);

  // Pases de Chofer QR en espera de validación por Caseta
  public readonly pendingDriverPasses = signal<any[]>([]);
  public readonly pendingDriverPassesCount = computed(() => this.pendingDriverPasses().length);
  public readonly hasNewDriverSubmission = signal<boolean>(false);

  // Última notificación despachada
  public readonly latestNotification = signal<SmartNotification | null>(null);

  /**
   * Determina si el usuario logueado actualmente debe recibir la notificación
   * basándose en su Rol asignado, Nivel jerárquico y Módulo actual en pantalla.
   */
  public isRelevantForCurrentUser(notif: SmartNotification): boolean {
    const user = this.authState.currentUser();
    if (!user) return false;

    const currentRole = (user.role || '').toUpperCase();
    const currentRoute = this.router.url;

    // 1. Super Administradores y Directores reciben todas las alertas
    if (
      currentRole.includes('ADMIN') ||
      currentRole.includes('MANAGER') ||
      currentRole.includes('DIRECTOR') ||
      (user.roleLevel && user.roleLevel >= 3)
    ) {
      return true;
    }

    // 2. Coincidencia por Rol Específico
    if (notif.targetRoles && notif.targetRoles.length > 0) {
      const matchesRole = notif.targetRoles.some(r =>
        currentRole.includes(r.toUpperCase()) || r.toUpperCase().includes(currentRole)
      );
      if (matchesRole) return true;
    }

    // 3. Coincidencia por Ruta de Contexto Activa
    if (notif.targetRoutes && notif.targetRoutes.length > 0) {
      const matchesRoute = notif.targetRoutes.some(routePrefix => currentRoute.startsWith(routePrefix));
      if (matchesRoute) return true;
    }

    // 4. Mapeo específico por categoría y perfil de usuario
    switch (notif.category) {
      case 'SECURITY':
        return (
          currentRole.includes('SECURITY') ||
          currentRole.includes('VIGILAN') ||
          currentRole.includes('GUARD') ||
          currentRole.includes('CASETA') ||
          currentRoute.startsWith('/security')
        );
      case 'RECEIVING':
        return (
          currentRole.includes('WAREHOUSE') ||
          currentRole.includes('DOCK') ||
          currentRole.includes('OPERAT') ||
          currentRole.includes('ALMACEN') ||
          currentRoute.startsWith('/warehouse-movements') ||
          currentRoute.startsWith('/receiving')
        );
      case 'QUALITY':
        return (
          currentRole.includes('QM') ||
          currentRole.includes('QUALIT') ||
          currentRole.includes('CALIDAD') ||
          currentRole.includes('INSPECT') ||
          currentRole.includes('AUDIT') ||
          currentRoute.startsWith('/quality')
        );
      case 'OUTBOUND':
        return (
          currentRole.includes('WAREHOUSE') ||
          currentRole.includes('DISPATCH') ||
          currentRole.includes('SALIDAS') ||
          currentRole.includes('SECURITY') ||
          currentRoute.includes('outbound') ||
          currentRoute.startsWith('/security')
        );
      default:
        return true;
    }
  }

  /**
   * Despacha una nueva notificación al sistema aplicando filtrado por rol y contexto.
   */
  public dispatch(notifInput: Omit<SmartNotification, 'id' | 'timestamp' | 'isRead'>): SmartNotification | null {
    const notification: SmartNotification = {
      ...notifInput,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      isRead: false
    };

    // Agregar al historial global
    this._notifications.update(list => [notification, ...list.slice(0, 49)]);

    // Verificar si aplica al usuario logueado en este momento
    if (this.isRelevantForCurrentUser(notification)) {
      this.latestNotification.set(notification);
      this.playChime(notification.severity);

      // Toast feedback contextual
      if (notification.severity === 'CRITICAL' || notification.severity === 'WARNING') {
        this.toast.warning(`${notification.title}: ${notification.message}`, 6000);
      } else {
        this.toast.info(`${notification.title}: ${notification.message}`, 6000);
      }

      return notification;
    }

    return null;
  }

  /**
   * Actualiza la lista de pases completados por choferes (SUBMITTED) en Caseta.
   */
  public updateSubmittedDriverPasses(passes: any[]): void {
    const submitted = (passes || []).filter(p => p.status === 'SUBMITTED');
    const prevCount = this.pendingDriverPasses().length;
    this.pendingDriverPasses.set(submitted);

    if (submitted.length > prevCount && submitted.length > 0) {
      const latest = submitted[0];
      this.hasNewDriverSubmission.set(true);

      const driverName = latest.driverName || latest.nombreOperador || 'Chofer';
      const carrier = latest.carrierLine || latest.carrierLineCode || 'Transportista';
      const token = latest.token || latest.id || 'QR';

      this.dispatch({
        category: 'SECURITY',
        title: '🚛 Chofer Completó Registro QR',
        message: `Pase #${token} (${driverName} - ${carrier}) listo para inspección en Caseta.`,
        referenceFolio: token,
        route: '/security',
        targetRoles: ['ADMIN', 'SECURITY_GUARD', 'VIGILANCIA'],
        targetRoutes: ['/security'],
        severity: 'SUCCESS',
        data: latest
      });
    }
  }

  /**
   * Sintetizador de audio con Web Audio API para alertas limpias y sin dependencias.
   */
  public playChime(severity: NotificationSeverity = 'INFO'): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      if (severity === 'CRITICAL' || severity === 'WARNING') {
        // Tono de Alerta / Advertencia: F#4 -> C5
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(370, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Tono Armónico Amigable: D5 (587Hz) -> A5 (880Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.22, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.55);
      }
    } catch (_) {}
  }

  public markAsRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }

  public clearAll(): void {
    this._notifications.set([]);
    this.hasNewDriverSubmission.set(false);
  }
}
