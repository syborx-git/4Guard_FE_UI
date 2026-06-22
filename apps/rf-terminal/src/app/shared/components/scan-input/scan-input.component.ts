/**
 * @file scan-input.component.ts
 * @description Componente de entrada de escaneo industrial para rf-terminal.
 *
 * Características:
 * - Target táctil mínimo de 44x44px (WCAG 2.5.5 + Apple HIG)
 * - Soporte para escáner de código de barras (input keyboard events)
 * - Alto contraste para visibilidad en entorno de almacén
 * - Vibración háptica en escaneo exitoso (si disponible en el dispositivo)
 * - Modo de escaneo continuo (para operaciones de conteo)
 */

import {
  Component, Input, Output, EventEmitter, ViewChild,
  ElementRef, OnInit, OnDestroy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';

export interface ScanResult {
  value: string;
  timestamp: number;
  source: 'scanner' | 'manual';
}

@Component({
  selector: 'fg-rf-scan-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan-input.component.html',
  styleUrl: './scan-input.component.css',
})
export class ScanInputComponent implements OnInit, OnDestroy {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  /** Placeholder del campo de escaneo */
  @Input() placeholder = 'Escanear o ingresar código...';

  /** Etiqueta del campo */
  @Input() label = 'Código';

  /** Habilitar modo de escaneo continuo (no limpia el campo) */
  @Input() continuousScan = false;

  /** Tiempo máximo entre teclas para detectar escaneo automático (ms) */
  @Input() scannerThresholdMs = 100;

  /** Desactivar el componente */
  @Input() disabled = false;

  /** Evento emitido cuando se confirma un escaneo */
  @Output() scanned = new EventEmitter<ScanResult>();

  /** Evento emitido cuando el valor cambia manualmente */
  @Output() valueChange = new EventEmitter<string>();

  protected inputValue = signal('');
  protected isScanning = signal(false);
  protected lastScanTime = 0;
  protected keyBuffer: string[] = [];
  protected keyTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Auto-focus al montar el componente
    setTimeout(() => this.focus(), 150);
  }

  ngOnDestroy(): void {
    if (this.keyTimeout) clearTimeout(this.keyTimeout);
  }

  /** Foca el input programáticamente */
  focus(): void {
    this.inputRef?.nativeElement?.focus();
  }

  /** Limpia el valor del input */
  clear(): void {
    this.inputValue.set('');
    this.focus();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const now = Date.now();
    const timeDiff = now - this.lastScanTime;
    this.lastScanTime = now;

    // Detectar Enter como confirmación de escaneo
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmScan();
      return;
    }

    // Si las teclas vienen muy rápido (< threshold), es un escáner
    if (timeDiff < this.scannerThresholdMs && event.key.length === 1) {
      this.isScanning.set(true);
    } else {
      this.isScanning.set(false);
    }
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.inputValue.set(value);
    this.valueChange.emit(value);
  }

  private confirmScan(): void {
    const value = this.inputValue().trim();
    if (!value) return;

    const result: ScanResult = {
      value,
      timestamp: Date.now(),
      source: this.isScanning() ? 'scanner' : 'manual',
    };

    this.scanned.emit(result);

    // Vibración háptica si disponible
    if ('vibrate' in navigator) {
      navigator.vibrate(result.source === 'scanner' ? [50] : [30, 30, 30]);
    }

    if (!this.continuousScan) {
      this.clear();
    }

    this.isScanning.set(false);
  }
}
