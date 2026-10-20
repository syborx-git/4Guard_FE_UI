/**
 * @file pwa.service.ts
 * @description Servicio enterprise de Progressive Web App (PWA) para 4GUARD Terminal RF.
 * Maneja el ciclo de vida PWA:
 * 1. Detección e instalación mediante beforeinstallprompt (Zebra/Honeywell/Chrome/Edge).
 * 2. Detección de iOS Safari standalone e instrucciones de adición a pantalla de inicio.
 * 3. Gestión segura de actualizaciones (SwUpdate) sin interrumpir escaneos activos de código de barras.
 * 4. Control de Screen WakeLock para evitar suspensión de pantalla durante turnos de almacén.
 * 5. Monitoreo reactivo de conectividad online/offline.
 */

import { Injectable, ApplicationRef, inject, signal, computed, NgZone } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { first, interval, concat, filter } from 'rxjs';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private readonly appRef = inject(ApplicationRef);
  private readonly swUpdate = inject(SwUpdate);
  private readonly ngZone = inject(NgZone);

  // Prompt diferido nativo
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private wakeLockSentinel: any = null;

  // ─── Señales Reactivas de Estado PWA ──────────────────────────────────────
  readonly canInstall = signal<boolean>(false);
  readonly isInstalled = signal<boolean>(false);
  readonly isIos = signal<boolean>(false);
  readonly isIosStandalone = signal<boolean>(false);
  readonly versionReady = signal<boolean>(false);
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly wakeLockActive = signal<boolean>(false);
  readonly scanSessionActive = signal<boolean>(false);

  // Computado de plataforma
  readonly installPromptType = computed<'native' | 'ios' | 'installed' | 'none'>(() => {
    if (this.isInstalled()) return 'installed';
    if (this.canInstall()) return 'native';
    if (this.isIos() && !this.isIosStandalone()) return 'ios';
    return 'none';
  });

  constructor() {
    this.initPlatformDetection();
    this.initInstallPromptListener();
    this.initNetworkListeners();
    this.initSwUpdate();
    this.initWakeLockVisibilityListener();
  }

  /**
   * Inicializa la detección de plataforma y modo de ejecución (standalone vs browser)
   */
  private initPlatformDetection(): void {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    this.isIos.set(isIosDevice);

    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (window.navigator as any).standalone === true;

    this.isInstalled.set(isStandaloneDisplay);
    this.isIosStandalone.set(isIosDevice && (window.navigator as any).standalone === true);

    // Escucha cambios dinámicos de visualización (ej. tras instalación)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isInstalled.set(e.matches);
    });
  }

  /**
   * Captura el evento beforeinstallprompt de navegadores Chromium (Zebra, Honeywell, Edge, Chrome)
   */
  private initInstallPromptListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Evita que el navegador lance el prompt automático por defecto
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isInstalled.set(true);
    });
  }

  /**
   * Monitoreo de conectividad a la red del almacén
   */
  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  /**
   * Inicializa el ciclo de vida de SwUpdate con comprobación cada 5 minutos
   */
  private initSwUpdate(): void {
    if (!this.swUpdate.isEnabled) return;

    // Verificar actualizaciones al estabilizarse la app y cada 5 minutos
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));
    const periodicCheck$ = interval(5 * 60 * 1000);

    concat(appIsStable$, periodicCheck$).subscribe(() => {
      this.swUpdate.checkForUpdate().catch(() => {
        // En modo offline o timeout no arrojar error no controlado
      });
    });

    // Detectar cuando una nueva versión descargada en background esté lista
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.versionReady.set(true);
      });

    // En caso de corrupción irrecuperable
    this.swUpdate.unrecoverable.subscribe(() => {
      window.location.reload();
    });
  }

  /**
   * Re-adquiere WakeLock automáticamente al regresar la ventana a visible
   */
  private initWakeLockVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.wakeLockActive() && !this.wakeLockSentinel) {
        await this.requestWakeLock();
      }
    });
  }

  // ─── Acciones Públicas ────────────────────────────────────────────────────

  /**
   * Dispara el diálogo de instalación nativa PWA en Zebra, Honeywell, Android o Desktop.
   */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) {
      return 'unavailable';
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.canInstall.set(false);

      if (choice.outcome === 'accepted') {
        this.isInstalled.set(true);
      }
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Aplica la actualización disponible recargando la aplicación de forma controlada.
   */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      window.location.reload();
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }

  /**
   * Bloquea el apagado de pantalla mientras el operador realiza tareas de escaneo.
   */
  async requestWakeLock(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockActive.set(true);

      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
        this.wakeLockActive.set(false);
      });
      return true;
    } catch {
      this.wakeLockSentinel = null;
      this.wakeLockActive.set(false);
      return false;
    }
  }

  /**
   * Libera el bloqueo de pantalla al terminar la sesión de escaneo.
   */
  async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // Ignorar
      }
      this.wakeLockSentinel = null;
    }
    this.wakeLockActive.set(false);
  }

  /**
   * Notifica a la terminal si hay una transacción de escaneo en curso para no perturbar
   * al usuario con prompts de actualización.
   */
  setScanSessionActive(active: boolean): void {
    this.scanSessionActive.set(active);
  }
}
