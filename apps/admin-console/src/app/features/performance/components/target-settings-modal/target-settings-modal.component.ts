import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceKpiService } from '../../services/performance-kpi.service';
import { OperationalUserTargets, DEFAULT_OPERATIONAL_TARGETS } from '../../models/performance-kpi.model';

@Component({
  selector: 'app-target-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './target-settings-modal.component.html',
  styleUrls: ['./target-settings-modal.component.css']
})
export class TargetSettingsModalComponent implements OnInit {
  readonly perfService = inject(PerformanceKpiService);

  // Form draft state
  formData = signal<OperationalUserTargets>({ ...DEFAULT_OPERATIONAL_TARGETS });
  saveSuccess = signal<boolean>(false);

  ngOnInit(): void {
    this.formData.set({ ...this.perfService.userTargets() });
  }

  saveTargets(): void {
    this.perfService.updateUserTargets(this.formData()).subscribe({
      next: () => {
        this.saveSuccess.set(true);
        setTimeout(() => {
          this.saveSuccess.set(false);
          this.perfService.closeTargetModal();
        }, 900);
      },
      error: () => {
        this.saveSuccess.set(true);
        setTimeout(() => {
          this.saveSuccess.set(false);
          this.perfService.closeTargetModal();
        }, 900);
      }
    });
  }

  resetDefaults(): void {
    this.formData.set({ ...DEFAULT_OPERATIONAL_TARGETS });
    this.perfService.resetUserTargetsToDefault();
  }

  close(): void {
    this.perfService.closeTargetModal();
  }
}
