import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceKpiService } from '../../services/performance-kpi.service';

@Component({
  selector: 'app-performance-operators',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-operators.component.html',
  styleUrls: ['./performance-operators.component.css']
})
export class PerformanceOperatorsComponent {
  readonly perfService = inject(PerformanceKpiService);

  readonly selectedShiftId = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  readonly filteredOperators = computed(() => {
    let list = this.perfService.operatorRankings();
    const shift = this.selectedShiftId();
    const query = this.searchQuery().toLowerCase().trim();

    if (shift) {
      list = list.filter(op => 
        op.shiftId === shift || 
        (op.shiftName && op.shiftName.toLowerCase().includes(shift.toLowerCase()))
      );
    }
    if (query) {
      list = list.filter(op =>
        op.fullName.toLowerCase().includes(query) ||
        op.operatorCode.toLowerCase().includes(query) ||
        (op.licenseNumberDc3 && op.licenseNumberDc3.toLowerCase().includes(query)) ||
        (op.jobTitle && op.jobTitle.toLowerCase().includes(query))
      );
    }
    return list;
  });

  readonly activePersonnelCount = computed(() => this.filteredOperators().length);

  readonly avgProductivityPph = computed(() => {
    const list = this.filteredOperators();
    if (!list.length) return 0;
    const sum = list.reduce((acc, op) => acc + (op.movementsPerHour || 0), 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  readonly globalCompliance = computed(() => {
    const list = this.filteredOperators();
    if (!list.length) return 100;
    const sum = list.reduce((acc, op) => acc + (op.shiftCompliancePercentage || 100), 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  readonly dc3CertificationPercentage = computed(() => {
    const list = this.filteredOperators();
    if (!list.length) return 100;
    const valid = list.filter(op => op.licenseStatus === 'VIGENTE').length;
    return Math.round((valid / list.length) * 1000) / 10;
  });

  selectShift(shiftId: string | null) {
    if (this.selectedShiftId() === shiftId) {
      this.selectedShiftId.set(null);
    } else {
      this.selectedShiftId.set(shiftId);
    }
  }

  clearFilters() {
    this.selectedShiftId.set(null);
    this.searchQuery.set('');
  }
}

