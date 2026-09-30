import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceKpiService } from '../../services/performance-kpi.service';

export interface HourlyThroughputPoint {
  hour: string;
  inbound: number;
  outbound: number;
  total: number;
  target: number;
}

export interface ChartRenderPoint extends HourlyThroughputPoint {
  cx: number;
  cy: number;
  cyTarget: number;
  barInboundHeight: number;
  barOutboundHeight: number;
  barTotalHeight: number;
  inboundY: number;
  outboundY: number;
}

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-dashboard.component.html',
  styleUrls: ['./performance-dashboard.component.css']
})
export class PerformanceDashboardComponent {
  readonly perfService = inject(PerformanceKpiService);

  // Modo de visualización de la gráfica: Área Suave vs Barras Comparativas
  readonly chartViewMode = signal<'spline' | 'bars'>('spline');

  setChartViewMode(mode: 'spline' | 'bars'): void {
    this.chartViewMode.set(mode);
  }

  // Escala máxima del eje Y (movimientos/hora)
  readonly maxScaleY = 25;
  readonly chartBaseY = 180;
  readonly chartTopY = 30;
  readonly chartPlotHeight = 150; // 180 - 30

  // Datos para la gráfica interactiva de Throughput en 24h
  readonly hourlyData = signal<HourlyThroughputPoint[]>([
    { hour: '06:00', inbound: 2, outbound: 1, total: 3, target: 5 },
    { hour: '08:00', inbound: 5, outbound: 3, total: 8, target: 7 },
    { hour: '10:00', inbound: 8, outbound: 6, total: 14, target: 10 },
    { hour: '12:00', inbound: 6, outbound: 9, total: 15, target: 10 },
    { hour: '14:00', inbound: 7, outbound: 8, total: 15, target: 10 },
    { hour: '16:00', inbound: 9, outbound: 11, total: 20, target: 12 },
    { hour: '18:00', inbound: 4, outbound: 8, total: 12, target: 10 },
    { hour: '20:00', inbound: 2, outbound: 4, total: 6, target: 6 },
  ]);

  readonly chartPoints = computed<ChartRenderPoint[]>(() => {
    const data = this.hourlyData();
    const count = data.length;
    const startX = 70;
    const endX = 750;
    const stepX = (endX - startX) / (count - 1);

    return data.map((pt, idx) => {
      const cx = Math.round((startX + (idx * stepX)) * 10) / 10;
      const cy = Math.round((this.chartBaseY - ((pt.total / this.maxScaleY) * this.chartPlotHeight)) * 10) / 10;
      const cyTarget = Math.round((this.chartBaseY - ((pt.target / this.maxScaleY) * this.chartPlotHeight)) * 10) / 10;

      const barInboundHeight = Math.round(((pt.inbound / this.maxScaleY) * this.chartPlotHeight) * 10) / 10;
      const barOutboundHeight = Math.round(((pt.outbound / this.maxScaleY) * this.chartPlotHeight) * 10) / 10;
      const barTotalHeight = Math.round(((pt.total / this.maxScaleY) * this.chartPlotHeight) * 10) / 10;

      const inboundY = this.chartBaseY - barInboundHeight;
      const outboundY = inboundY - barOutboundHeight;

      return {
        ...pt,
        cx,
        cy,
        cyTarget,
        barInboundHeight,
        barOutboundHeight,
        barTotalHeight,
        inboundY,
        outboundY
      };
    });
  });

  // Generador dinámico de Spline Monotónico Catmull-Rom para curva suave sin oscilaciones
  readonly splinePath = computed<string>(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].cx} ${pts[0].cy}`;

    let path = `M ${pts[0].cx} ${pts[0].cy}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : { cx: pts[0].cx - (pts[1].cx - pts[0].cx), cy: pts[0].cy };
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : { cx: p2.cx + (p2.cx - p1.cx), cy: p2.cy };

      // Catmull-Rom to Cubic Bézier conversion
      const cp1x = p1.cx + (p2.cx - p0.cx) / 6;
      let cp1y = p1.cy + (p2.cy - p0.cy) / 6;

      const cp2x = p2.cx - (p3.cx - p1.cx) / 6;
      let cp2y = p2.cy - (p3.cy - p1.cy) / 6;

      // Clamping para evitar oscilaciones por debajo de la base o por encima del tope
      cp1y = Math.min(this.chartBaseY, Math.max(this.chartTopY, cp1y));
      cp2y = Math.min(this.chartBaseY, Math.max(this.chartTopY, cp2y));

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.cx} ${p2.cy}`;
    }

    return path;
  });

  readonly splineAreaPath = computed<string>(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const mainSpline = this.splinePath();
    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];
    return `${mainSpline} L ${lastPt.cx} ${this.chartBaseY} L ${firstPt.cx} ${this.chartBaseY} Z`;
  });

  // Línea de Meta (Target Spline)
  readonly targetSplinePath = computed<string>(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    let path = `M ${pts[0].cx} ${pts[0].cyTarget}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].cx} ${pts[i].cyTarget}`;
    }
    return path;
  });

  // Tooltip interactivo sobre la gráfica de Throughput
  readonly hoveredPoint = signal<ChartRenderPoint | null>(null);

  setHoveredPoint(point: ChartRenderPoint | null): void {
    this.hoveredPoint.set(point);
  }

  openTargetsModal(): void {
    this.perfService.openTargetModal();
  }

  // Evaluaciones reactivas dinámicas contra las metas del usuario
  getOccupancyStatus(current: number, targetMax: number): 'OPTIMAL' | 'WARNING' | 'CRITICAL' {
    if (current <= targetMax) return 'OPTIMAL';
    if (current <= targetMax + 5) return 'WARNING';
    return 'CRITICAL';
  }

  getIraStatus(current: number, targetMin: number): 'OPTIMAL' | 'WARNING' | 'CRITICAL' {
    if (current >= targetMin) return 'OPTIMAL';
    if (current >= targetMin - 2) return 'WARNING';
    return 'CRITICAL';
  }

  getOtifStatus(current: number, targetMin: number): 'OPTIMAL' | 'WARNING' | 'CRITICAL' {
    if (current >= targetMin) return 'OPTIMAL';
    if (current >= targetMin - 3) return 'WARNING';
    return 'CRITICAL';
  }

  getDockToStockStatus(current: number, targetMax: number): 'OPTIMAL' | 'WARNING' | 'CRITICAL' {
    if (current <= targetMax) return 'OPTIMAL';
    if (current <= targetMax + 0.5) return 'WARNING';
    return 'CRITICAL';
  }

  getOrderCycleStatus(current: number, targetMax: number): 'OPTIMAL' | 'WARNING' | 'CRITICAL' {
    if (current <= targetMax) return 'OPTIMAL';
    if (current <= targetMax + 1.0) return 'WARNING';
    return 'CRITICAL';
  }

  readonly occStatus = computed(() =>
    this.getOccupancyStatus(
      this.perfService.executiveKpis()?.warehouseOccupancyPercentage ?? 76.8,
      this.perfService.userTargets().targetOccupancyPercentage
    )
  );

  readonly iraStatus = computed(() =>
    this.getIraStatus(
      this.perfService.executiveKpis()?.inventoryAccuracyPercentage ?? 99.8,
      this.perfService.userTargets().targetIraPercentage
    )
  );

  readonly otifStatus = computed(() =>
    this.getOtifStatus(
      this.perfService.executiveKpis()?.onTimeDeliveryPercentage ?? 98.6,
      this.perfService.userTargets().targetOtifPercentage
    )
  );

  readonly dtsStatus = computed(() =>
    this.getDockToStockStatus(
      this.perfService.executiveKpis()?.avgDockToStockHours ?? 1.4,
      this.perfService.userTargets().targetDockToStockHours
    )
  );

  readonly octStatus = computed(() =>
    this.getOrderCycleStatus(
      this.perfService.executiveKpis()?.avgOrderCycleHours ?? 2.8,
      this.perfService.userTargets().targetOrderCycleHours
    )
  );
}
