/**
 * @file task-menu.component.ts
 * @description P7 — Menú de Tareas Maestro del RF Terminal PWA.
 * Adaptado a la Regla de Pablo (Coordinación central de asignación de rampas/racks y flujo de siniestros).
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState, SyncState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

export interface TaskModuleCard {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  tag: string;
  route: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'gold' | 'danger';
}

export interface TaskSectionGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  modules: TaskModuleCard[];
}

export interface AssignedReceptionTask {
  folio: string;
  rampCode: string;
  supplierName: string;
  assignedRackZone: string;
  totalPallets: number;
  pendingPallets: number;
  assignedBy: string; // 'Pablo (Coordinador)'
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

  /** Notificación de Recepción Asignada por Pablo (Coordinador) */
  protected readonly activeTask = signal<AssignedReceptionTask | null>({
    folio: 'REC-2026-000042',
    rampCode: 'RAMPA 03',
    supplierName: 'Distribuidora Alimentos del Norte',
    assignedRackZone: 'Pasillo 04 — Racks A-01 al A-06',
    totalPallets: 8,
    pendingPallets: 5,
    assignedBy: 'Pablo (Coordinación de Entrada)',
  });

  /** 3 Fases Lógicas del Flujo de Trabajo en Almacén */
  protected readonly taskSections: TaskSectionGroup[] = [
    {
      id: 'section-inbound',
      title: '1. Entrada y Guardado',
      subtitle: 'Descarga en andén y traslado a ubicación preasignada por Coordinación',
      icon: 'local_shipping',
      badge: 'Andén ➔ Rack',
      modules: [
        {
          id: 'btn-reception',
          icon: 'move_to_inbox',
          label: 'Recepción en Andén',
          sublabel: 'Descarga de camión y control de bultos en rampa',
          tag: 'En Rampa',
          route: '/receiving',
          color: 'primary',
        },
        {
          id: 'btn-sscc',
          icon: 'print',
          label: 'Imprimir Etiqueta SSCC',
          sublabel: 'Generar código de tarima GS1 para pegado en andén',
          tag: 'Nueva Tarima',
          route: '/receiving',
          color: 'info',
        },
        {
          id: 'btn-putaway',
          icon: 'shelves',
          label: 'Guardar en Rack Asignado',
          sublabel: 'Trasladar tarima al rack predeterminado por Coordinador',
          tag: 'Asignado por Pablo',
          route: '/putaway',
          color: 'success',
        },
      ],
    },
    {
      id: 'section-operations',
      title: '2. Movimientos y Surtido',
      subtitle: 'Operaciones internas de montacargas y preparación de pedidos',
      icon: 'forklift',
      badge: 'Piso y Pasillos',
      modules: [
        {
          id: 'btn-transfer',
          icon: 'swap_horiz',
          label: 'Traspaso entre Bahías',
          sublabel: 'Reubicar tarima a otra posición o rack',
          tag: 'Reubicación',
          route: '/putaway',
          color: 'warning',
        },
        {
          id: 'btn-picking',
          icon: 'shopping_cart',
          label: 'Surtido de Pedidos',
          sublabel: 'Recolección guiada por ruta óptima',
          tag: 'Picking Activo',
          route: '/picking',
          color: 'gold',
        },
        {
          id: 'btn-counting',
          icon: 'format_list_numbered',
          label: 'Conteo Físico Ciego',
          sublabel: 'Auditoría física por pasillo sin teóricos',
          tag: 'Inventario',
          route: '/counting',
          color: 'info',
        },
      ],
    },
    {
      id: 'section-control',
      title: '3. Calidad, Incidencias y Red',
      subtitle: 'Inspección de lotes, reporte de siniestros y sincronización offline',
      icon: 'shield',
      badge: 'Control & Seguridad',
      modules: [
        {
          id: 'btn-quality',
          icon: 'verified',
          label: 'Inspección de Calidad',
          sublabel: 'Dictamen QM para liberar o retener lote',
          tag: 'Calidad QM',
          route: '/quality',
          color: 'success',
        },
        {
          id: 'btn-anomaly',
          icon: 'warning',
          label: 'Reportar Siniestro / Pallet Caído',
          sublabel: 'Baja a Estado 80 con foto obligatoria (HU-164)',
          tag: 'Merma / Baja 80',
          route: '/anomaly',
          color: 'danger',
        },
        {
          id: 'btn-sync',
          icon: 'sync',
          label: 'Sincronizar Datos',
          sublabel: 'Estado de red y transacciones pendientes',
          tag: 'Modo Offline',
          route: '/sync',
          color: 'primary',
        },
      ],
    },
  ];

  /** Navega al módulo reproduciendo sonido háptico */
  protected navigate(route: string): void {
    this.audioService.playSuccess();
    this.router.navigate([route]);
  }

  /** Ir directamente a la tarea asignada por Pablo */
  protected goToAssignedTask(): void {
    this.audioService.playSuccess();
    this.router.navigate(['/putaway']);
  }
}
