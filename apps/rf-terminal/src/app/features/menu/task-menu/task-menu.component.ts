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
    folio: 'REC-2026-000042',
    title: 'Tarima 5 de 8 • Rampa 03 (Muelle Norte)',
    subtitle: 'Asignado a: Roberto Sánchez • 14 min transcurridos',
    operatorName: 'Roberto Sánchez',
    elapsedMinutes: 14,
    route: '/putaway',
  });

  // ─── 7 Módulos Operativos Táctiles ──────────────────────────────────────────
  protected readonly modules: RfOperationalModule[] = [
    {
      id: 'mod-receiving',
      icon: 'local_shipping',
      title: 'Recepción y Descarga',
      description: 'Control de bultos en andén, cotejo ciego y validación de tarimas entrantes con escáner.',
      badgeText: '1 Activa (Rampa 03)',
      badgeType: 'amber',
      actionLabel: 'Abrir Recepción',
      route: '/receiving',
    },
    {
      id: 'mod-putaway',
      icon: 'shelves',
      title: 'Putaway / Guardado',
      description: 'Ubicación guiada en racks asignados por algoritmo dinámico (Pasillo 04 reservado).',
      badgeText: '3 Asignaciones',
      badgeType: 'sky',
      actionLabel: 'Iniciar Guardado',
      route: '/putaway',
    },
    {
      id: 'mod-picking',
      icon: 'shopping_cart_checkout',
      title: 'Picking / Surtido',
      description: 'Surtido de pedidos, consolidación de olas de despacho y preparación de tarimas mixtas.',
      badgeText: '5 Órdenes pendientes',
      badgeType: 'purple',
      actionLabel: 'Ver Surtido',
      route: '/picking',
    },
    {
      id: 'mod-counting',
      icon: 'checklist_rtl',
      title: 'Conteo Cíclico e Inventario',
      description: 'Auditoría física de posiciones, validación ciega de lote y resolución de discrepancias.',
      badgeText: 'Sin tareas urgentes',
      badgeType: 'emerald',
      actionLabel: 'Auditoría',
      route: '/counting',
    },
    {
      id: 'mod-print',
      icon: 'print',
      title: 'Impresión de Etiquetas SSCC',
      description: 'Generar, duplicar y reimprimir identificadores GS1-128 de tarima completa y máster.',
      badgeText: 'Zebra ZT411 OK',
      badgeType: 'orange',
      actionLabel: 'Imprimir Etiquetas',
      route: '/receiving',
    },
    {
      id: 'mod-quality',
      icon: 'verified_user',
      title: 'Calidad y Bloqueos',
      description: 'Inspección técnica, reporte de empaque dañado, retenciones y liberación por supervisor.',
      badgeText: '2 en Cuarentena',
      badgeType: 'rose',
      actionLabel: 'Ver Calidad',
      route: '/quality',
    },
    {
      id: 'mod-security',
      icon: 'local_police',
      title: 'Seguridad & Caseta',
      description: 'Control de accesos de transporte, captura de placas, fotos de sellos y liberación de patio.',
      badgeText: '4 en Patio',
      badgeType: 'gold',
      actionLabel: 'Acceso Caseta',
      route: '/security',
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
