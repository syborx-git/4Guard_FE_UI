/**
 * @file forbot-voice.service.ts
 * @description Servicio Singleton de Reconocimiento de Voz (Speech-to-Text) para ForBot (4GUARD AI).
 * Utiliza Web Speech API nativa del navegador (webkitSpeechRecognition / SpeechRecognition),
 * permitiendo a operarios en andén y montacarguistas hablarle al asistente sin tocar la pantalla.
 */

import { Injectable, signal, NgZone, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ForbotVoiceService {
  private readonly ngZone = inject(NgZone);

  public readonly isListening = signal<boolean>(false);
  public readonly isSupported = signal<boolean>(false);
  public readonly transcript = signal<string>('');
  public readonly lastError = signal<string | null>(null);

  private recognition: any = null;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.isSupported.set(true);
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-MX'; // Español México
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.ngZone.run(() => {
          this.isListening.set(true);
          this.lastError.set(null);
        });
      };

      this.recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          this.transcript.set(currentTranscript);
        });
      };

      this.recognition.onerror = (event: any) => {
        this.ngZone.run(() => {
          this.isListening.set(false);
          this.lastError.set(event.error || 'Error al capturar voz');
        });
      };

      this.recognition.onend = () => {
        this.ngZone.run(() => {
          this.isListening.set(false);
        });
      };
    } else {
      this.isSupported.set(false);
    }
  }

  /**
   * Inicia la escucha por micrófono.
   * Ejecuta el callback onResult al finalizar el dictado.
   */
  public startListening(onResult?: (finalText: string) => void): void {
    if (!this.recognition || this.isListening()) return;

    this.transcript.set('');
    this.lastError.set(null);

    if (onResult) {
      this.recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let currentTranscript = '';
          let isFinal = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinal = true;
            }
          }
          this.transcript.set(currentTranscript);
          if (isFinal && currentTranscript.trim()) {
            onResult(currentTranscript.trim());
          }
        });
      };
    }

    try {
      this.recognition.start();
    } catch (err: any) {
      this.lastError.set(err?.message || 'No se pudo iniciar el micrófono');
      this.isListening.set(false);
    }
  }

  /** Detiene la escucha de voz manualmente */
  public stopListening(): void {
    if (this.recognition && this.isListening()) {
      try {
        this.recognition.stop();
      } catch {
        // Ignorar si ya estaba deteniéndose
      }
      this.isListening.set(false);
    }
  }

  /** Alterna entre iniciar y detener la escucha */
  public toggleListening(onResult?: (finalText: string) => void): void {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening(onResult);
    }
  }
}
