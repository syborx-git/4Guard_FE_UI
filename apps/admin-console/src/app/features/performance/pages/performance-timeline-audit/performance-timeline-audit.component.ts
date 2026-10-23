import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceKpiService } from '../../services/performance-kpi.service';

@Component({
  selector: 'app-performance-timeline-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-timeline-audit.component.html',
  styleUrls: ['./performance-timeline-audit.component.css']
})
export class PerformanceTimelineAuditComponent {
  readonly perfService = inject(PerformanceKpiService);

  readonly folioFilter = signal<string>('FOL-2026-0921-01');
  readonly ssccFilter = signal<string>('');
  readonly operationTypeFilter = signal<string>('ALL');

  readonly events = computed(() => {
    let list = this.perfService.movementAuditTimeline();
    const opType = this.operationTypeFilter();
    const sscc = this.ssccFilter().toLowerCase().trim();

    if (opType !== 'ALL') {
      list = list.filter(e => e.operationType === opType);
    }
    if (sscc) {
      list = list.filter(e => e.sscc.toLowerCase().includes(sscc));
    }
    return list;
  });

  onSearch() {
    this.perfService.loadMovementAuditTimeline({
      folio: this.folioFilter().trim() || undefined,
      sscc: this.ssccFilter().trim() || undefined
    }).subscribe();
  }

  setOpFilter(type: string) {
    this.operationTypeFilter.set(type);
  }
}
