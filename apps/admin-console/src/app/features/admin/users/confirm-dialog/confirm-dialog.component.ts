/**
 * @file confirm-dialog.component.ts
 * @description Diálogo de confirmación genérico y reutilizable — 4GUARD WMS.
 *
 * Inputs:
 *   - title: string     — Título del diálogo
 *   - message: string   — Mensaje de confirmación
 *   - confirmLabel: string — Texto del botón de acción (default: "Confirmar")
 *   - isLoading: boolean — Estado de carga mientras el backend responde
 *
 * Outputs:
 *   - confirmed: void   — El usuario confirmó la acción
 *   - cancelled: void   — El usuario canceló
 *
 * Cierra con ESC o click en Cancelar.
 * NO cierra con click fuera (requiere acción explícita del usuario).
 */

import {
  Component,
  input,
  output,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'fg-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  readonly title        = input.required<string>();
  readonly message      = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly isLoading    = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    if (!this.isLoading()) {
      this.cancelled.emit();
    }
  }

  protected onConfirm(): void {
    if (!this.isLoading()) {
      this.confirmed.emit();
    }
  }

  protected onCancel(): void {
    if (!this.isLoading()) {
      this.cancelled.emit();
    }
  }
}
