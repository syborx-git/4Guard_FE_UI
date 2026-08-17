/**
 * @file dashboard.component.ts
 * @description P3 — Dashboard de KPIs (Torre de Control) [HU-159].
 * RiskGauge radial + KPIs + Alertas críticas con badge parpadeante.
 * SSE simulado: alertas llegan reactivamente vía Signal actualizado cada 30s.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { InventoryState, InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';
import { SpecularGlowDirective } from '../../shared/directives/specular-glow.directive';

interface KpiCard {
  id: string;
  label: string;
  value: number;
  unit?: string;
  status: InventoryStatus;
  icon: string;
  trendDir: 'up' | 'down' | 'flat';
  trendPct: number;
}

interface Alert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  module: string;
  since: string;
}

@Component({
  selector: 'fg-admin-dashboard',
  standalone: true,
  imports: [CommonModule, SpecularGlowDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly inventoryState = inject(InventoryState);
  protected readonly router         = inject(Router);

  protected readonly InventoryStatus       = InventoryStatus;
  protected readonly INVENTORY_STATUS_LABELS = INVENTORY_STATUS_LABELS;

  // ── KPIs simulados ───────────────────────────────────────────────────────
  protected readonly riskScore   = signal(34);
  protected readonly occupancy   = signal(79);
  protected readonly totalBays   = signal(48);
  protected readonly occupiedBays= signal(38);

  protected readonly kpiCards = computed<KpiCard[]>(() => [
    {
      id: 'kpi-available',
      label: 'Disponibles',
      value: this.inventoryState.items().filter(i => i.status === InventoryStatus.AVAILABLE).length || 820,
      status: InventoryStatus.AVAILABLE,
      icon: '📦',
      trendDir: 'up',
      trendPct: 4.2,
    },
    {
      id: 'kpi-quarantine',
      label: 'En Cuarentena',
      value: this.inventoryState.quarantineCount() || 3,
      status: InventoryStatus.QUARANTINE,
      icon: '⚠️',
      trendDir: 'flat',
      trendPct: 0,
    },
    {
      id: 'kpi-blocked',
      label: 'Bloqueados QM',
      value: this.inventoryState.qmBlockedCount() || 2,
      status: InventoryStatus.QM_BLOCKED,
      icon: '🔒',
      trendDir: 'down',
      trendPct: 1.5,
    },
    {
      id: 'kpi-picking',
      label: 'En Picking',
      value: this.inventoryState.items().filter(i => i.status === InventoryStatus.IN_PICKING).length || 1,
      status: InventoryStatus.IN_PICKING,
      icon: '🛒',
      trendDir: 'up',
      trendPct: 12.0,
    },
  ]);

  // ── Alertas críticas (simula SSE) ────────────────────────────────────────
  protected readonly alerts = signal<Alert[]>([
    {
      id: 'ALT-001',
      severity: 'CRITICAL',
      message: 'Lotes SSCC-0004, SSCC-0005 (Leche Lala) bloqueados por QM hace más de 2h',
      module: 'quality',
      since: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ALT-002',
      severity: 'WARNING',
      message: 'Recepción REC-2024-001 tiene 20 piezas faltantes en cápsulas Espresso',
      module: 'receiving',
      since: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'ALT-003',
      severity: 'WARNING',
      message: '3 lotes de Leche próximos a vencer en < 90 días',
      module: 'inventory',
      since: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  protected readonly criticalCount = computed(() =>
    this.alerts().filter(a => a.severity === 'CRITICAL').length
  );

  // ── SSE simulation timer ──────────────────────────────────────────────────
  private sseTimer: ReturnType<typeof setInterval> | null = null;

  // ── Risk Gauge SVG helpers ────────────────────────────────────────────────
  protected readonly gaugeCircumference = 2 * Math.PI * 54;

  protected readonly gaugeDashOffset = computed(() => {
    const pct = Math.min(Math.max(this.riskScore(), 0), 100) / 100;
    return this.gaugeCircumference * (1 - pct);
  });

  protected readonly gaugeColor = computed(() => {
    const score = this.riskScore();
    if (score < 30) return 'var(--color-success, #00897B)';
    if (score < 60) return 'var(--color-warning, #F9A825)';
    return 'var(--color-danger, #E53935)';
  });

  protected readonly gaugeLabel = computed(() => {
    const score = this.riskScore();
    if (score < 30) return 'Bajo';
    if (score < 60) return 'Moderado';
    return 'Alto';
  });

  ngOnInit(): void {
    this.inventoryState.loadItems().subscribe();

    // Simula SSE: cada 30s puede llegar una nueva alerta
    this.sseTimer = setInterval(() => {
      this.simulateSseAlert();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.sseTimer) clearInterval(this.sseTimer);
  }

  protected navigateToMap(): void {
    this.router.navigate(['/inventory/map']);
  }

  protected dismissAlert(id: string): void {
    this.alerts.update(list => list.filter(a => a.id !== id));
  }

  protected getStatusClass(status: InventoryStatus): string {
    return `status-${status}`;
  }

  protected formatSince(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs  = Math.floor(mins / 60);
    return `hace ${hrs}h`;
  }

  private simulateSseAlert(): void {
    const random = Math.random();
    if (random < 0.3) {
      // 30% chance de nueva alerta
      const newAlert: Alert = {
        id: `ALT-${Date.now()}`,
        severity: 'WARNING',
        message: `Operación pendiente de sincronización detectada (${Math.floor(Math.random() * 5) + 1} ops)`,
        module: 'sync',
        since: new Date().toISOString(),
      };
      this.alerts.update(list => [newAlert, ...list].slice(0, 10));
    }
  }
}
