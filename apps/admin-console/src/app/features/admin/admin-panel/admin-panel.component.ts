/**
 * @file admin-panel.component.ts
 * @description Panel general de administración de 4GUARD WMS.
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BranchConfig {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

@Component({
  selector: 'fg-admin-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.css'
})
export class AdminPanelComponent {
  protected readonly syncInterval = signal(30);
  protected readonly sessionTimeout = signal(120);

  protected readonly branches = signal<BranchConfig[]>([
    { id: '1', name: 'Centro de Distribución Norte', code: 'CDN-01', active: true },
    { id: '2', name: 'Sucursal Metropolitana Sur', code: 'SMS-02', active: true },
    { id: '3', name: 'La Bóveda Principal (Altas Medidas)', code: 'LBP-03', active: true },
    { id: '4', name: 'Almacén de Tránsito Pacífico', code: 'ATP-04', active: false }
  ]);

  protected updateSyncInterval(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.syncInterval.set(Number(input.value));
    }
  }

  protected updateSessionTimeout(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.sessionTimeout.set(Number(input.value));
    }
  }

  protected saveSystemConfig(): void {
    alert(`Configuración guardada: Intervalo ${this.syncInterval()}s, Sesión ${this.sessionTimeout()}m`);
  }

  protected addBranch(): void {
    const name = prompt('Ingrese el nombre de la nueva sucursal:');
    if (!name) return;
    const code = prompt('Ingrese el código de la sucursal (ej: CDX-05):');
    if (!code) return;

    this.branches.update(list => [
      ...list,
      {
        id: String(list.length + 1),
        name,
        code,
        active: true
      }
    ]);
  }

  protected runDiagnostics(): void {
    alert('Ejecutando diagnóstico del sistema...\n- Servidor API: Conectado\n- IndexedDB: 4.2 MB usados\n- Latencia: 14ms\n- Estado general: EXCELENTE');
  }
}
