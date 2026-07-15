/**
 * @file toast.service.ts
 * @description Servicio de notificaciones Toast para 4GUARD WMS.
 *
 * Reemplaza todos los usos de alert() del navegador con toasts discretos.
 * Cada toast tiene:
 *   - Tipo: success | error | warning | info
 *   - Mensaje
 *   - Duración configurable (default 4000ms)
 *   - Auto-dismiss
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

  /**
   * Muestra un toast de éxito (verde).
   */
  success(message: string, duration = 3000): void {
    this.show('success', message, duration);
  }

  /**
   * Muestra un toast de error (rojo).
   */
  error(message: string, duration = 3000): void {
    this.show('error', message, duration);
  }

  /**
   * Muestra un toast de advertencia (amarillo).
   */
  warning(message: string, duration = 3000): void {
    this.show('warning', message, duration);
  }

  /**
   * Muestra un toast informativo (azul).
   */
  info(message: string, duration = 3000): void {
    this.show('info', message, duration);
  }

  /**
   * Descarta manualmente un toast por su ID.
   */
  dismiss(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  // ── Privado ──────────────────────────────────────────────
  private show(type: ToastType, message: string, duration: number): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, type, message, duration };

    this.toasts.update(list => [...list, toast]);

    // Auto-dismiss tras duration ms
    setTimeout(() => this.dismiss(id), duration);
  }
}
