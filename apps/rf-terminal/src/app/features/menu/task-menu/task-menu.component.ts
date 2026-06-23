/**
 * @file task-menu.component.ts
 * @description P7 — Menú de Tareas Principal del RF Terminal.
 * 4 botones gigantes con navegación a flujos operativos.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState, SyncState } from '@4guard/shared-core';

interface TaskButton {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  route: string;
  color: 'primary' | 'success' | 'warning' | 'info';
}

@Component({
  selector: 'fg-task-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-menu.component.html',
  styleUrl: './task-menu.component.css',
})
export class TaskMenuComponent {
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  private readonly router      = inject(Router);

  protected readonly taskButtons: TaskButton[] = [
    { id: 'btn-reception',  icon: '📥', label: 'Recepción',  sublabel: 'Escanear mercancía recibida', route: '/receiving', color: 'primary' },
    { id: 'btn-putaway',    icon: '📤', label: 'Acomodo',    sublabel: 'Ubicar en rack asignado',     route: '/putaway',   color: 'success' },
    { id: 'btn-picking',    icon: '📦', label: 'Picking',    sublabel: 'Recolectar por lista FEFO',   route: '/picking',   color: 'warning' },
    { id: 'btn-lookup',     icon: '🔍', label: 'Consulta',   sublabel: 'Buscar ítem por SSCC/SKU',    route: '/counting',  color: 'info'    },
  ];

  protected navigate(route: string): void {
    this.router.navigate([route]);
  }
}
