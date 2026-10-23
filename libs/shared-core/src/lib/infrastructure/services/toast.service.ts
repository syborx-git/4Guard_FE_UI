/**
 * @file toast.service.ts
 * @description Servicio global y reactivo de notificaciones Toast para 4GUARD WMS (Admin Console & Terminal RF).
 * Soporta severidades (success, error, warning, info), títulos, duraciones configurables, auto-dismiss,
 * retroalimentación háptica en tabletas industriales y reproducción de sonido de alto volumen (High-Gain Booster
 * con soporte para archivos .mpeg/.mp3 y fallback por Web Audio API).
 */

import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
  createdAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  /** Lista reactiva de notificaciones activas */
  readonly toasts = signal<ToastItem[]>([]);

  /** Estado del sonido (muteado o activo) */
  readonly isMuted = signal<boolean>(false);

  /** Volumen general (0.0 a 1.0) — Por defecto al máximo 1.0 */
  readonly volume = signal<number>(1.0);

  /** Factor de amplificación adicional (Booster para ambientes ruidosos de almacén) */
  private readonly gainBoost = 1.6;

  /** Ruta base del archivo de sonido (por defecto notification.mpeg en assets/sounds) */
  private customSoundUrl: string = '/assets/sounds/notification.mpeg';

  /** AudioContext reutilizable para síntesis y boost de ganancia */
  private audioCtx: AudioContext | null = null;

  /** Buffer de audio pre-cargado para reproducción instantánea y amplificada */
  private cachedAudioBuffer: AudioBuffer | null = null;
  private isPreloading = false;

  constructor() {
    this.initAudioUnlock();
    this.preloadAudioBuffer();
  }

  /**
   * Muestra un toast de éxito (verde esmeralda) con sonido potente y vibración.
   */
  success(message: string, title?: string, duration = 3500): void {
    this.show('success', message, title, duration);
    this.triggerHaptic([60]);
    this.playSound('success');
  }

  /**
   * Muestra un toast de error (rojo / colisión / fallo) con sonido potente y vibración.
   */
  error(message: string, title?: string, duration = 4500): void {
    this.show('error', message, title, duration);
    this.triggerHaptic([180, 100, 220]);
    this.playSound('error');
  }

  /**
   * Muestra un toast de advertencia (ámbar / alerta operativa) con sonido potente y vibración.
   */
  warning(message: string, title?: string, duration = 4000): void {
    this.show('warning', message, title, duration);
    this.triggerHaptic([120, 80, 120]);
    this.playSound('warning');
  }

  /**
   * Muestra un toast informativo (azul / bienvenida / transacción) con sonido potente y vibración.
   */
  info(message: string, title?: string, duration = 3500): void {
    this.show('info', message, title, duration);
    this.triggerHaptic([60]);
    this.playSound('info');
  }

  /**
   * Cierra manualmente un toast específico.
   */
  dismiss(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  /**
   * Limpia todas las notificaciones activas.
   */
  clearAll(): void {
    this.toasts.set([]);
  }

  /**
   * Permite silenciar o habilitar los sonidos.
   */
  setMuted(muted: boolean): void {
    this.isMuted.set(muted);
  }

  /**
   * Permite cambiar el volumen (0.0 a 1.0).
   */
  setVolume(vol: number): void {
    this.volume.set(Math.max(0, Math.min(1, vol)));
  }

  /**
   * Permite especificar una ruta personalizada para el archivo de sonido (.mpeg, .mp3, etc.)
   */
  setCustomSoundUrl(url: string): void {
    this.customSoundUrl = url;
    this.cachedAudioBuffer = null;
    this.preloadAudioBuffer();
  }

  // ─── Métodos Privados ─────────────────────────────────────────────────────

  private show(type: ToastType, message: string, title?: string, duration = 3500): void {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = {
      id,
      type,
      title,
      message,
      duration,
      createdAt: Date.now(),
    };

    // Agregar a la lista y limitar a máx 4 toasts simultáneos
    this.toasts.update(list => [newToast, ...list.slice(0, 3)]);

    // Auto-descarte
    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  /**
   * Pre-carga y decodifica el archivo .mpeg en memoria para reproducción con Ganancia Amplificada (+60%)
   */
  private async preloadAudioBuffer(): Promise<void> {
    if (typeof window === 'undefined' || this.isPreloading || this.cachedAudioBuffer) return;
    this.isPreloading = true;

    try {
      const soundPath = this.customSoundUrl || '/assets/sounds/notification.mpeg';
      const response = await fetch(soundPath);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const ctx = this.getAudioContext();
        if (ctx) {
          this.cachedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
        }
      }
    } catch {
      // Fallback a reproducción estándar si falla la precarga
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Reproduce el archivo .mpeg asignado con amplificación de volumen (High-Gain Booster).
   */
  private playSound(type: ToastType): void {
    if (this.isMuted()) return;

    const ctx = this.getAudioContext();
    const soundPath = this.customSoundUrl || '/assets/sounds/notification.mpeg';

    // 1. Si tenemos el buffer decodificado y AudioContext activo, reproducir con Booster + Compresor dinámico
    if (ctx && this.cachedAudioBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = this.cachedAudioBuffer;

        const gainNode = ctx.createGain();
        // Amplificación: volumen base (1.0) * factor booster (1.6)
        gainNode.gain.setValueAtTime(this.volume() * this.gainBoost, ctx.currentTime);

        // Compresor para evitar saturación o distorsión armónica
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, ctx.currentTime);
        compressor.knee.setValueAtTime(10, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(ctx.destination);

        source.start(0);
        return;
      } catch {
        // En caso de fallo con buffer source, continuar a intento directo
      }
    }

    // 2. Intento de reproducción directa con HTMLAudioElement a volumen máximo 1.0
    try {
      const audio = new Audio(soundPath);
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // 3. Fallback armónico sintetizado con volumen elevado
          this.playSynthesizedFallback(type);
        });
      }
    } catch {
      this.playSynthesizedFallback(type);
    }
  }

  /**
   * Sintetizador sonoro de alta fidelidad y mayor potencia sonora vía Web Audio API (Fallback)
   */
  private playSynthesizedFallback(type: ToastType): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const vol = this.volume() * 0.75; // Ganancia fuerte de sintetizador

      if (type === 'success') {
        // Doble campana armónica potente (Sol5 -> Do6)
        this.emitTone(ctx, 784, now, 0.12, vol);
        this.emitTone(ctx, 1046.5, now + 0.09, 0.18, vol * 1.1);
      } else if (type === 'error') {
        // Tono grave potente de alerta
        this.emitTone(ctx, 280, now, 0.18, vol * 1.3, 'sawtooth');
        this.emitTone(ctx, 190, now + 0.14, 0.28, vol * 1.3, 'sawtooth');
      } else if (type === 'warning') {
        // Alerta triangular doble
        this.emitTone(ctx, 650, now, 0.12, vol * 1.1, 'triangle');
        this.emitTone(ctx, 650, now + 0.16, 0.15, vol * 1.1, 'triangle');
      } else {
        // Info: Campana industrial clara (La5)
        this.emitTone(ctx, 880, now, 0.2, vol, 'sine');
      }
    } catch {}
  }

  private emitTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    maxGain: number,
    type: OscillatorType = 'sine'
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(maxGain, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
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

  /**
   * Desbloquea el AudioContext en el primer toque/click del usuario para cumplir la directiva Autoplay de navegadores
   */
  private initAudioUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.preloadAudioBuffer();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  private triggerHaptic(pattern: number[]): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }
}
