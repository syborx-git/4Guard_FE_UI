/**
 * @file task-menu.component.ts
 * @description Menú de Operaciones Maestro para Terminal RF PWA.
 * Adaptado con diseño ergonómico de alta visibilidad, soporte dual theme (Light/Dark),
 * tarjeta Hero de reanudación rápida, 7 módulos táctiles y telemetría de hardware.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState, SyncState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

export interface RfOperationalModule {
  id: string;
  icon: string;
  title: string;
  description: string;
  badgeText: string;
  badgeType: 'amber' | 'sky' | 'purple' | 'emerald' | 'orange' | 'rose' | 'gold';
  actionLabel: string;
  route: string;
}

export interface ActiveTaskSummary {
  folio: string;
  title: string;
  subtitle: string;
  operatorName: string;
  elapsedMinutes: number;
  route: string;
}

@Component({
  selector: 'fg-task-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-menu.component.html',
  styleUrl: './task-menu.component.css',
})
export class TaskMenuComponent {
  protected readonly authState    = inject(AuthState);
  protected readonly syncState    = inject(SyncState);
  protected readonly audioService = inject(AudioFeedbackService);
  private readonly router         = inject(Router);

  // ─── Modal de Reportar Incidencia ────────────────────────────────────────────
  protected readonly showIncidentModal = signal(false);

  // ─── Tarea Activa en Curso (Hero Target) ────────────────────────────────────
  protected readonly activeTask = signal<ActiveTaskSummary | null>({
    folio: 'MIS-INB-2026-081',
    title: 'Descarga Inbound • Tarima 1 de 6 • Rampa 03',
    subtitle: 'Asignado a: Roberto Sánchez • 8 min SLA restante',
    operatorName: 'Roberto Sánchez',
    elapsedMinutes: 4,
    route: '/cockpit',
  });

  // ─── Módulos Operativos Táctiles Unificados ──────────────────────────────
  protected readonly modules: RfOperationalModule[] = [
    {
      id: 'mod-cockpit',
      icon: 'forklift',
      title: 'Cockpit Montacarguista (Unificado)',
      description: 'Gestión integral de movimientos: Descargas Inbound, Reubicaciones Putaway y Cargas de Salida en cola FIFO dinámica.',
      badgeText: '5 en Cola (2 Urgentes)',
      badgeType: 'amber',
      actionLabel: 'Abrir Cockpit',
      route: '/cockpit',
    },
    {
      id: 'mod-counting',
      icon: 'checklist_rtl',
      title: 'Conteo Cíclico e Inventario',
      description: 'Auditoría física de posiciones en rack, validación ciega de lotes y resolución de discrepancias.',
      badgeText: 'Sin tareas urgentes',
      badgeType: 'emerald',
      actionLabel: 'Auditoría',
      route: '/counting',
    },
    {
      id: 'mod-quality',
      icon: 'verified_user',
      title: 'Calidad & Cuarentena QM',
      description: 'Inspección técnica, reporte de empaque dañado, retenciones y liberación de producto por supervisor.',
      badgeText: '2 en Cuarentena',
      badgeType: 'rose',
      actionLabel: 'Ver Calidad',
      route: '/quality',
    },
    {
      id: 'mod-security',
      icon: 'local_police',
      title: 'Seguridad & Caseta de Vigilancia',
      description: 'Control de accesos de transporte, captura de placas, fotos de sellos y liberación de patio con checklist F01.',
      badgeText: '4 en Patio',
      badgeType: 'gold',
      actionLabel: 'Acceso Caseta',
      route: '/security',
    },
    {
      id: 'mod-print',
      icon: 'print',
      title: 'Impresión de Etiquetas Zebra SSCC',
      description: 'Generar, duplicar y reimprimir identificadores GS1-128 de tarima completa y máster.',
      badgeText: 'Zebra ZT411 OK',
      badgeType: 'orange',
      actionLabel: 'Imprimir Etiquetas',
      route: '/receiving',
    },
  ];

  /** Navegación táctil con feedback sonoro y háptico */
  protected navigate(route: string): void {
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    this.router.navigate([route]);
  }

  /** Reanudar directamente la tarea activa */
  protected resumeActiveTask(): void {
    const task = this.activeTask();
    if (task) {
      this.navigate(task.route);
    }
  }

  /** Sincronizar datos manualmente */
  protected manualSync(): void {
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
    this.router.navigate(['/sync']);
  }

  /** Abrir modal de reporte de incidencia */
  protected openIncidentModal(): void {
    this.audioService.playWarning();
    this.showIncidentModal.set(true);
  }

  /** Cerrar modal de incidencia */
  protected closeIncidentModal(): void {
    this.showIncidentModal.set(false);
  }

  /** Confirmar y redirigir al formulario de anomalía */
  protected confirmIncidentRedirect(): void {
    this.showIncidentModal.set(false);
    this.navigate('/anomaly');
  }
}
