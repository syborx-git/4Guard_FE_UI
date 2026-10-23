/**
 * @file quality-shell.component.ts
 * @description Shell Hub de Calidad QM para Terminal RF.
 * Provee la barra de navegación táctil con 5 submódulos (Bloqueos, Liberaciones, Verificación F01, Reclamos, Inspección)
 * y contadores reactivos de estado.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { RfQualityStateService } from '../../../../core/services/rf-quality-state.service';

interface QualityTab {
  path: string;
  label: string;
  icon: string;
  countKey?: 'kpiTotalBlocked' | 'kpiTotalReleases' | 'kpiTotalVerifications' | 'kpiTotalClaims';
  badgeClass: string;
}

@Component({
  selector: 'fg-rf-quality-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './quality-shell.component.html',
  styleUrl: './quality-shell.component.css',
})
export class RfQualityShellComponent {
  protected readonly qmState = inject(RfQualityStateService);

  protected readonly tabs: QualityTab[] = [
    {
      path: 'blocks',
      label: '1. Bloqueos / PNC',
      icon: 'warning',
      countKey: 'kpiTotalBlocked',
      badgeClass: 'badge--danger',
    },
    {
      path: 'releases',
      label: '2. Liberaciones',
      icon: 'check_circle',
      countKey: 'kpiTotalReleases',
      badgeClass: 'badge--success',
    },
    {
      path: 'load-verifications',
      label: '3. Verif. F01 Andén',
      icon: 'fact_check',
      countKey: 'kpiTotalVerifications',
      badgeClass: 'badge--warning',
    },
    {
      path: 'claims',
      label: '4. Reclamos (F01)',
      icon: 'query_stats',
      countKey: 'kpiTotalClaims',
      badgeClass: 'badge--info',
    },
    {
      path: 'inspection',
      label: '5. Inspección QM',
      icon: 'biotech',
      badgeClass: 'badge--gold',
    },
  ];

  getTabCount(key?: 'kpiTotalBlocked' | 'kpiTotalReleases' | 'kpiTotalVerifications' | 'kpiTotalClaims'): number {
    if (!key) return 0;
    return this.qmState[key]();
  }
}
