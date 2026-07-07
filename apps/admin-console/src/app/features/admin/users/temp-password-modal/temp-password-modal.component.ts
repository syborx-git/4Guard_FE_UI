/**
 * @file temp-password-modal.component.ts
 * @description Modal Premium — Contraseña Temporal Generada (HU-003).
 *
 * Se muestra cuando el backend responde 200 con la contraseña temporal.
 * Permite copiar la contraseña al portapapeles.
 * Cierra con ESC o click fuera del card.
 *
 * Inputs:
 *   - password: string  — La contraseña temporal devuelta por el backend
 *   - userName: string  — Nombre del usuario para contexto
 *
 * Outputs:
 *   - closed: void      — Emitido al cerrar el modal
 */

import {
  Component,
  input,
  output,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'fg-temp-password-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './temp-password-modal.component.html',
  styleUrl: './temp-password-modal.component.css',
})
export class TempPasswordModalComponent {
  /** Contraseña temporal devuelta por el backend */
  readonly password = input.required<string>();

  /** Nombre del usuario destinatario */
  readonly userName = input.required<string>();

  /** Emitido al cerrar el modal */
  readonly closed = output<void>();

  /** Estado de feedback al copiar */
  protected readonly copied = signal(false);

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('tp-backdrop')) {
      this.close();
    }
  }

  protected close(): void {
    this.closed.emit();
    // Reset copied state para próxima apertura
    setTimeout(() => this.copied.set(false), 300);
  }

  /**
   * Copia la contraseña temporal al portapapeles del sistema.
   * Muestra confirmación por 2 segundos.
   */
  protected async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Fallback para entornos sin Clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = this.password();
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }
}
