/**
 * @file rf-notification.service.ts
 * @description Motor de Notificaciones Operativas en Tiempo Real para la Terminal RF.
 * Sincroniza solicitudes de recepción de Caseta, asignaciones de andenes/rampas,
 * y emite alertas acústicas amigables basadas en Web Audio API (Triada Mayor D5 -> F#5 -> A5).
 * 
 * Sincronización multi-pestaña con BroadcastChannel y Storage Events para recibir
 * eventos en vivo emitidos desde la Consola de Administración (Admin Console).
 */

import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AudioFeedbackService } from './audio-feedback.service';

export type RfNotificationCategory = 'RECEIVING' | 'RAMP' | 'OUTBOUND' | 'QUALITY';

export interface RfOperationalNotification {
  id: string;
  category: RfNotificationCategory;
  title: string;
  message: string;
  folio: string;
  client: string;
  carrier: string;
  rampNumber?: number | string;
  docNumber?: string;
  driverName?: string;
  tractorPlates?: string;
  timestamp: Date;
  time: string;
  pieces?: number;
  isRead: boolean;
  actionRoute: string;
  actionParams?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class RfNotificationService {
  private readonly audioFeedback = inject(AudioFeedbackService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private broadcastChannel: BroadcastChannel | null = null;
  private beaconTimeoutId: any = null;

  // ── Preferencia de Silencio / Sonido ──
  public readonly isSoundMuted = signal<boolean>(false);

  // ── Historial Reactivo de Notificaciones Operativas ──
  private readonly _notifications = signal<RfOperationalNotification[]>([
    {
      id: 'notif-inb-081',
      category: 'RECEIVING',
      title: 'Nueva Pre-Recepción en Caseta',
      message: 'Unidad de Nestlé México arribó a Caseta con 48 tarimas listas para descarga.',
      folio: 'REC-2026-081',
      client: 'Nestlé México S.A. de C.V.',
      carrier: 'Transportes Castores',
      rampNumber: 3,
      docNumber: 'REM-88102',
      driverName: 'Armando Salazar',
      tractorPlates: '88-AA-1Z',
      timestamp: new Date(Date.now() - 4 * 60000),
      time: '14:22',
      pieces: 1152,
      isRead: false,
      actionRoute: '/cockpit',
      actionParams: { folio: 'MIS-INB-2026-081' }
    },
    {
      id: 'notif-ramp-05',
      category: 'RAMP',
      title: 'Andén Rampa 05 Asignado',
      message: 'Mesa de Control asignó Rampa 05 para descarga de Aceite Sintético.',
      folio: 'REC-2026-084',
      client: 'Cervecería Cuauhtémoc Moctezuma',
      carrier: 'Fletes y Transportes Monterrey',
      rampNumber: 5,
      docNumber: 'REM-99214',
      driverName: 'Raúl Morales Téllez',
      tractorPlates: '42-BB-3X',
      timestamp: new Date(Date.now() - 11 * 60000),
      time: '14:15',
      pieces: 840,
      isRead: false,
      actionRoute: '/cockpit',
      actionParams: { rampa: 5 }
    }
  ]);

  public readonly notifications = this._notifications.asReadonly();

  // ── Señales Computadas por Categoría ──
  public readonly pendingReceptions = computed(() =>
    this._notifications().filter(n => n.category === 'RECEIVING')
  );
  public readonly pendingReceptionsCount = computed(() => this.pendingReceptions().length);

  public readonly pendingRampAssignments = computed(() =>
    this._notifications().filter(n => n.category === 'RAMP')
  );
  public readonly pendingRampAssignmentsCount = computed(() => this.pendingRampAssignments().length);

  public readonly pendingOutbounds = computed(() =>
    this._notifications().filter(n => n.category === 'OUTBOUND')
  );
  public readonly pendingOutboundsCount = computed(() => this.pendingOutbounds().length);

  public readonly totalVisibleCount = computed(() =>
    this.pendingReceptionsCount() + this.pendingRampAssignmentsCount() + this.pendingOutboundsCount()
  );

  public readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.isRead).length
  );

  // ── Baliza de Notificación en Vivo (Pulsing Glow Beacon) ──
  public readonly hasNewArrivalBeacon = signal<boolean>(true);
  public readonly latestArrival = signal<RfOperationalNotification | null>(null);

  constructor() {
    this.initSoundPreference();
    this.initCrossTabSync();
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

  /**
   * Sincronización multi-ventana y multi-dispositivo en tiempo real:
   * 1. BroadcastChannel ('4guard_wms_events')
   * 2. Eventos de localStorage ('4g_last_notification')
   * 3. CustomEvent en window ('4g:new-reception')
   */
  private initCrossTabSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('4guard_wms_events');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingEvent(event.data);
        };
      }
    } catch (_) {}

    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === '4g_last_notification' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingEvent(parsed);
        } catch (_) {}
      }
    });

    window.addEventListener('4g:new-reception', (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        this.notifyNewReception(customEvent.detail);
      }
    });
  }

  private handleIncomingEvent(data: any): void {
    if (!data) return;
    const notif = data.notification || data;

    if (notif.category === 'RECEIVING' || data.type === 'NEW_RECEPTION') {
      this.notifyNewReception({
        folio: notif.referenceFolio || notif.folio || `REC-${Date.now().toString().slice(-4)}`,
        client: notif.data?.checkIn?.client || notif.client || notif.title || 'Cliente General',
        carrier: notif.data?.checkIn?.carrierLine || notif.carrier || 'Transportista',
        rampNumber: notif.data?.checkIn?.rampNumber || notif.rampNumber,
        docNumber: notif.data?.checkIn?.docNumber || notif.docNumber,
        driverName: notif.data?.checkIn?.driverName || notif.driverName || 'Operador Transportista',
        tractorPlates: notif.data?.checkIn?.tractorPlates || notif.tractorPlates
      });
    } else if (notif.category === 'SECURITY' && (notif.title?.includes('Rampa') || notif.data?.rampNumber)) {
      this.notifyRampAssigned({
        folio: notif.referenceFolio || notif.folio || `FOL-${Date.now().toString().slice(-4)}`,
        rampNumber: notif.data?.rampNumber || notif.rampNumber || '01',
        client: notif.data?.client || notif.client || 'Cliente',
        driverName: notif.data?.driverName || notif.driverName || 'Chofer'
      });
    }
  }

  /**
   * Dispara una nueva Notificación de Recepción Inbound con Chime Armónico Amigable
   */
  public notifyNewReception(data: {
    folio: string;
    client: string;
    carrier: string;
    rampNumber?: number | string;
    docNumber?: string;
    driverName?: string;
    tractorPlates?: string;
    pieces?: number;
  }): RfOperationalNotification {
    const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const newNotif: RfOperationalNotification = {
      id,
      category: 'RECEIVING',
      title: '🚚 Nueva Solicitud de Recepción en Caseta',
      message: `Folio #${data.folio} (${data.client}) arribó con transportista ${data.carrier}. Lista para descarga.`,
      folio: data.folio,
      client: data.client,
      carrier: data.carrier,
      rampNumber: data.rampNumber || 'Por Asignar',
      docNumber: data.docNumber || 'S/N',
      driverName: data.driverName || 'Operador Transportista',
      tractorPlates: data.tractorPlates || 'S/P',
      timestamp: new Date(),
      time: timeStr,
      pieces: data.pieces || 48,
      isRead: false,
      actionRoute: '/cockpit',
      actionParams: { folio: data.folio }
    };

    // Agregar a la cola
    this._notifications.update(list => [newNotif, ...list.filter(n => n.folio !== data.folio)]);
    this.latestArrival.set(newNotif);
    this.triggerBeacon();

    // Reproducir sonido amigable
    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }

    return newNotif;
  }

  /**
   * Notificación de Asignación de Rampa
   */
  public notifyRampAssigned(data: {
    folio: string;
    rampNumber: number | string;
    client: string;
    driverName?: string;
  }): void {
    const id = `ramp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const newNotif: RfOperationalNotification = {
      id,
      category: 'RAMP',
      title: `🏢 Rampa ${data.rampNumber} Asignada`,
      message: `Andén listo para maniobra de ${data.client} (Operador: ${data.driverName || 'Chofer'}).`,
      folio: data.folio,
      client: data.client,
      carrier: 'Línea Transportista',
      rampNumber: data.rampNumber,
      driverName: data.driverName || 'Operador',
      timestamp: new Date(),
      time: timeStr,
      isRead: false,
      actionRoute: '/cockpit',
      actionParams: { rampa: data.rampNumber }
    };

    this._notifications.update(list => [newNotif, ...list.filter(n => n.id !== id)]);
    this.triggerBeacon();

    if (!this.isSoundMuted()) {
      this.playFriendlyArrivalChime();
    }
  }

  /**
   * Dispara el destello de la baliza luminosa durante 12 segundos
   */
  private triggerBeacon(): void {
    this.hasNewArrivalBeacon.set(true);
    if (this.beaconTimeoutId) {
      clearTimeout(this.beaconTimeoutId);
    }
    this.beaconTimeoutId = setTimeout(() => {
      this.hasNewArrivalBeacon.set(false);
    }, 12000);
  }

  /**
   * Reproduce el tono acústico armónico amigable D5 -> F#5 -> A5 + D6
   */
  public playFriendlyArrivalChime(): void {
    this.audioFeedback.playFriendlyArrivalChime(1.0);
  }

  /**
   * Marca una notificación como atendida/leída
   */
  public markAsRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }

  /**
   * Descarta / Atiende una solicitud y navega al flujo de descarga
   */
  public attendNotification(notif: RfOperationalNotification): void {
    this.markAsRead(notif.id);
    this.hasNewArrivalBeacon.set(false);
    if (notif.actionRoute) {
      this.router.navigate([notif.actionRoute], { queryParams: notif.actionParams });
    }
  }

  public clearAll(): void {
    this._notifications.set([]);
    this.hasNewArrivalBeacon.set(false);
  }

  /**
   * Generador de Prueba Rápida / Simulación de Llegada
   * Permite al usuario u operador escuchar el chime amigable y comprobar la tarjeta en vivo.
   */
  public simulateIncomingReception(): void {
    const randomFolioNum = Math.floor(100 + Math.random() * 900);
    const clients = [
      { client: 'Nestlé México Planta Toluca', carrier: 'Transportes Castores', ramp: 4 },
      { client: 'Heineken / Cervecería Cuauhtémoc', carrier: 'Fletes y Remolques del Norte', ramp: 2 },
      { client: 'Unilever Alimentos', carrier: 'Transportes Monclova S.A.', ramp: 6 },
      { client: 'Procter & Gamble México', carrier: 'Líneas Internacionales Laredo', ramp: 1 }
    ];
    const pick = clients[Math.floor(Math.random() * clients.length)];

    this.notifyNewReception({
      folio: `REC-2026-${randomFolioNum}`,
      client: pick.client,
      carrier: pick.carrier,
      rampNumber: pick.ramp,
      docNumber: `REM-${Math.floor(10000 + Math.random() * 90000)}`,
      driverName: 'Carlos M. Hernández',
      tractorPlates: '99-ZX-4T',
      pieces: 1200
    });
  }
}
