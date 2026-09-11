/**
 * @file rf-shell.component.ts
 * @description Shell layout maestro del RF Terminal PWA.
 * Incluye header industrial con semáforo de red, indicador Zone Lease, switcher Dark/Light,
 * simulador de escaneo flotante y navegación inferior táctil.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthState, SyncState } from '@4guard/shared-core';
import { RfThemeService } from '../../../core/services/rf-theme.service';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badge?: number;
}

@Component({
  selector: 'fg-rf-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './rf-shell.component.html',
  styleUrl: './rf-shell.component.css',
})
export class RfShellComponent {
  protected readonly themeService = inject(RfThemeService);
  protected readonly authState    = inject(AuthState);
  protected readonly syncState    = inject(SyncState);
  protected readonly audioService = inject(AudioFeedbackService);

  // ─── Estado del Zone Lease (HU-155) ──────────────────────────────────────────
  protected readonly activeZoneName = signal('Pasillo 04');
  protected readonly leaseMinutesLeft = signal(28);
  protected readonly isLeaseWarning = computed(() => this.leaseMinutesLeft() <= 5);

  // ─── Modal Simulador de Escaneo ──────────────────────────────────────────────
  protected readonly showScanModal = signal(false);
  protected readonly simulatedBarcode = signal('SSCC-175012345000000018');

  // ─── Navegación Inferior (Accesos Rápidos de Piso) ───────────────────────────
  protected readonly navItems: NavItem[] = [
    { path: '/menu',      icon: 'grid_view',         label: 'Menú'       },
    { path: '/receiving', icon: 'move_to_inbox',      label: 'Recepción'  },
    { path: '/putaway',   icon: 'shelves',           label: 'Putaway'    },
    { path: '/picking',   icon: 'shopping_cart',     label: 'Picking'    },
    { path: '/counting',  icon: 'format_list_numbered', label: 'Conteo'   },
    { path: '/quality',   icon: 'verified',          label: 'Calidad'    },
    { path: '/sync',      icon: 'sync',              label: 'Sync'       },
  ];

  /** Alterna el tema Dark/Light */
  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.audioService.playSuccess();
  }

  /** Abre el simulador de escaneo */
  openScanSimulator(): void {
    this.showScanModal.set(true);
  }

  /** Cierra el simulador */
  closeScanSimulator(): void {
    this.showScanModal.set(false);
  }

  /** Dispara un escaneo simulado emitiendo eventos de teclado a la ventana */
  triggerSimulatedScan(code: string): void {
    this.audioService.playSuccess();
    this.closeScanSimulator();

    // Despachar evento KeyboardEvent como si fuera el láser
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    // Inyectar en inputs activos o en window
    const activeEl = document.activeElement as HTMLInputElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      activeEl.value = code;
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeEl.dispatchEvent(enterEvent);
    } else {
      window.dispatchEvent(new CustomEvent('rf:barcode-scanned', { detail: code }));
    }
  }
}
