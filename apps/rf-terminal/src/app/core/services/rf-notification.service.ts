/**
 * @file rf-notification.service.ts
 * @description Motor de Notificaciones Operativas en Tiempo Real para la Terminal RF.
 * Conforme a ADR-012, ADR-017 y ADR-018:
 * - Filtra por contexto y rol activo: Caseta (Choferes QR, Rampas, Salidas) vs Almacén (Pre-Recepciones).
 * - Sincronizado con API Backend (/api/v1/security-gate/passes/active e in-yard), BroadcastChannel y Storage Events.
 * - Emite alertas acústicas amigables basadas en Web Audio API (Tríada Mayor D5 -> F#5 -> A5 + D6).
 * - Provee puente de carga 1-Tap hacia el Formulario Oficial F01 de Caseta (requestedPassToLoad).
 */

import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from './audio-feedback.service';

export interface DriverPassNotification {
  id: string;
  token: string;
  carrierName: string;
  driverName: string;
  driverPhone?: string;
  tractorPlates: string;
  boxPlates?: string;
  ecoNumber?: string;
  boxDimensions?: string;
  transportType?: string;
  operationType: 'INBOUND' | 'OUTBOUND';
  documentNumber: string;
  clientName?: string;
  rampNumber?: number | string;
  sealNumbers?: string[];
  checklistData?: any;
  status: 'SUBMITTED' | 'PENDING_DRIVER';
  submittedAt: Date;
  time: string;
}

export interface ReadyExitPassNotification {
  id: string;
  folio: string;
  token?: string;
  driverName: string;
  carrierName: string;
  tractorPlates: string;
  rampCode?: string;
  rampNumber?: number | string;
  time: string;
  isReadyForExit: boolean;
}

export interface RampAlertNotification {
  id: string;
  folio: string;
  rampNumber: number | string;
  client: string;
  driverName: string;
  tractorPlates: string;
  time: string;
}

export interface ReceptionAlertNotification {
  id: string;
  folio: string;
  client: string;
  carrier: string;
  rampNumber?: number | string;
  docNumber?: string;
  driverName?: string;
  time: string;
  pieces?: number;
}

@Injectable({
  providedIn: 'root'
})
export class RfNotificationService {
  private readonly audioFeedback = inject(AudioFeedbackService);
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private broadcastChannel: BroadcastChannel | null = null;
  private beaconTimeoutId: any = null;
  private pollIntervalId: any = null;

  private readonly notifiedTokens = new Set<string>();

  // ── URL Activa para Contexto Reactivo ──
  public readonly currentUrl = signal<string>(this.router.url);

  // ── Preferencia de Silencio / Sonido ──
  public readonly isSoundMuted = signal<boolean>(false);

  // ── Puente 1-Tap hacia el Formulario Oficial F01 de Caseta ──
  public readonly requestedPassToLoad = signal<any | null>(null);

  // ── 1. Cola de Pases QR de Choferes (status === 'SUBMITTED') ──
  public readonly pendingDriverPasses = signal<DriverPassNotification[]>([]);
  public readonly pendingDriverPassesCount = computed(() => this.pendingDriverPasses().length);

  // ── 2. Cola de Rampas Asignadas por Almacén ──
  public readonly pendingRampAssignments = signal<RampAlertNotification[]>([]);
  public readonly pendingRampAssignmentsCount = computed(() => this.pendingRampAssignments().length);

  // ── 3. Cola de Unidades en Patio Listas para Salida (Check-Out) ──
  public readonly readyForExitPasses = signal<ReadyExitPassNotification[]>([]);
  public readonly readyForExitCount = computed(() => this.readyForExitPasses().length);

  // ── 4. Cola de Pre-Recepciones en Almacén (Inbound para Montacarguista) ──
  public readonly pendingReceptions = signal<ReceptionAlertNotification[]>([]);
  public readonly pendingReceptionsCount = computed(() => this.pendingReceptions().length);

  // ── Baliza Luminosa Pulsante en Vivo ──
  public readonly hasNewArrivalBeacon = signal<boolean>(false);

  // ── Contexto Operativo Reactivo ──
  public readonly isSecurityContext = computed(() => {
    const url = this.currentUrl();
    const role = (this.authState.role() || '').toUpperCase();
    return (
      url.startsWith('/security') ||
      role.includes('SECURITY') ||
      role.includes('VIGILAN') ||
      role.includes('GUARD') ||
      role.includes('CASETA')
    );
  });

  public readonly totalVisibleCount = computed(() => {
    if (this.isSecurityContext()) {
      return this.pendingDriverPassesCount() + this.pendingRampAssignmentsCount() + this.readyForExitCount();
    }
    return this.pendingReceptionsCount();
  });

  constructor() {
    this.initSoundPreference();
    this.initDismissedTokens();
    this.initRouteTracking();
    this.initCrossTabSync();
    this.loadInitialPasses();
    this.startBackgroundSync();
  }

  private initDismissedTokens(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem('4g_dismissed_driver_passes');
      if (stored) {
        const list: string[] = JSON.parse(stored);
        if (Array.isArray(list)) {
          for (const t of list) this.dismissedTokens.add(t);
        }
      }
    } catch (_) {}
  }

  private initRouteTracking(): void {
    this.currentUrl.set(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      this.currentUrl.set(e.urlAfterRedirects || e.url);
    });
  }

  private initSoundPreference(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem('4g_rf_sound_muted');
      if (stored !== null) {
        this.isSoundMuted.set(stored === 'true');
      }
    } catch (_) {}
  }

  public toggleSound(): void {
    const next = !this.isSoundMuted();
    this.isSoundMuted.set(next);
    try {
      localStorage.setItem('4g_rf_sound_muted', String(next));
    } catch (_) {}
    if (!next) {
      this.playFriendlyArrivalChime();
    }
  }

  public playFriendlyArrivalChime(): void {
    this.audioFeedback.playFriendlyArrivalChime(1.0);
  }

  // ── Puente de Carga 1-Tap hacia Caseta ──
  public requestLoadDriverPass(pass: any): void {
    this.requestedPassToLoad.set(pass);
    this.hasNewArrivalBeacon.set(false);
  }

  public clearRequestedPassToLoad(): void {
    this.requestedPassToLoad.set(null);
  }

  /**
   * Sincronización multi-ventana en tiempo real mediante BroadcastChannel y Storage
   */
  private initCrossTabSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('4guard_wms_events');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      }
    } catch (_) {}

    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === '4g_last_notification' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingBroadcast(parsed);
        } catch (_) {}
      }
    });
  }

  private handleIncomingBroadcast(data: any): void {
    if (!data) return;
    const notif = data.notification || data;

    // Chofer QR completado
    if (notif.category === 'SECURITY' && (notif.title?.includes('Chofer') || notif.data?.status === 'SUBMITTED')) {
      const p = notif.data || {};
      const token = p.token || notif.referenceFolio || 'PASS-QR';
      if (this.dismissedTokens.has(token)) return;

      const carrier = p.carrierLine || p.carrierName || notif.referenceLine || 'Transportista';
      const client = p.clientName || p.client || notif.referenceClient || 'Cliente';
      const doc = p.remision || p.docNumber || p.noCartaPorte || p.documentNumber || '';

      this.addSubmittedDriverPass({
        id: p.id || notif.id,
        token: token,
        carrierName: carrier,
        driverName: p.driverName || p.nombreOperador || 'Operador',
        driverPhone: p.driverPhone,
        tractorPlates: p.tractorPlates || p.placasTracto || 'S/P',
        boxPlates: p.boxPlates || p.placasCaja || '',
        ecoNumber: p.ecoNumber || p.noEcoTractor,
        boxDimensions: p.boxDimensions || p.medidasCaja || p.boxSize,
        transportType: p.transportType || p.tipoTransporte || p.vehicleType,
        operationType: (p.operationType === 'CARGA' || p.operationType === 'OUTBOUND') ? 'OUTBOUND' : 'INBOUND',
        documentNumber: doc,
        clientName: client,
        sealNumbers: p.sealNumbers || [],
        checklistData: p.checklistData,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      });
    }

    // Rampa asignada
    if (notif.category === 'SECURITY' && notif.title?.includes('Rampa') && notif.data) {
      const d = notif.data;
      const rampNum = d.checkIn?.rampNumber || d.rampNumber;
      if (rampNum) {
        this.addRampAssignment({
          id: notif.id,
          folio: String(d.folio || notif.referenceFolio || 'S/F'),
          rampNumber: rampNum,
          client: d.checkIn?.client || d.client || 'Cliente',
          driverName: d.checkIn?.driverName || d.driverName || 'Chofer',
          tractorPlates: d.checkIn?.tractorPlates || d.tractorPlates || 'S/P',
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
      }
    }

    // Unidad lista para salida
    if (notif.category === 'SECURITY' && (notif.title?.includes('Salida') || notif.data?.isReadyForExit)) {
      const p = notif.data;
      if (p) {
        this.addReadyExitPass({
          id: p.id || notif.id,
          folio: p.token || p.generatedFolio || notif.referenceFolio || 'S/F',
          token: p.token,
          driverName: p.driverName || 'Chofer',
          carrierName: p.carrierLine || p.carrierName || 'Transportista',
          tractorPlates: p.tractorPlates || 'S/P',
          rampCode: p.rampCode || `Rampa ${p.rampNumber || ''}`,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          isReadyForExit: true
        });
      }
    }

    // Recepción arribada
    if (notif.category === 'RECEIVING') {
      const d = notif.data;
      this.addReceptionAlert({
        id: notif.id,
        folio: notif.referenceFolio || d?.folio || 'REC-S/F',
        client: d?.checkIn?.client || d?.client || notif.title,
        carrier: d?.checkIn?.carrierLine || d?.carrier || 'Transportista',
        rampNumber: d?.checkIn?.rampNumber || d?.rampNumber,
        docNumber: d?.checkIn?.docNumber || d?.docNumber,
        driverName: d?.checkIn?.driverName || d?.driverName,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        pieces: d?.totalPieces || 48
      });
    }
  }

  // ── Inserción de Eventos con Alerta Acústica Amigable ──
  public addSubmittedDriverPass(pass: DriverPassNotification): void {
    if (this.dismissedTokens.has(pass.token)) return;
    if (this.notifiedTokens.has(pass.token)) return;
    this.notifiedTokens.add(pass.token);

    this.pendingDriverPasses.update(list => [pass, ...list.filter(p => p.token !== pass.token)]);
    this.triggerBeacon();
    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }
  }

  public addRampAssignment(ramp: RampAlertNotification): void {
    this.pendingRampAssignments.update(list => [ramp, ...list.filter(r => r.folio !== ramp.folio)]);
    this.triggerBeacon();
    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }
  }

  public addReadyExitPass(exitPass: ReadyExitPassNotification): void {
    const key = exitPass.folio;
    if (this.notifiedTokens.has(key)) return;
    this.notifiedTokens.add(key);

    this.readyForExitPasses.update(list => [exitPass, ...list.filter(p => p.folio !== key)]);
    this.triggerBeacon();
    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }
  }

  public addReceptionAlert(rec: ReceptionAlertNotification): void {
    this.pendingReceptions.update(list => [rec, ...list.filter(r => r.folio !== rec.folio)]);
    this.triggerBeacon();
    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }
  }

  public dismissRamp(folio: string): void {
    this.pendingRampAssignments.update(list => list.filter(r => r.folio !== folio));
  }

  private readonly dismissedTokens = new Set<string>();
  public readonly dismissedTokensVersion = signal<number>(0);

  public isPassDismissed(token: string): boolean {
    if (!token) return false;
    this.dismissedTokensVersion(); // Registro de dependencia reactiva
    return this.dismissedTokens.has(token);
  }

  public dismissDriverPass(token: string): void {
    if (!token) return;
    this.dismissedTokens.add(token);
    this.dismissedTokensVersion.update(v => v + 1);
    this.pendingDriverPasses.update(list => list.filter(p => p.token !== token));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('4g_dismissed_driver_passes');
        const list: string[] = stored ? JSON.parse(stored) : [];
        if (!list.includes(token)) {
          list.push(token);
          localStorage.setItem('4g_dismissed_driver_passes', JSON.stringify(list));
        }
      }
    } catch {}
  }

  public dismissExitPass(folio: string): void {
    this.readyForExitPasses.update(list => list.filter(p => p.folio !== folio));
  }

  private triggerBeacon(): void {
    this.hasNewArrivalBeacon.set(true);
    if (this.beaconTimeoutId) clearTimeout(this.beaconTimeoutId);
    this.beaconTimeoutId = setTimeout(() => {
      this.hasNewArrivalBeacon.set(false);
    }, 12000);
  }

  private backendFailureCount = 0;

  /**
   * Carga inicial y sondeo periódico contra la base de datos a través de los endpoints REST
   */
  private loadInitialPasses(): void {
    if (this.isSecurityContext()) {
      this.fetchActivePassesFromBackend();
      this.fetchInYardPassesFromBackend();
    } else {
      this.loadPassesFromStorageFallback();
    }
  }

  private startBackgroundSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.pollIntervalId = setInterval(() => {
      // 1. Solo sondeos en Caseta / Seguridad (no montacargas ni almacén)
      if (!this.isSecurityContext()) return;

      // 2. Si el backend está caído (ECONNREFUSED / 502), no saturar la consola cada 4s
      if (this.backendFailureCount >= 3) {
        // En modo offline, leemos de storage local
        this.loadPassesFromStorageFallback();
        return;
      }

      this.fetchActivePassesFromBackend();
      this.fetchInYardPassesFromBackend();
    }, 4000);

    // Sondeo lento cada 60s para auto-recuperar si el backend vuelve a estar en línea
    setInterval(() => {
      if (this.backendFailureCount >= 3 && this.isSecurityContext()) {
        this.fetchActivePassesFromBackend();
      }
    }, 60000);
  }

  private getOrgId(): string {
    const user = this.authState.user() as any;
    if (user?.organizationId && user.organizationId.length === 36 && user.organizationId !== '44444444-4444-4444-4444-444444444444') {
      return user.organizationId;
    }
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.organizationId && session.organizationId.length === 36) return session.organizationId;
      }
      const authUserStr = localStorage.getItem('auth_user') || localStorage.getItem('user');
      if (authUserStr) {
        const u = JSON.parse(authUserStr);
        if (u.organizationId && u.organizationId.length === 36) return u.organizationId;
      }
    } catch {}
    return 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
  }

  private fetchActivePassesFromBackend(): void {
    const orgId = this.getOrgId();
    const params = new HttpParams().set('organizationId', orgId);

    this.http.get<any>(`/api/v1/security-gate/passes/active`, { params }).subscribe({
      next: (res) => {
        this.backendFailureCount = 0;
        const rawList = res?.data || res || [];
        if (Array.isArray(rawList)) {
          const submittedOnly = rawList.filter((p: any) => p && p.status === 'SUBMITTED' && !this.dismissedTokens.has(p.token));
          const mapped: DriverPassNotification[] = submittedOnly.map((p: any) => {
            const doc = p.remision || p.docNumber || p.noCartaPorte || p.documentNumber || '';
            return {
              id: p.id || p.token,
              token: p.token,
              carrierName: p.carrierLine || p.carrierName || 'Transportista',
              driverName: p.driverName || p.nombreOperador || 'Operador',
              driverPhone: p.driverPhone,
              tractorPlates: p.tractorPlates || p.placasTracto || 'S/P',
              boxPlates: p.boxPlates || p.placasCaja,
              ecoNumber: p.noEcoTractor || p.ecoNumber,
              boxDimensions: p.boxDimensions || p.medidasCaja || p.boxSize,
              transportType: p.transportType || p.tipoTransporte || p.vehicleType,
              operationType: p.operationType === 'CARGA' || p.operationType === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
              documentNumber: doc,
              clientName: p.client || p.clientName || 'Cliente',
              rampNumber: p.rampNumber,
              sealNumbers: p.sealNumbers || [],
              checklistData: p.checklistData,
              status: 'SUBMITTED',
              submittedAt: new Date(p.submittedAt || p.createdAt || Date.now()),
              time: new Date(p.submittedAt || p.createdAt || Date.now()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            };
          });

          // Comparar si hay nuevos para sonar el chime
          if (mapped.length > this.pendingDriverPasses().length && this.pendingDriverPasses().length > 0) {
            if (!this.isSoundMuted()) this.playFriendlyArrivalChime();
            this.triggerBeacon();
          }
          this.pendingDriverPasses.set(mapped);
        }
      },
      error: () => {
        this.backendFailureCount++;
        // En caso de que el backend esté offline, leer de localStorage de la caseta
        this.loadPassesFromStorageFallback();
      }
    });
  }

  private fetchInYardPassesFromBackend(): void {
    const orgId = this.getOrgId();
    const params = new HttpParams().set('organizationId', orgId);

    this.http.get<any>(`/api/v1/security-gate/passes/in-yard`, { params }).subscribe({
      next: (res) => {
        this.backendFailureCount = 0;
        const rawList = res?.data || res || [];
        if (Array.isArray(rawList)) {
          const readyList = rawList.filter((p: any) => p && (p.isReadyForExit || p.status === 'DISCHARGE_FINISHED'));
          const mapped: ReadyExitPassNotification[] = readyList.map((p: any) => ({
            id: p.id || p.token,
            folio: p.token || p.generatedFolio || 'S/F',
            token: p.token,
            driverName: p.driverName || 'Operador',
            carrierName: p.carrierLine || p.carrierName || 'Transportista',
            tractorPlates: p.tractorPlates || p.placasTracto || 'S/P',
            rampCode: p.rampCode || (p.rampNumber ? `Rampa ${p.rampNumber}` : 'Andén'),
            rampNumber: p.rampNumber,
            time: new Date(p.entryTime || Date.now()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            isReadyForExit: true
          }));

          if (mapped.length > this.readyForExitPasses().length && this.readyForExitPasses().length > 0) {
            if (!this.isSoundMuted()) this.playFriendlyArrivalChime();
            this.triggerBeacon();
          }
          this.readyForExitPasses.set(mapped);
        }
      },
      error: () => {
        this.backendFailureCount++;
      }
    });
  }

  private loadPassesFromStorageFallback(): void {
    try {
      if (typeof window === 'undefined') return;
      const rawActive = localStorage.getItem('4g_security_active_passes');
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        if (Array.isArray(parsed)) {
          const submitted = parsed.filter((p: any) => p && p.status === 'SUBMITTED' && !this.dismissedTokens.has(p.token));
          this.pendingDriverPasses.set(submitted.map((p: any) => ({
            id: p.id || p.token,
            token: p.token,
            carrierName: p.carrierLine || p.carrierName || 'Transportista',
            driverName: p.nombreOperador || p.driverName || 'Operador',
            driverPhone: p.driverPhone,
            tractorPlates: p.placasTracto || p.tractorPlates || 'S/P',
            boxPlates: p.placasCaja || p.boxPlates || '',
            ecoNumber: p.noEcoTractor || p.ecoNumber,
            boxDimensions: p.medidasCaja || p.boxDimensions || p.boxSize,
            transportType: p.tipoTransporte || p.transportType || p.vehicleType,
            operationType: (p.operacion === 'CARGA' || p.operationType === 'CARGA' || p.operationType === 'OUTBOUND') ? 'OUTBOUND' : 'INBOUND',
            documentNumber: p.remision || p.noCartaPorte || p.documentNumber || p.docNumber || '',
            clientName: p.clientName || p.client || 'Cliente',
            sealNumbers: p.sealNumbers || [],
            checklistData: p.checklistData,
            status: 'SUBMITTED',
            submittedAt: new Date(p.submittedAt || Date.now()),
            time: 'En espera'
          })));
        }
      }
    } catch (_) {}
  }
}
