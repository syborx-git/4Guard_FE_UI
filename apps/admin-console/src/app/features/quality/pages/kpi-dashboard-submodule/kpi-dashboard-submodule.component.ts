import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityStateService } from '../../services/quality-state.service';
import { QualityDeviationModalComponent } from '../../components/quality-deviation-modal/quality-deviation-modal.component';
import {
  QualityDeviation,
  QUALITY_MATERIAL_TYPE_LABELS,
  QUALITY_CONDITION_LABELS,
  QUALITY_ROOT_CAUSE_LABELS,
  QUALITY_ACTION_LABELS
} from '../../models/quality.models';
import { PrintService } from '../../../../core/services/print.service';
import { PrintDeviationLayoutComponent } from '../../components/print-layouts/print-deviation-layout.component';

@Component({
  selector: 'app-kpi-dashboard-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, QualityDeviationModalComponent, PrintDeviationLayoutComponent],
  templateUrl: './kpi-dashboard-submodule.component.html',
  styleUrls: ['./kpi-dashboard-submodule.component.css']
})
export class KpiDashboardSubmoduleComponent implements OnInit {
  qualityState = inject(QualityStateService);
  private readonly printService = inject(PrintService);

  // Filters & Search
  searchQuery = signal<string>('');
  selectedMaterialFilter = signal<string>('ALL');
  selectedRootCauseFilter = signal<string>('ALL');

  // Month selector options based on audited Excel history (Nov 2025 – Sep 2026)
  monthOptions = [
    { year: 2026, month: 10, label: 'Octubre 2026 (Actual)' },
    { year: 2026, month: 9, label: 'Septiembre 2026' },
    { year: 2026, month: 8, label: 'Agosto 2026' },
    { year: 2026, month: 7, label: 'Julio 2026' },
    { year: 2026, month: 6, label: 'Junio 2026' },
    { year: 2026, month: 5, label: 'Mayo 2026' },
    { year: 2026, month: 4, label: 'Abril 2026' },
    { year: 2026, month: 3, label: 'Marzo 2026' },
    { year: 2026, month: 2, label: 'Febrero 2026' },
    { year: 2026, month: 1, label: 'Enero 2026' },
    { year: 2025, month: 12, label: 'Diciembre 2025' },
    { year: 2025, month: 11, label: 'Noviembre 2025' }
  ];

  selectedPeriodKey = signal<string>('2026-10');

  // Detail Modal for a single deviation
  selectedDeviation = signal<QualityDeviation | null>(null);
  isDetailOpen = signal<boolean>(false);

  // Modal de Impresión y Descarga PDF (ADR-015)
  showPrintModal = signal<boolean>(false);
  isGeneratingPdf = signal<boolean>(false);
  deviationToPrint = signal<QualityDeviation | null>(null);

  // Labels mappings
  materialLabels = QUALITY_MATERIAL_TYPE_LABELS;
  conditionLabels = QUALITY_CONDITION_LABELS;
  rootCauseLabels = QUALITY_ROOT_CAUSE_LABELS;
  actionLabels = QUALITY_ACTION_LABELS;

  ngOnInit(): void {
    this.qualityState.loadMonthlyBoard(2026, 10);
  }

  onPeriodChange(val: string): void {
    this.selectedPeriodKey.set(val);
    const [y, m] = val.split('-').map(Number);
    this.qualityState.loadMonthlyBoard(y, m);
  }

  // Filtered deviations table
  filteredDeviations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const mat = this.selectedMaterialFilter();
    const cause = this.selectedRootCauseFilter();
    const list = this.qualityState.deviations();

    return list.filter(d => {
      const matchSearch = !q ||
        d.folio.toLowerCase().includes(q) ||
        d.remisionNumber.toLowerCase().includes(q) ||
        d.skuId.toLowerCase().includes(q) ||
        (d.skuDescription && d.skuDescription.toLowerCase().includes(q)) ||
        (d.responsibleCollaborator && d.responsibleCollaborator.toLowerCase().includes(q)) ||
        d.uaCode.toLowerCase().includes(q);

      const matchMat = mat === 'ALL' || d.materialType === mat;
      const matchCause = cause === 'ALL' || d.rootCauseMotive === cause;

      return matchSearch && matchMat && matchCause;
    });
  });

  openCreateModal(): void {
    this.qualityState.isDeviationModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.qualityState.isDeviationModalOpen.set(false);
  }

  openDetail(dev: QualityDeviation): void {
    this.selectedDeviation.set(dev);
    this.isDetailOpen.set(true);
  }

  closeDetail(): void {
    this.selectedDeviation.set(null);
    this.isDetailOpen.set(false);
  }

  // ── IMPRESIÓN Y GENERACIÓN DE PDF OFICIAL (ADR-015 / SDD) ──
  openPrintPreview(dev: QualityDeviation): void {
    this.deviationToPrint.set(dev);
    this.showPrintModal.set(true);
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.deviationToPrint.set(null);
  }

  async downloadDirectPdf(): Promise<void> {
    const dev = this.deviationToPrint();
    if (!dev) return;
    const folio = dev.folio || 'DESVIACION';
    this.isGeneratingPdf.set(true);
    try {
      await this.printService.downloadPdf('#official-deviation-print-sheet', `${folio}_DEV-PO-QM-01.pdf`);
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  triggerBrowserPrint(): void {
    const dev = this.deviationToPrint();
    const folio = dev?.folio || 'DESVIACION';
    this.printService.printElement('#official-deviation-print-sheet', `${folio} - Cédula de Desviación`);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  }
}

