/**
 * @file audio-feedback.service.ts
 * @description Servicio de retroalimentación auditiva y háptica de alto volumen para la Terminal RF.
 * Emite bips agudos para confirmaciones correctas, buzzers graves para errores de escaneo,
 * y reproduce archivos .mpeg/.mp3 con amplificación de ganancia para entornos ruidosos de almacén.
 */

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioFeedbackService {
  private audioCtx: AudioContext | null = null;
  private cachedBuffer: AudioBuffer | null = null;

  constructor() {
    this.initAudioUnlock();
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
   * Reproduce un archivo de audio personalizado con amplificación de ganancia (+60% de volumen).
   */
  async playAudioFile(filename = 'notification.mpeg', volume = 1.0, onFallback?: () => void): Promise<void> {
    const audioPath = filename.startsWith('/') || filename.startsWith('assets/')
      ? filename
      : `/assets/sounds/${filename}`;

    const ctx = this.getAudioContext();

    // Si AudioContext está disponible, intentamos reproducción con GainNode amplificado
    if (ctx) {
      try {
        if (!this.cachedBuffer) {
          const resp = await fetch(audioPath);
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            this.cachedBuffer = await ctx.decodeAudioData(arr);
          }
        }

        if (this.cachedBuffer) {
          const source = ctx.createBufferSource();
          source.buffer = this.cachedBuffer;

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(volume * 1.6, ctx.currentTime);

          const comp = ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-12, ctx.currentTime);
          comp.ratio.setValueAtTime(4, ctx.currentTime);

          source.connect(gain);
          gain.connect(comp);
          comp.connect(ctx.destination);

          source.start(0);
          return;
        }
      } catch {
        // Continuar al intento con HTMLAudioElement
      }
    }

    try {
      const audio = new Audio(audioPath);
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (onFallback) {
            onFallback();
          } else {
            this.playSuccess();
          }
        });
      }
    } catch {
      if (onFallback) {
        onFallback();
      } else {
        this.playSuccess();
      }
    }
  }

  /**
   * Sonido de Notificación General de Alto Volumen
   */
  playNotification(): void {
    this.vibrate([60]);
    this.playAudioFile('notification.mpeg', 1.0, () => {
      this.playSuccess();
    });
  }

  /**
   * Bip de Éxito / Escaneo Láser Validado: Tono senoidal agudo de 880 Hz (150 ms) + Vibración háptica de 50 ms.
   */
  playSuccess(): void {
    this.vibrate([50]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // La (A5)

      gain.gain.setValueAtTime(0.7, ctx.currentTime); // Ganancia aumentada
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } catch {}
  }

  /**
   * Buzzer de Error Fuerte: Tono grave cuadrado de 220 Hz a 160 Hz (400 ms) + Doble vibración.
   */
  playError(): void {
    this.vibrate([100, 50, 100]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.85, ctx.currentTime); // Ganancia aumentada
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  /**
   * Alerta de Warning / Zone Lease a punto de expirar: Tres bips cortos de 580 Hz + vibración de 150 ms.
   */
  playWarning(): void {
    this.vibrate([150, 100, 150]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.15, 0.3].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now + delay);

        gain.gain.setValueAtTime(0.75, now + delay); // Ganancia aumentada
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    } catch {}
  }

  private vibrate(pattern: number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
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
