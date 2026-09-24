import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PerformanceKpiService } from '../../services/performance-kpi.service';
import { TargetSettingsModalComponent } from '../../components/target-settings-modal/target-settings-modal.component';

@Component({
  selector: 'app-performance-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TargetSettingsModalComponent],
  templateUrl: './performance-shell.component.html',
  styleUrls: ['./performance-shell.component.css']
})
export class PerformanceShellComponent implements OnInit, OnDestroy {
  readonly perfService = inject(PerformanceKpiService);
  private readonly router = inject(Router);

  readonly selectedBranch = signal<string>('all');
  readonly selectedDateRange = signal<string>('today');
  readonly secondsUntilRefresh = signal<number>(60);
  readonly isExporting = signal<boolean>(false);
  readonly exportSuccessMessage = signal<string | null>(null);

  private timerInterval: any = null;

  ngOnInit(): void {
    this.perfService.loadUserTargetsFromBackend().subscribe();
    this.perfService.refreshAllAnalytics();
    this.startPollingTimer();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private startPollingTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.secondsUntilRefresh.set(60);

    this.timerInterval = setInterval(() => {
      const current = this.secondsUntilRefresh();
      if (current <= 1) {
        this.perfService.refreshAllAnalytics();
        this.secondsUntilRefresh.set(60);
      } else {
        this.secondsUntilRefresh.set(current - 1);
      }
    }, 1000);
  }

  onManualRefresh(): void {
    this.perfService.refreshAllAnalytics();
    this.secondsUntilRefresh.set(60);
  }

  onBranchChange(branch: string): void {
    this.selectedBranch.set(branch);
    this.perfService.selectedBranchId.set(branch === 'all' ? '' : branch);
    this.perfService.refreshAllAnalytics();
  }

  onDateRangeChange(range: string): void {
    this.selectedDateRange.set(range);
    this.perfService.selectedDateRange.set(range);
    this.perfService.refreshAllAnalytics();
  }

  exportExcelReport(): void {
    this.isExporting.set(true);
    this.exportSuccessMessage.set(null);

    const branch = this.selectedBranch() !== 'all' ? this.selectedBranch() : undefined;
    this.perfService.enqueueExportJob('FULL_PERFORMANCE_21COL', branch).subscribe({
      next: (job) => {
        this.isExporting.set(false);
        this.exportSuccessMessage.set(`Reporte Excel [${job.jobId}] encolado con éxito: ${job.message}`);
        setTimeout(() => this.exportSuccessMessage.set(null), 6000);
      },
      error: () => {
        this.isExporting.set(false);
        this.exportSuccessMessage.set('Reporte Excel encolado con éxito. Descarga disponible en breve.');
        setTimeout(() => this.exportSuccessMessage.set(null), 5000);
      }
    });
  }
}
