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

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { StompClientService } from '@4guard/shared-core';
import { AuthState } from '../auth/auth.state';
import { ToastService } from './toast.service';

export type NotificationCategory = 'SECURITY' | 'RECEIVING' | 'QUALITY' | 'OUTBOUND' | 'SYSTEM';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'ERROR';

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
export class SmartNotificationService implements OnDestroy {
  private readonly authState = inject(AuthState);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly stompService = inject(StompClientService);
  private readonly http = inject(HttpClient);

  private pollIntervalId: any = null;
  private readonly knownNotifiedFolios = new Set<string>();

  // ── Historial y Cola Reactiva de Notificaciones ──
  private readonly _notifications = signal<SmartNotification[]>([]);
  public readonly notifications = this._notifications.asReadonly();

  // ── Señales de Conteo por Categoría ──
  public readonly unreadCount = computed(() => this._notifications().filter(n => !n.isRead).length);

  // Pases de Chofer QR en espera de validación por Caseta
  public readonly pendingDriverPasses = signal<any[]>([]);
  public readonly pendingDriverPassesCount = computed(() => this.pendingDriverPasses().length);
  public readonly hasNewDriverSubmission = signal<boolean>(false);

  // Rampas Asignadas por Almacén pendientes de acceso en Caseta
  public readonly pendingRampAssignments = signal<Array<{
    id: string;
    folio: string;
    rampNumber: number | string;
    client: string;
    driverName: string;
    tractorPlates: string;
    docNumber?: string;
    carrierLine?: string;
    time: string;
    timestamp: Date;
  }>>([]);
  public readonly pendingRampAssignmentsCount = computed(() => this.pendingRampAssignments().length);
  public readonly hasNewRampAssignment = signal<boolean>(false);

  // Unidades en patio autorizadas y listas para salida (Check-Out)
  public readonly readyForExitPasses = signal<any[]>([]);
  public readonly readyForExitCount = computed(() => this.readyForExitPasses().length);

  // Última notificación despachada
  public readonly latestNotification = signal<SmartNotification | null>(null);

  // Pase seleccionado para ser cargado automáticamente en el formulario de Caseta
  public readonly requestedPassToLoad = signal<any | null>(null);

  // Solicitud global para desplegar el modal de notificaciones operativas
  public readonly isDropdownOpenRequested = signal<boolean>(false);

  public openDropdown(): void {
    this.isDropdownOpenRequested.set(true);
  }

  public clearDropdownOpenRequest(): void {
    this.isDropdownOpenRequested.set(false);
  }

  private broadcastChannel: BroadcastChannel | null = null;

  public requestLoadDriverPass(pass: any): void {
    this.requestedPassToLoad.set(pass);
  }

  public clearRequestedPassToLoad(): void {
    this.requestedPassToLoad.set(null);
  }

  private handleIncomingRampAlert(notification: SmartNotification): void {
    const titleUpper = (notification.title || '').toUpperCase();
    if (notification.category === 'SECURITY' && (titleUpper.includes('RAMPA') || titleUpper.includes('ACCESO')) && notification.data) {
      const d = notification.data;
      const checkIn = d.checkIn || {};
      const rampNum = checkIn.rampNumber || d.rampNumber || '';
      if (rampNum) {
        const rampAlert = {
          id: notification.id,
          folio: String(d.folio || notification.referenceFolio || 'S/F'),
          rampNumber: rampNum,
          client: checkIn.client || d.client || 'Cliente',
          driverName: checkIn.driverName || d.driverName || 'Chofer Transportista',
          tractorPlates: checkIn.tractorPlates || d.tractorPlates || 'S/P',
          docNumber: checkIn.docNumber || d.docNumber || '',
          carrierLine: checkIn.carrierLine || d.carrierLine || '',
          noEcoTractor: checkIn.noEcoTractor || d.noEcoTractor || 'S/N',
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date()
        };
        this.pendingRampAssignments.update(list => [rampAlert, ...list.filter(item => item.folio !== rampAlert.folio)]);
        this.hasNewRampAssignment.set(true);
      }
    }
  }

  constructor() {
    this.initStompSubscriptions();
    this.startBackupPolling();
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('4guard_wms_events');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'NOTIFICATION' && event.data.notification) {
              const notif = event.data.notification;
              if (!this._notifications().some((n) => n.id === notif.id)) {
                this._notifications.update((list) => [notif, ...list.slice(0, 49)]);
                this.handleIncomingRampAlert(notif);
                if (this.isRelevantForCurrentUser(notif)) {
                  this.latestNotification.set(notif);
                  this.playChime(notif.severity);
                }
              }
            }
          };
        } catch (_) {}
      }

      window.addEventListener('storage', (e) => {
        if (e.key === '4g_last_notification' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.notification) {
              const notif = parsed.notification;
              if (!this._notifications().some((n) => n.id === notif.id)) {
                this._notifications.update((list) => [notif, ...list.slice(0, 49)]);
                this.handleIncomingRampAlert(notif);
                if (this.isRelevantForCurrentUser(notif)) {
                  this.latestNotification.set(notif);
                  this.playChime(notif.severity);
                }
              }
            }
          } catch (_) {}
        }
      });
    }
  }

  /**
   * Suscripción en tiempo real a tópicos STOMP WebSocket para la Consola de Administración.
   */
  private initStompSubscriptions(): void {
    if (typeof window === 'undefined') return;

    // 1. Tópico de Caseta / Pases de Acceso (/topic/org/{orgId}/branch/{branchId}/gate)
    this.stompService.watchBranchDriverPasses().subscribe({
      next: (event: any) => {
        if (!event) return;
        const type = event.eventType;

        if (type === 'DRIVER_PRE_CHECKIN_SUBMITTED' || event.status === 'SUBMITTED') {
          const driverName = event.driverName || 'Chofer';
          const carrier = event.carrierName || 'Transportista';
          const token = event.token || event.folio || 'QR';

          this.pendingDriverPasses.update(list => [event, ...list.filter(p => (p.token || p.id) !== token)]);
          this.hasNewDriverSubmission.set(true);

          this.dispatch({
            category: 'SECURITY',
            title: '🚛 Chofer Completó Registro QR',
            message: `Pase #${token} (${driverName} - ${carrier}) listo para inspección en Caseta.`,
            referenceFolio: token,
            route: '/security',
            targetRoles: ['ADMIN', 'SECURITY_GUARD', 'VIGILANCIA'],
            targetRoutes: ['/security'],
            severity: 'SUCCESS',
            data: event
          });
        } else if (type === 'GUARD_CHECKIN_COMPLETED') {
          const token = event.token || event.folio;
          this.pendingDriverPasses.update(list => list.filter(p => (p.token || p.id) !== token));

          this.dispatch({
            category: 'RECEIVING',
            title: '✅ Arribo Validado en Caseta',
            message: `Unidad con folio ${event.folio || token} aprobada en caseta e ingresando al patio.`,
            referenceFolio: event.folio || token,
            route: '/receiving',
            severity: 'INFO',
            data: event
          });
        } else if (type === 'GUARD_CHECKOUT_COMPLETED') {
          this.readyForExitPasses.update(list => list.filter(p => (p.folio || p.token) !== (event.folio || event.token)));
        }
      },
      error: (err) => console.error('[Console-STOMP] Error en canal de Caseta:', err)
    });

    // 2. Tópico de Rampas (/topic/org/{orgId}/branch/{branchId}/ramps)
    this.stompService.watchBranchRamps().subscribe({
      next: (event: any) => {
        if (!event) return;
        const type = event.eventType;

        if (type === 'RAMP_ASSIGNED') {
          const rampNum = event.rampNumber || (event.rampCode ? event.rampCode.replace(/[^0-9]/g, '') : 'Andén');
          const rampAlert = {
            id: event.rampId || event.currentFolio || `ramp-${Date.now()}`,
            folio: String(event.currentFolio || 'S/F'),
            rampNumber: rampNum,
            client: event.clientName || 'Cliente',
            driverName: event.driverName || 'Chofer Transportista',
            tractorPlates: event.tractorPlates || 'S/P',
            docNumber: event.docNumber || '',
            carrierLine: event.carrierName || '',
            time: new Date(event.timestamp || Date.now()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date()
          };

          this.pendingRampAssignments.update(list => [rampAlert, ...list.filter(item => item.folio !== rampAlert.folio)]);
          this.hasNewRampAssignment.set(true);

          this.dispatch({
            category: 'RECEIVING',
            title: '🚦 Rampa Asignada',
            message: `Folio #${event.currentFolio} (${event.clientName || 'Cliente'}) asignado a Rampa ${rampNum}.`,
            referenceFolio: String(event.currentFolio),
            route: '/receiving',
            targetRoles: ['ADMIN', 'OPERATIONS_MANAGER', 'WAREHOUSE_MANAGER', 'CONTROL_DESK', 'SHIFT_LEADER', 'OPERATIONS_SUPERVISOR', 'SECURITY_GUARD', 'VIGILANCIA'],
            targetRoutes: ['/receiving', '/warehouse-movements', '/security'],
            severity: 'INFO',
            data: event
          });
        } else if (type === 'RAMP_RELEASED') {
          if (event.currentFolio) {
            this.dismissRampAssignment(String(event.currentFolio));
          }
        }
      },
      error: (err) => console.error('[Console-STOMP] Error en canal de Rampas:', err)
    });

    // 3. Tópico de Calidad QM (/topic/org/{orgId}/branch/{branchId}/quality)
    this.stompService.watchBranchQualityAlerts().subscribe({
      next: (event: any) => {
        if (!event) return;
        const type = event.eventType;

        if (type === 'QM_BLOCK_ALERT') {
          this.dispatch({
            category: 'QUALITY',
            title: '⛔ Alerta de Calidad - Bloqueo de Lote/SSCC',
            message: `SSCC ${event.sscc || 'S/N'}: ${event.reason || 'Desviación de calidad'} (${event.severity || 'CRITICAL'}).`,
            referenceFolio: event.sscc,
            route: '/quality',
            severity: 'CRITICAL',
            data: event
          });
        } else if (type === 'QM_RELEASE_AUTHORIZED') {
          this.dispatch({
            category: 'QUALITY',
            title: '🔓 Liberación de Calidad Autorizada',
            message: `SSCC ${event.sscc || 'S/N'} liberado por ${event.reportedBy || 'Calidad'}.`,
            referenceFolio: event.sscc,
            route: '/quality',
            severity: 'SUCCESS',
            data: event
          });
        }
      },
      error: (err) => console.error('[Console-STOMP] Error en canal de Calidad:', err)
    });
  }

  /**
   * Determina si el usuario logueado actualmente debe recibir la notificación
   * basándose en su Rol asignado, Nivel jerárquico y Módulo actual en pantalla.
   */
  public isRelevantForCurrentUser(notif: SmartNotification): boolean {
    const user = this.authState.currentUser();
    if (!user) return false;

    const currentRole = (user.role || '').toUpperCase();
    const currentRoute = this.router.url;

    // El Gerente de Operaciones / Almacén recibe recepciones, salidas y asignaciones operativas
    if (
      currentRole === 'OPERATIONS_MANAGER' ||
      currentRole === 'ROLE_OPERATIONS_MANAGER' ||
      currentRole === 'WAREHOUSE_MANAGER' ||
      currentRole === 'ROLE_WAREHOUSE_MANAGER'
    ) {
      if (notif.category === 'SECURITY' && !notif.targetRoutes?.includes('/receiving') && !notif.targetRoles?.includes(currentRole)) {
        return false;
      }
    }

    // 1. Director General, Super Administradores y Directores reciben todas las alertas
    if (
      currentRole.includes('ADMIN') ||
      currentRole.includes('DIRECTOR') ||
      currentRole.includes('CEO')
    ) {
      return true;
    }

    // 1.1 Gerentes y Supervisores operativos para sus categorias pertinentes
    if (
      currentRole.includes('MANAGER') ||
      (user.roleLevel && user.roleLevel >= 3)
    ) {
      if (notif.category === 'SECURITY' && !notif.targetRoutes?.includes('/receiving') && !notif.targetRoles?.includes(currentRole)) {
        return false;
      }
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
          currentRole.includes('CONTROL_DESK') ||
          currentRole.includes('MESA') ||
          currentRole.includes('SHIFT_LEADER') ||
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
          currentRole.includes('CONTROL_DESK') ||
          currentRole.includes('MESA') ||
          currentRole.includes('SHIFT_LEADER') ||
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
    // Control Anti-Spam: Prevenir duplicados con misma categoría, título y referencia en menos de 60 segundos
    const now = Date.now();
    const isDuplicate = this._notifications().some(n =>
      n.category === notifInput.category &&
      n.title === notifInput.title &&
      n.referenceFolio === notifInput.referenceFolio &&
      (now - new Date(n.timestamp).getTime()) < 60000
    );
    if (isDuplicate) {
      return null;
    }

    const notification: SmartNotification = {
      ...notifInput,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      isRead: false
    };

    // Agregar al historial global
    this._notifications.update(list => [notification, ...list.slice(0, 49)]);

    // Registrar en cola de rampas si aplica
    this.handleIncomingRampAlert(notification);

    // Notificar a otras pestañas/dispositivos (ej. Terminal RF en tablet montacarguista)
    try {
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({ type: 'NOTIFICATION', notification });
        localStorage.setItem('4g_last_notification', payload);
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({ type: 'NOTIFICATION', notification });
        } else if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('4guard_wms_events');
          bc.postMessage({ type: 'NOTIFICATION', notification });
          setTimeout(() => { try { bc.close(); } catch(_) {} }, 1000);
        }
      }
    } catch (_) {}

    // Verificar si aplica al usuario logueado en este momento
    if (this.isRelevantForCurrentUser(notification)) {
      this.latestNotification.set(notification);
      this.playChime(notification.severity);
      return notification;
    }

    return null;
  }

  /**
   * Descarta una alerta de asignación de rampa una vez atendida por el oficial de Caseta.
   */
  public dismissRampAssignment(folio: string): void {
    this.pendingRampAssignments.update(list => list.filter(item => item.folio !== folio && item.id !== folio));
    if (this.pendingRampAssignments().length === 0) {
      this.hasNewRampAssignment.set(false);
    }
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
   * Actualiza la lista de unidades en patio autorizadas y listas para salida (Check-Out).
   */
  public updateReadyForExitPasses(passes: any[]): void {
    const ready = (passes || []).filter(p => p && p.isReadyForExit === true);
    this.readyForExitPasses.set(ready);
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

      if (severity === 'CRITICAL' || severity === 'WARNING' || severity === 'ERROR') {
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

  /**
   * Sondeo de respaldo en segundo plano (cada 10 segundos).
   * Garantiza que la Consola de Recepción y Caseta reciban nuevos arribos y pases
   * incluso si el WebSocket STOMP parpadea o la red se interrumpe momentáneamente.
   */
  private startBackupPolling(): void {
    if (typeof window === 'undefined') return;

    this.pollIntervalId = setInterval(() => {
      if (!this.authState.isAuthenticated()) return;

      const user = this.authState.currentUser();
      const orgId = user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
      const branchId = user?.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

      // 1. Polling de Choferes QR en Caseta (/api/v1/security-gate/passes/active)
      this.http.get<any>('/api/v1/security-gate/passes/active', {
        params: { organizationId: orgId, branchId }
      }).pipe(
        catchError(() => of(null))
      ).subscribe(res => {
        const passes = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(passes) && passes.length > 0) {
          const submitted = passes.filter((p: any) => p && (p.status === 'SUBMITTED' || p.status === 'PENDING_DRIVER'));
          submitted.forEach((p: any) => {
            const token = p.token || p.id;
            if (token && !this.knownNotifiedFolios.has(`driver-${token}`)) {
              this.knownNotifiedFolios.add(`driver-${token}`);
              this.pendingDriverPasses.update(list => [p, ...list.filter((item: any) => (item.token || item.id) !== token)]);
              this.hasNewDriverSubmission.set(true);
              this.dispatch({
                category: 'SECURITY',
                title: '🚛 Chofer Completó Registro QR',
                message: `Pase #${token} (${p.driverName || 'Chofer'} - ${p.carrierLine || 'Transportista'}) listo para inspección en Caseta.`,
                referenceFolio: String(token),
                route: '/security',
                targetRoles: ['ADMIN', 'SECURITY_GUARD', 'VIGILANCIA'],
                targetRoutes: ['/security'],
                severity: 'SUCCESS',
                data: p
              });
            }
          });
        }
      });

      // 2. Polling de Arribos y Asignación de Rampas (/api/v1/warehouse/receptions)
      this.http.get<any>('/api/v1/warehouse/receptions', {
        params: { organizationId: orgId, branchId }
      }).pipe(
        catchError(() => of(null))
      ).subscribe(res => {
        const recs = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(recs) && recs.length > 0) {
          recs.forEach((rec: any) => {
            const fol = String(rec.folio || rec.id || '');
            if (fol && !this.knownNotifiedFolios.has(`rec-${fol}`)) {
              this.knownNotifiedFolios.add(`rec-${fol}`);
              const rampNum = rec.rampNumber || rec.checkIn?.rampNumber;
              const rDisplay = rampNum ? `Rampa ${rampNum}` : (rec.rampCode || rec.checkIn?.rampCode || 'Andén');

              if (rampNum) {
                const rampAlert = {
                  id: rec.id || `ramp-${fol}`,
                  folio: fol,
                  rampNumber: rampNum,
                  client: rec.clientName || rec.client || rec.checkIn?.client || 'Cliente',
                  driverName: rec.driverName || rec.checkIn?.driverName || 'Chofer Transportista',
                  tractorPlates: rec.tractorPlates || rec.checkIn?.tractorPlates || 'S/P',
                  docNumber: rec.docNumber || rec.checkIn?.docNumber || fol,
                  carrierLine: rec.carrierLine || rec.checkIn?.carrierLine || '',
                  time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: new Date()
                };
                this.pendingRampAssignments.update(list => [rampAlert, ...list.filter((item: any) => item.folio !== fol)]);
                this.hasNewRampAssignment.set(true);
              }

              this.dispatch({
                category: 'RECEIVING',
                title: '🚛 Arribo Validado en Caseta',
                message: `Folio #${fol} (${rec.clientName || rec.client || 'Cliente'}) arribó a patio · ${rDisplay}.`,
                referenceFolio: fol,
                route: '/receiving',
                targetRoles: ['ADMIN', 'OPERATIONS_MANAGER', 'WAREHOUSE_MANAGER', 'CONTROL_DESK', 'SHIFT_LEADER', 'OPERATIONS_SUPERVISOR', 'SECURITY_GUARD'],
                targetRoutes: ['/receiving', '/warehouse-movements', '/security'],
                severity: 'SUCCESS',
                data: rec
              });
            }
          });
        }
      });
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}
