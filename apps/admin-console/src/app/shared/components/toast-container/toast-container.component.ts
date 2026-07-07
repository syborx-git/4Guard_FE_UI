/**
 * @file toast-container.component.ts
 * @description Componente contenedor de Toasts — renderizado a nivel de AppComponent.
 *
 * Se ubica en la esquina inferior derecha de la pantalla.
 * Consume el signal reactivo del ToastService.
 * Cada toast tiene animación de entrada y auto-dismiss.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'fg-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-label="Notificaciones">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast toast--' + toast.type"
          role="alert"
          [attr.aria-label]="toast.message">

          <div class="toast__icon-wrap">
            @switch (toast.type) {
              @case ('success') {
                <span class="material-symbols-outlined toast__icon">check_circle</span>
              }
              @case ('error') {
                <span class="material-symbols-outlined toast__icon">error</span>
              }
              @case ('warning') {
                <span class="material-symbols-outlined toast__icon">warning</span>
              }
              @case ('info') {
                <span class="material-symbols-outlined toast__icon">info</span>
              }
            }
          </div>

          <span class="toast__message">{{ toast.message }}</span>

          <button
            class="toast__close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar notificación">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      min-width: 280px;
      max-width: 420px;
      pointer-events: all;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border: 1px solid transparent;
      animation: toastSlideIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
      font-family: 'DM Sans', sans-serif;
    }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(24px) scale(0.96); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }

    .toast--success {
      background: rgba(232, 245, 233, 0.98);
      border-color: rgba(76, 175, 80, 0.3);
      color: #1B5E20;
    }

    .toast--error {
      background: rgba(255, 235, 238, 0.98);
      border-color: rgba(211, 47, 47, 0.3);
      color: #B71C1C;
    }

    .toast--warning {
      background: rgba(255, 248, 225, 0.98);
      border-color: rgba(245, 124, 0, 0.3);
      color: #E65100;
    }

    .toast--info {
      background: rgba(227, 242, 253, 0.98);
      border-color: rgba(30, 136, 229, 0.3);
      color: #0D47A1;
    }

    .toast__icon-wrap {
      flex-shrink: 0;
    }

    .toast__icon {
      font-size: 18px !important;
      font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
    }

    .toast--success .toast__icon { color: #4CAF50; }
    .toast--error   .toast__icon { color: #EF5350; }
    .toast--warning .toast__icon { color: #FFA726; }
    .toast--info    .toast__icon { color: #42A5F5; }

    .toast__message {
      flex: 1;
      font-size: 0.83rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .toast__close {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.1rem;
      color: inherit;
      opacity: 0.5;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      transition: opacity 150ms ease;
      border-radius: 4px;
    }

    .toast__close:hover { opacity: 1; }

    .toast__close .material-symbols-outlined {
      font-size: 16px !important;
    }
  `]
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
