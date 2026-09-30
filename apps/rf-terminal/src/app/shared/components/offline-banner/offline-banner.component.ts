/**
 * @file offline-banner.component.ts
 * @description Banner Global de Sincronización Offline y Zone Lease para la Terminal RF PWA.
 * Sigue estrictamente la especificación técnica de sincronización 4Guard WMS y el sistema de diseño SDD.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncState, ZoneLeaseService } from '@4guard/shared-core';

@Component({
  selector: 'fg-rf-offline-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-banner.component.html',
  styleUrl: './offline-banner.component.css',
})
export class OfflineBannerComponent {
  protected readonly syncState = inject(SyncState);
  protected readonly zoneLease = inject(ZoneLeaseService);

  // Señal para desplegar detalles de la cola offline
  protected readonly showDetails = signal<boolean>(false);
  protected readonly isTestingSync = signal<boolean>(false);

  /** Determina si el banner debe estar visible */
  readonly isVisible = computed(() => {
    return (
      this.syncState.isOffline() ||
      this.syncState.hasPending() ||
      this.syncState.isSyncing() ||
      this.syncState.hasError() ||
      this.syncState.isQueueFull() ||
      this.zoneLease.leaseStatus() === 'WARNING' ||
      this.zoneLease.leaseStatus() === 'EXPIRED'
    );
  });

  toggleDetails(): void {
    this.showDetails.update(v => !v);
  }

  async triggerManualSync(): Promise<void> {
    this.isTestingSync.set(true);
    await this.syncState.syncNow();
    setTimeout(() => this.isTestingSync.set(false), 600);
  }

  async renewActiveLease(): Promise<void> {
    await this.zoneLease.renewLease();
  }
}
