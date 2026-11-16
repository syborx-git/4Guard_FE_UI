/**
 * @file stomp-client.service.ts
 * @description Cliente WebSocket STOMP de producción para 4GUARD WMS.
 * Diseñado conforme a ADR-012 (Offline-First), ADR-014 y ADR-017:
 * - Ciclo de vida reactivo atado a Signals de AuthState.
 * - Inyección dinámica de Bearer JWT y X-Branch-Id en CONNECT frames.
 * - Heartbeats 10s/10s.
 * - Reconexión con Backoff Exponencial y Jitter (2s a 30s).
 * - Tópicos tipados por sucursal y colas privadas de usuario.
 */

import { Injectable, inject, effect, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, distinctUntilChanged, map } from 'rxjs';
import { RxStomp, RxStompConfig, RxStompState } from '@stomp/rx-stomp';
import { IMessage } from '@stomp/stompjs';
import { AuthState } from '../../application/state/auth.state';
import { AuthService } from './auth.service';

/** Eventos Operativos de Sucursal */
export interface DriverPassWsMessage {
  eventType: 'DRIVER_PRE_CHECKIN_SUBMITTED' | 'GUARD_CHECKIN_COMPLETED' | 'GUARD_CHECKOUT_COMPLETED' | string;
  token?: string;
  id?: string;
  data?: any;
  timestamp?: string;
}

export interface RampAssignmentWsMessage {
  eventType: 'RAMP_ASSIGNED' | 'RAMP_RELEASED' | 'RAMP_BLOCKED' | string;
  folio?: string;
  rampNumber?: number | string;
  rampCode?: string;
  data?: any;
  timestamp?: string;
}

export interface ReceptionAlertWsMessage {
  eventType: 'INBOUND_DISCHARGE' | 'RECEPTION_ARRIVED' | string;
  folio?: string;
  client?: string;
  data?: any;
  timestamp?: string;
}

export interface ReadyExitWsMessage {
  eventType: 'GUARD_CHECKOUT_COMPLETED' | 'READY_FOR_EXIT' | string;
  folio?: string;
  token?: string;
  data?: any;
  timestamp?: string;
}

export interface QualityAlertWsMessage {
  eventType: 'QM_BLOCK_ALERT' | 'QM_RELEASE_AUTHORIZED' | string;
  severity?: string;
  sscc?: string;
  palletFolio?: string;
  sku?: string;
  reason?: string;
  data?: any;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StompClientService {
  private readonly authState = inject(AuthState);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  private readonly rxStomp: RxStomp = new RxStomp();

  // Control de Backoff Exponencial con Jitter
  private retryAttempt = 0;
  private readonly minDelayMs = 2000;  // 2s
  private readonly maxDelayMs = 30000; // 30s
  private readonly backoffFactor = 1.5;

  /** Estado reactivo de la conexión STOMP */
  public readonly connectionState$: Observable<RxStompState> = this.rxStomp.connectionState$;

  /** Emite true cuando STOMP está en estado OPEN */
  public readonly isConnected$: Observable<boolean> = this.connectionState$.pipe(
    map((state) => state === RxStompState.OPEN),
    distinctUntilChanged()
  );

  /** Emite cada vez que la conexión se restablece (gatillo para el patrón Catch-Up) */
  public readonly connected$: Observable<void> = this.rxStomp.connected$.pipe(
    map(() => void 0)
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.configureStompClient();
    this.initReactiveLifecycle();
  }

  // ─── Configuración Base del Cliente STOMP ───────────────────────────────────

  private configureStompClient(): void {
    const config: RxStompConfig = {
      brokerURL: this.resolveBrokerUrl(),

      // Heartbeats: 10s incoming / 10s outgoing conforme a RFC STOMP 1.2
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      // Delay inicial
      reconnectDelay: this.minDelayMs,

      // Inyección dinámica de tokens y headers antes de conectar/reconectar
      beforeConnect: async (client: RxStomp) => {
        const token = this.authService.getAccessToken();
        const branchId = this.authState.branchId() || this.authService.getBranchId() || '';
        const user = this.authState.user() as any;
        const orgId = user?.organizationId || '';

        client.configure({
          connectHeaders: {
            Authorization: token ? `Bearer ${token}` : '',
            'X-Organization-Id': orgId,
            'X-Branch-Id': branchId,
          }
        });
      },

      // Logs en desarrollo si está activada la bandera en ventana
      debug: (msg: string) => {
        if (typeof window !== 'undefined' && (window as any).__4GUARD_WS_DEBUG__) {
          console.log('[STOMP-WS]', msg);
        }
      }
    };

    this.rxStomp.configure(config);

    // Monitoreo del estado para recalcular Backoff + Jitter
    this.connectionState$.subscribe((state) => {
      if (state === RxStompState.OPEN) {
        // Conexión exitosa: reset de reintentos y delay base
        this.retryAttempt = 0;
        this.rxStomp.configure({ reconnectDelay: this.minDelayMs });
      } else if (state === RxStompState.CLOSED) {
        // Conexión cerrada: aplicar backoff exponencial con jitter
        this.retryAttempt++;
        const nextDelay = this.calculateBackoffWithJitter(this.retryAttempt);
        this.rxStomp.configure({ reconnectDelay: nextDelay });
      }
    });
  }

  /**
   * Calcula el intervalo de reintento usando Backoff Exponencial con Jitter Decorrelacionado (ADR-018).
   * Evita picos de tráfico sincronizado en routers y access points de almacén.
   */
  private calculateBackoffWithJitter(attempt: number): number {
    const exponential = Math.min(
      this.maxDelayMs,
      this.minDelayMs * Math.pow(this.backoffFactor, attempt)
    );
    // Jitter: variación aleatoria de +/- 20%
    const jitterVariance = exponential * 0.2;
    const jitter = (Math.random() * 2 - 1) * jitterVariance;
    const calculated = Math.round(exponential + jitter);

    return Math.max(this.minDelayMs, Math.min(this.maxDelayMs, calculated));
  }

  /**
   * Resuelve el endpoint WebSocket STOMP respetando el protocolo actual (ws:// o wss://).
   */
  private resolveBrokerUrl(): string {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
    const protocol = isHttps ? 'wss:' : 'ws:';
    return `${protocol}//${host}/ws-wms`;
  }

  // ─── Ciclo de Vida Reactivo con AuthState ───────────────────────────────────

  private initReactiveLifecycle(): void {
    // Escucha cambios en la autenticación del usuario mediante Signal Effect
    effect(() => {
      const isAuth = this.authState.isAuthenticated();
      const user = this.authState.user();

      this.ngZone.runOutsideAngular(() => {
        if (isAuth && user) {
          if (!this.rxStomp.active) {
            this.rxStomp.activate();
          }
        } else {
          if (this.rxStomp.active) {
            this.rxStomp.deactivate();
          }
        }
      });
    });
  }

  // ─── Tópicos Jerárquicos Multitenant por Organización y Sucursal ─────────────

  private resolveOrgId(): string {
    const user = this.authState.user() as any;
    return user?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
  }

  private resolveBranchId(customBranchId?: string): string {
    return customBranchId || this.authState.branchId() || this.authService.getBranchId() || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
  }

  /**
   * Escucha eventos de Pases de Choferes QR en la sucursal activa: /topic/org/{orgId}/branch/{branchId}/gate
   */
  public watchBranchDriverPasses(customBranchId?: string): Observable<any> {
    const orgId = this.resolveOrgId();
    const branchId = this.resolveBranchId(customBranchId);
    return this.watchTopic<any>(`/topic/org/${orgId}/branch/${branchId}/gate`);
  }

  /**
   * Escucha asignaciones de andenes/rampas en la sucursal activa: /topic/org/{orgId}/branch/{branchId}/ramps
   */
  public watchBranchRamps(customBranchId?: string): Observable<any> {
    const orgId = this.resolveOrgId();
    const branchId = this.resolveBranchId(customBranchId);
    return this.watchTopic<any>(`/topic/org/${orgId}/branch/${branchId}/ramps`);
  }

  /**
   * Escucha misiones y descargas arribadas en la sucursal activa: /topic/org/{orgId}/branch/{branchId}/missions
   */
  public watchBranchMissions(customBranchId?: string): Observable<any> {
    const orgId = this.resolveOrgId();
    const branchId = this.resolveBranchId(customBranchId);
    return this.watchTopic<any>(`/topic/org/${orgId}/branch/${branchId}/missions`);
  }

  /**
   * Escucha alertas de Calidad QM: /topic/org/{orgId}/branch/{branchId}/quality
   */
  public watchBranchQualityAlerts(customBranchId?: string): Observable<any> {
    const orgId = this.resolveOrgId();
    const branchId = this.resolveBranchId(customBranchId);
    return this.watchTopic<any>(`/topic/org/${orgId}/branch/${branchId}/quality`);
  }

  // ─── Canal Privado de Usuario ───────────────────────────────────────────────

  /**
   * Escucha la cola privada del usuario autenticado (/user/queue/missions o /user/queue/notifications)
   */
  public watchUserQueue<T = any>(queueSuffix = 'missions'): Observable<T> {
    const destination = `/user/queue/${queueSuffix.startsWith('/') ? queueSuffix.substring(1) : queueSuffix}`;
    return this.watchTopic<T>(destination);
  }

  // ─── Helper Genérico de Suscripción ─────────────────────────────────────────

  /**
   * Suscripción genérica tipada a cualquier destino STOMP con deserialización JSON segura.
   */
  public watchTopic<T = any>(destination: string): Observable<T> {
    return this.rxStomp.watch(destination).pipe(
      map((message: IMessage) => {
        try {
          const parsed = JSON.parse(message.body);
          // Si el backend envía el envoltorio BaseWsEventDto { eventId, eventType, data: { ... } }, desanidar data
          return (parsed && parsed.data !== undefined) ? (parsed.data as T) : (parsed as T);
        } catch {
          return message.body as unknown as T;
        }
      })
    );
  }

  /**
   * Publicación de mensajes STOMP hacia el backend.
   */
  public publish(destination: string, body: any): void {
    this.rxStomp.publish({
      destination,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  /**
   * Cierre controlado de conexión.
   */
  public disconnect(): Promise<void> {
    return this.rxStomp.deactivate();
  }
}

