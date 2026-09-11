/**
 * @file inventory-analytics-modal.component.ts
 * @description Modal de Analítica Histórica de Ingresos por Año para 4GUARD WMS.
 * Muestra la tendencia de distribución de palets y piezas según el ID consecutivo del palet.
 */

import { Component, EventEmitter, Input, Output, signal, computed, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryQueryService } from '../../services/inventory-query.service';
import { InventoryAnalyticsPoint } from '../../models/inventory-query.models';

@Component({
  selector: 'fg-inventory-analytics-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-analytics-modal.component.html',
  styleUrl: './inventory-analytics-modal.component.css'
})
export class InventoryAnalyticsModalComponent implements OnChanges {
  protected readonly inventoryService = inject(InventoryQueryService);

  @Input() isOpen = false;
  @Input() initialView: 'table' | 'chart' = 'table';
  @Output() closeModal = new EventEmitter<void>();

  // Estado de vista activa (Por defecto inicia en 'chart' para mostrar la gráfica de inmediato)
  public activeTab = signal<'table' | 'chart'>('chart');
  public chartMetric = signal<'pallets' | 'pieces'>('pallets');
  public isGenerating = signal<boolean>(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialView'] && changes['initialView'].currentValue) {
      this.activeTab.set(this.initialView);
    }
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.triggerChartGeneration();
    }
  }

  protected onClose(): void {
    this.closeModal.emit();
  }

  /** Generar o recalcular la gráfica de años con animación */
  public generateYearChart(): void {
    this.activeTab.set('chart');
    this.triggerChartGeneration();
  }

  private triggerChartGeneration(): void {
    this.isGenerating.set(true);
    setTimeout(() => {
      this.isGenerating.set(false);
    }, 350);
  }

  // Métricas computadas para el renderizado de la gráfica de barras
  protected readonly maxPallets = computed(() => {
    const list = this.inventoryService.analyticsData();
    if (list.length === 0) return 1;
    return Math.max(...list.map((item) => item.totalPallets), 1);
  });

  protected readonly maxPieces = computed(() => {
    const list = this.inventoryService.analyticsData();
    if (list.length === 0) return 1;
    return Math.max(...list.map((item) => item.totalPieces), 1);
  });

  protected readonly dominantYear = computed(() => {
    const list = this.inventoryService.analyticsData();
    if (list.length === 0) return null;
    return list.reduce((prev, current) => (prev.totalPallets > current.totalPallets ? prev : current));
  });

  // Métodos auxiliares para cálculo en plantilla (Compatibilidad Angular 17)
  protected getActivePercentage(point: InventoryAnalyticsPoint): number {
    if (this.chartMetric() === 'pallets') {
      return (point.totalPallets / this.maxPallets()) * 100;
    }
    return (point.totalPieces / this.maxPieces()) * 100;
  }

  protected getStockSharePercentage(totalPallets: number): number {
    const total = this.inventoryService.kpiSummary().totalPallets || 1;
    return (totalPallets / total) * 100;
  }
}

