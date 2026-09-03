/**
 * @file quality-shell.component.ts
 * @description Shell Principal del Módulo de Calidad (QM) con Hero Header, Bento KPIs y Router Outlet.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { QualityStateService } from '../../services/quality-state.service';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';

@Component({
  selector: 'fg-quality-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, SpecularGlowDirective],
  templateUrl: './quality-shell.component.html',
  styleUrl: './quality-shell.component.css'
})
export class QualityShellComponent {
  protected readonly qualityState = inject(QualityStateService);
}
