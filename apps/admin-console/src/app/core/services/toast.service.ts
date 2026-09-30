/**
 * @file toast.service.ts
 * @description Servicio de notificaciones Toast para 4GUARD WMS (Admin Console).
 * Soporta severidades (success, error, warning, info), duraciones configurables,
 * auto-dismiss y sonido de alto volumen (.mpeg en assets/sounds/notification.mpeg con booster y fallback Web Audio API).
 */

import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  /** Lista reactiva de toasts activos — consumida por ToastContainerComponent */
  readonly toasts = signal<Toast[]>([]);

  /** Estado del sonido */
  readonly isMuted = signal<boolean>(false);

  /** AudioContext reutilizable */
  private audioCtx: AudioContext | null = null;
  private cachedBuffer: AudioBuffer | null = null;

  constructor() {
    this.initAudioUnlock();
  }

  /**
   * Muestra un toast de éxito (verde).
   */
  success(message: string, duration = 3000): void {
    this.show('success', message, duration);
    this.playSound('success');
  }

  /**
   * Muestra un toast de error (rojo).
   */
  error(message: string, duration = 3000): void {
    this.show('error', message, duration);
    this.playSound('error');
  }

  /**
   * Muestra un toast de advertencia (amarillo).
   */
  warning(message: string, duration = 3000): void {
    this.show('warning', message, duration);
    this.playSound('warning');
  }

  /**
   * Muestra un toast informativo (azul).
   */
  info(message: string, duration = 3000): void {
    this.show('info', message, duration);
    this.playSound('info');
  }

  /**
   * Descarta manualmente un toast por su ID.
   */
  dismiss(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  /**
   * Permite silenciar o habilitar sonidos.
   */
  setMuted(muted: boolean): void {
    this.isMuted.set(muted);
  }

  // ── Privado ──────────────────────────────────────────────

  private show(type: ToastType, message: string, duration: number): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, type, message, duration };

    this.toasts.update(list => [...list, toast]);

    // Auto-dismiss tras duration ms
    setTimeout(() => this.dismiss(id), duration);
  }

  /**
   * Reproduce el archivo .mpeg asignado con amplificación de volumen (Booster).
   */
  private async playSound(type: ToastType): Promise<void> {
    if (this.isMuted()) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        if (!this.cachedBuffer) {
          const resp = await fetch('/assets/sounds/notification.mpeg');
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            this.cachedBuffer = await ctx.decodeAudioData(arr);
          }
        }

        if (this.cachedBuffer) {
          const source = ctx.createBufferSource();
          source.buffer = this.cachedBuffer;

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(1.6, ctx.currentTime); // +60% amplificación

          const comp = ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-12, ctx.currentTime);
          comp.ratio.setValueAtTime(4, ctx.currentTime);

          source.connect(gain);
          gain.connect(comp);
          comp.connect(ctx.destination);

          source.start(0);
          return;
        }
      } catch {}
    }

    try {
      const audio = new Audio('/assets/sounds/notification.mpeg');
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          this.playSynthesizedTone(type);
        });
      }
    } catch {
      this.playSynthesizedTone(type);
    }
  }

  private playSynthesizedTone(type: ToastType): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = type === 'success' ? 880 : type === 'error' ? 220 : type === 'warning' ? 550 : 660;
      osc.type = type === 'error' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private initAudioUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }
}
