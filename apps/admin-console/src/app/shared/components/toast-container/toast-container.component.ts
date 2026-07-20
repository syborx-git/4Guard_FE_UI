/**
 * @file toast-container.component.ts
 * @description Contenedor global de notificaciones Toast.
 * Estilo Liquid Glass, posición superior derecha y auto-dismiss.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'fg-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-container"
      aria-live="polite"
      aria-relevant="additions removals"
      aria-label="Notificaciones del sistema">

      @for (toast of toastService.toasts(); track toast.id) {
        <article
          class="toast"
          [class]="'toast toast--' + toast.type"
          role="status"
          [attr.aria-label]="toast.message"
          [style.--toast-duration]="toast.duration + 'ms'">

          <div class="toast__accent" aria-hidden="true"></div>

          <div class="toast__icon-wrap" aria-hidden="true">
            @switch (toast.type) {
              @case ('success') {
                <span class="material-symbols-outlined toast__icon">
                  check_circle
                </span>
              }

              @case ('error') {
                <span class="material-symbols-outlined toast__icon">
                  error
                </span>
              }

              @case ('warning') {
                <span class="material-symbols-outlined toast__icon">
                  warning
                </span>
              }

              @case ('info') {
                <span class="material-symbols-outlined toast__icon">
                  info
                </span>
              }
            }
          </div>

          <div class="toast__content">
            <span class="toast__eyebrow">
              @switch (toast.type) {
                @case ('success') { Operación completada }
                @case ('error') { Se produjo un error }
                @case ('warning') { Atención requerida }
                @case ('info') { Información del sistema }
              }
            </span>

            <p class="toast__message">
              {{ toast.message }}
            </p>
          </div>

          <button
            type="button"
            class="toast__close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar notificación">

            <span class="material-symbols-outlined">
              close
            </span>
          </button>

          <div class="toast__progress" aria-hidden="true">
            <span class="toast__progress-fill"></span>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    :host {
      position: relative;
      z-index: 99999;
    }

    .toast-container {
      position: fixed;
      top: 5.25rem;
      right: 1.35rem;
      z-index: 99999;

      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;

      width: min(390px, calc(100vw - 2rem));

      pointer-events: none;
    }

    .toast {
      --toast-accent: var(--info, #42a5f5);
      --toast-accent-bg: var(--info-bg, rgba(66, 165, 245, 0.12));
      --toast-duration: 3000ms;

      position: relative;
      isolation: isolate;
      overflow: hidden;

      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.8rem;

      width: 100%;
      min-height: 78px;
      padding: 0.9rem 0.95rem 1rem;

      color: var(--text-primary, #20242d);

      background:
        linear-gradient(
          145deg,
          rgba(255, 255, 255, 0.76),
          rgba(255, 255, 255, 0.52)
        );

      border: 1px solid rgba(255, 255, 255, 0.74);
      border-radius: 18px;

      box-shadow:
        0 24px 60px rgba(22, 32, 52, 0.18),
        0 8px 22px rgba(22, 32, 52, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.92);

      backdrop-filter:
        blur(26px)
        saturate(180%);

      -webkit-backdrop-filter:
        blur(26px)
        saturate(180%);

      pointer-events: auto;

      font-family:
        'DM Sans',
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        sans-serif;

      animation:
        toast-enter
        280ms
        cubic-bezier(0.22, 1, 0.36, 1)
        both;
    }

    .toast::before {
      position: absolute;
      inset: 0;
      z-index: -1;

      pointer-events: none;
      content: '';

      background:
        linear-gradient(
          125deg,
          rgba(255, 255, 255, 0.58),
          transparent 35%,
          rgba(255, 255, 255, 0.06) 72%,
          transparent
        );

      opacity: 0.72;
    }

    .toast::after {
      position: absolute;
      top: -85px;
      right: -70px;
      z-index: -1;

      width: 190px;
      height: 190px;

      pointer-events: none;
      content: '';
      border-radius: 50%;

      background:
        radial-gradient(
          circle,
          color-mix(
            in srgb,
            var(--toast-accent) 16%,
            transparent
          ),
          transparent 68%
        );

      filter: blur(8px);
    }

    .toast--success {
      --toast-accent: var(--success, #4caf50);
      --toast-accent-bg: var(--success-bg, rgba(76, 175, 80, 0.12));
    }

    .toast--error {
      --toast-accent: var(--danger, #ef5350);
      --toast-accent-bg: var(--danger-bg, rgba(239, 83, 80, 0.12));
    }

    .toast--warning {
      --toast-accent: var(--warning, #ffa726);
      --toast-accent-bg: var(--warning-bg, rgba(255, 167, 38, 0.12));
    }

    .toast--info {
      --toast-accent: var(--info, #42a5f5);
      --toast-accent-bg: var(--info-bg, rgba(66, 165, 245, 0.12));
    }

    .toast__accent {
      position: absolute;
      top: 0.75rem;
      bottom: 0.75rem;
      left: 0;

      width: 3px;

      background:
        linear-gradient(
          180deg,
          transparent,
          var(--toast-accent),
          transparent
        );

      border-radius: 0 999px 999px 0;

      box-shadow:
        0 0 14px
        color-mix(
          in srgb,
          var(--toast-accent) 35%,
          transparent
        );
    }

    .toast__icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      width: 38px;
      height: 38px;
      flex: 0 0 38px;

      color: var(--toast-accent);
      background: var(--toast-accent-bg);

      border:
        1px solid
        color-mix(
          in srgb,
          var(--toast-accent) 22%,
          transparent
        );

      border-radius: 12px;

      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.54),
        0 8px 18px
        color-mix(
          in srgb,
          var(--toast-accent) 10%,
          transparent
        );

      animation:
        toast-icon-enter
        420ms
        cubic-bezier(0.34, 1.56, 0.64, 1)
        both;
    }

    .toast__icon {
      color: inherit;
      font-size: 20px !important;

      font-variation-settings:
        'FILL' 1,
        'wght' 400,
        'GRAD' 0,
        'opsz' 20;
    }

    .toast__content {
      min-width: 0;
      padding-right: 0.15rem;
    }

    .toast__eyebrow {
      display: block;
      margin-bottom: 0.18rem;

      color: var(--toast-accent);

      font-family: 'JetBrains Mono', monospace;
      font-size: 0.54rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .toast__message {
      margin: 0;

      color: var(--text-primary, #20242d);

      font-size: 0.78rem;
      font-weight: 520;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .toast__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      width: 30px;
      height: 30px;

      padding: 0;

      color: var(--text-tertiary, #777d87);
      background: transparent;

      border: 1px solid transparent;
      border-radius: 9px;

      cursor: pointer;
      opacity: 0.65;

      transition:
        opacity 150ms ease,
        color 150ms ease,
        background 150ms ease,
        border-color 150ms ease,
        transform 150ms ease;
    }

    .toast__close:hover {
      color: var(--text-primary, #20242d);
      background: rgba(255, 255, 255, 0.42);
      border-color: rgba(31, 41, 55, 0.08);
      opacity: 1;
      transform: rotate(3deg);
    }

    .toast__close:active {
      transform: scale(0.92);
    }

    .toast__close .material-symbols-outlined {
      font-size: 17px !important;
    }

    .toast__progress {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;

      height: 3px;

      overflow: hidden;

      background:
        color-mix(
          in srgb,
          var(--toast-accent) 10%,
          transparent
        );
    }

    .toast__progress-fill {
      display: block;
      width: 100%;
      height: 100%;

      background:
        linear-gradient(
          90deg,
          color-mix(
            in srgb,
            var(--toast-accent) 72%,
            white
          ),
          var(--toast-accent)
        );

      box-shadow:
        0 0 10px
        color-mix(
          in srgb,
          var(--toast-accent) 30%,
          transparent
        );

      transform-origin: left center;

      animation:
        toast-progress
        var(--toast-duration)
        linear
        forwards;
    }

    :host-context(.theme-dark) .toast {
      color: var(--text-primary);

      background:
        linear-gradient(
          145deg,
          rgba(27, 32, 42, 0.82),
          rgba(17, 22, 31, 0.62)
        );

      border-color: rgba(255, 255, 255, 0.11);

      box-shadow:
        0 28px 72px rgba(0, 0, 0, 0.48),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);

      backdrop-filter:
        blur(28px)
        saturate(155%);

      -webkit-backdrop-filter:
        blur(28px)
        saturate(155%);
    }

    :host-context(.theme-dark) .toast::before {
      background:
        linear-gradient(
          125deg,
          rgba(255, 255, 255, 0.08),
          transparent 38%,
          rgba(255, 255, 255, 0.025) 72%,
          transparent
        );
    }

    :host-context(.theme-dark) .toast__message {
      color: var(--text-primary);
    }

    :host-context(.theme-dark) .toast__close {
      color: var(--text-tertiary);
    }

    :host-context(.theme-dark) .toast__close:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.08);
    }

    @keyframes toast-enter {
      from {
        opacity: 0;
        transform:
          translateX(34px)
          translateY(-8px)
          scale(0.95);
        filter: blur(5px);
      }

      to {
        opacity: 1;
        transform:
          translateX(0)
          translateY(0)
          scale(1);
        filter: blur(0);
      }
    }

    @keyframes toast-icon-enter {
      from {
        opacity: 0;
        transform: scale(0.62) rotate(-10deg);
      }

      to {
        opacity: 1;
        transform: scale(1) rotate(0);
      }
    }

    @keyframes toast-progress {
      from {
        transform: scaleX(1);
      }

      to {
        transform: scaleX(0);
      }
    }

    @media (max-width: 640px) {
      .toast-container {
        top: 4.75rem;
        right: 1rem;
        left: 1rem;

        align-items: stretch;
        width: auto;
      }

      .toast {
        min-height: 72px;
        padding: 0.8rem 0.85rem 0.95rem;
        border-radius: 16px;
      }

      .toast__icon-wrap {
        width: 35px;
        height: 35px;
        flex-basis: 35px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast,
      .toast__icon-wrap,
      .toast__progress-fill,
      .toast__close {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
