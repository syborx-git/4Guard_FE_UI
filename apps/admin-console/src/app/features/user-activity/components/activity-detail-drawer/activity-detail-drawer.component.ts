/**
 * @file activity-detail-drawer.component.ts
 * @description Drawer lateral de detalle de evento — HU-146.
 *
 * Muestra las 4 secciones del evento seleccionado:
 *  A. Información general
 *  B. Acción ejecutada
 *  C. Cambios realizados (Antes / Después)
 *  D. Información técnica (colapsable)
 *
 * Accesibilidad:
 *  - Cierre con tecla Escape
 *  - Focus visible
 *  - aria-label en botones de icono
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { UserActivityEvent, ActivityResult, ActivitySeverity } from '../../user-activity.models';

@Component({
  selector: 'fg-activity-detail-drawer',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event) {
      <!-- Backdrop -->
      <div
        class="ua-drawer-backdrop"
        role="presentation"
        (click)="close.emit()"
        aria-hidden="true">
      </div>

      <!-- Drawer Panel -->
      <aside
        class="ua-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title">

        <!-- Header -->
        <div class="ua-drawer__header">
          <div class="ua-drawer__header-left">
            <div class="ua-drawer__icon-wrap">
              <span class="material-symbols-outlined">manage_search</span>
            </div>
            <div>
              <span class="ua-drawer__eyebrow">DETALLE DE ACTIVIDAD</span>
              <h2 id="drawer-title" class="ua-drawer__title">{{ event.action }}</h2>
            </div>
          </div>
          <button
            class="ua-drawer__close"
            (click)="close.emit()"
            aria-label="Cerrar detalle de actividad">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Badges de resultado y criticidad -->
        <div class="ua-drawer__badges">
          <span class="ua-badge ua-badge--result" [class]="'ua-badge--' + event.result.toLowerCase()">
            <span class="material-symbols-outlined ua-badge__icon">{{ resultIcon(event.result) }}</span>
            {{ event.result }}
          </span>
          <span class="ua-badge ua-badge--severity" [class]="'ua-badge--sev-' + event.severity.toLowerCase()">
            {{ event.severity }}
          </span>
          @if (event.outsideShift) {
            <span class="ua-badge ua-badge--outside">
              <span class="material-symbols-outlined ua-badge__icon">dark_mode</span>
              Fuera de horario
            </span>
          }
        </div>

        <!-- Contenido scrollable -->
        <div class="ua-drawer__body">

          <!-- A. Información general -->
          <section class="ua-drawer__section">
            <h3 class="ua-drawer__section-title">
              <span class="material-symbols-outlined">person</span>
              Información general
            </h3>
            <div class="ua-drawer__grid">
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Usuario</span>
                <span class="ua-drawer__value">{{ event.userName }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Correo</span>
                <span class="ua-drawer__value">{{ event.userEmail }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Rol</span>
                <span class="ua-drawer__value ua-drawer__value--mono">{{ event.userRole }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Fecha y hora</span>
                <span class="ua-drawer__value">{{ event.occurredAt | date:'dd/MM/yyyy, HH:mm:ss' }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Almacén</span>
                <span class="ua-drawer__value">{{ event.warehouseName }}</span>
              </div>
              @if (event.clientName) {
                <div class="ua-drawer__field">
                  <span class="ua-drawer__label">Cliente</span>
                  <span class="ua-drawer__value">{{ event.clientName }}</span>
                </div>
              }
              @if (event.shiftName) {
                <div class="ua-drawer__field">
                  <span class="ua-drawer__label">Turno</span>
                  <span class="ua-drawer__value">{{ event.shiftName }}</span>
                </div>
              }
              @if (event.sessionId) {
                <div class="ua-drawer__field">
                  <span class="ua-drawer__label">Sesión</span>
                  <span class="ua-drawer__value ua-drawer__value--mono">{{ event.sessionId }}</span>
                </div>
              }
            </div>
          </section>

          <!-- B. Acción -->
          <section class="ua-drawer__section">
            <h3 class="ua-drawer__section-title">
              <span class="material-symbols-outlined">bolt</span>
              Acción ejecutada
            </h3>
            <div class="ua-drawer__grid">
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Módulo</span>
                <span class="ua-drawer__value">{{ event.module }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Acción</span>
                <span class="ua-drawer__value ua-drawer__value--mono">{{ event.action }}</span>
              </div>
              <div class="ua-drawer__field ua-drawer__field--full">
                <span class="ua-drawer__label">Descripción</span>
                <span class="ua-drawer__value">{{ event.description }}</span>
              </div>
              <div class="ua-drawer__field">
                <span class="ua-drawer__label">Entidad</span>
                <span class="ua-drawer__value">{{ event.entityType }}</span>
              </div>
              @if (event.entityId) {
                <div class="ua-drawer__field">
                  <span class="ua-drawer__label">ID de entidad</span>
                  <span class="ua-drawer__value ua-drawer__value--mono">{{ event.entityId }}</span>
                </div>
              }
              @if (event.reason) {
                <div class="ua-drawer__field ua-drawer__field--full">
                  <span class="ua-drawer__label">Motivo</span>
                  <span class="ua-drawer__value ua-drawer__value--reason">{{ event.reason }}</span>
                </div>
              }
            </div>
          </section>

          <!-- C. Cambios realizados -->
          @if (hasChanges()) {
            <section class="ua-drawer__section">
              <h3 class="ua-drawer__section-title">
                <span class="material-symbols-outlined">compare_arrows</span>
                Cambios realizados
              </h3>
              <div class="ua-drawer__changes">
                @for (key of changeKeys(); track key) {
                  <div class="ua-change-row">
                    <span class="ua-change-row__key">{{ key }}</span>
                    <div class="ua-change-row__values">
                      <span class="ua-change-row__before">
                        {{ formatValue(event.previousValues?.[key]) }}
                      </span>
                      <span class="material-symbols-outlined ua-change-row__arrow">arrow_forward</span>
                      <span class="ua-change-row__after">
                        {{ formatValue(event.newValues?.[key]) }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- D. Información técnica (colapsable) -->
          <section class="ua-drawer__section">
            <button
              class="ua-drawer__collapsible-trigger"
              (click)="toggleTechnical()"
              [attr.aria-expanded]="showTechnical()"
              aria-controls="ua-technical-section">
              <span class="material-symbols-outlined">dns</span>
              Información técnica
              <span class="material-symbols-outlined ua-drawer__chevron">
                {{ showTechnical() ? 'expand_less' : 'expand_more' }}
              </span>
            </button>

            @if (showTechnical()) {
              <div id="ua-technical-section" class="ua-drawer__grid ua-drawer__tech">
                @if (event.ipAddress) {
                  <div class="ua-drawer__field">
                    <span class="ua-drawer__label">IP</span>
                    <span class="ua-drawer__value ua-drawer__value--mono">{{ event.ipAddress }}</span>
                  </div>
                }
                @if (event.device) {
                  <div class="ua-drawer__field">
                    <span class="ua-drawer__label">Dispositivo</span>
                    <span class="ua-drawer__value">{{ event.device }}</span>
                  </div>
                }
                @if (event.browser) {
                  <div class="ua-drawer__field">
                    <span class="ua-drawer__label">Navegador</span>
                    <span class="ua-drawer__value">{{ event.browser }}</span>
                  </div>
                }
                @if (event.sessionId) {
                  <div class="ua-drawer__field ua-drawer__field--full">
                    <span class="ua-drawer__label">Session ID</span>
                    <span class="ua-drawer__value ua-drawer__value--mono">{{ event.sessionId }}</span>
                  </div>
                }
                @if (event.correlationId) {
                  <div class="ua-drawer__field ua-drawer__field--full">
                    <span class="ua-drawer__label">Correlation ID</span>
                    <span class="ua-drawer__value ua-drawer__value--mono">{{ event.correlationId }}</span>
                  </div>
                }
                @if (event.durationMs !== undefined) {
                  <div class="ua-drawer__field">
                    <span class="ua-drawer__label">Duración</span>
                    <span class="ua-drawer__value">{{ event.durationMs }} ms</span>
                  </div>
                }
              </div>
            }
          </section>

        </div><!-- /body -->
      </aside>
    }
  `,
  styleUrl: './activity-detail-drawer.component.css',
})
export class ActivityDetailDrawerComponent {
  @Input() event: UserActivityEvent | null = null;
  @Output() close = new EventEmitter<void>();

  protected readonly showTechnical = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.event) {
      this.close.emit();
    }
  }

  protected toggleTechnical(): void {
    this.showTechnical.update((v) => !v);
  }

  protected resultIcon(result: ActivityResult): string {
    const icons: Record<ActivityResult, string> = {
      SUCCESS: 'check_circle',
      WARNING: 'warning',
      REJECTED: 'cancel',
      ERROR: 'error',
    };
    return icons[result] ?? 'info';
  }

  protected hasChanges(): boolean {
    return !!(
      this.event &&
      (Object.keys(this.event.previousValues ?? {}).length > 0 ||
        Object.keys(this.event.newValues ?? {}).length > 0)
    );
  }

  protected changeKeys(): string[] {
    if (!this.event) return [];
    const prev = Object.keys(this.event.previousValues ?? {});
    const next = Object.keys(this.event.newValues ?? {});
    return Array.from(new Set([...prev, ...next]));
  }

  protected formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }
}
