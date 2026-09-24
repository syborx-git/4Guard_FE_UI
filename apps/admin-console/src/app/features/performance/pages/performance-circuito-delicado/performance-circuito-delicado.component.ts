import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerformanceKpiService } from '../../services/performance-kpi.service';

@Component({
  selector: 'app-performance-circuito-delicado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-circuito-delicado.component.html',
  styleUrls: ['./performance-circuito-delicado.component.css']
})
export class PerformanceCircuitoDelicadoComponent {
  readonly perfService = inject(PerformanceKpiService);

  readonly activeTab = signal<'drivers' | 'vehicles'>('drivers');
  readonly searchQuery = signal<string>('');
  readonly filterStatus = signal<string>('ALL');

  readonly filteredDrivers = computed(() => {
    const summary = this.perfService.circuitoDelicado();
    if (!summary?.drivers) return [];
    let list = summary.drivers;
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.filterStatus();

    if (status !== 'ALL') {
      list = list.filter(d => d.status === status);
    }
    if (query) {
      list = list.filter(d =>
        d.driverName.toLowerCase().includes(query) ||
        d.driverLicense.toLowerCase().includes(query) ||
        d.assignedVehiclePlates.toLowerCase().includes(query)
      );
    }
    return list;
  });

  readonly filteredVehicles = computed(() => {
    const summary = this.perfService.circuitoDelicado();
    if (!summary?.vehicles) return [];
    let list = summary.vehicles;
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.filterStatus();

    if (status !== 'ALL') {
      list = list.filter(v => v.status === status);
    }
    if (query) {
      list = list.filter(v =>
        v.economicNumber.toLowerCase().includes(query) ||
        v.tractorPlates.toLowerCase().includes(query) ||
        v.transportType.toLowerCase().includes(query) ||
        v.assignedDriverName.toLowerCase().includes(query)
      );
    }
    return list;
  });

  setTab(tab: 'drivers' | 'vehicles') {
    this.activeTab.set(tab);
    this.filterStatus.set('ALL');
  }

  setStatus(status: string) {
    this.filterStatus.set(status);
  }
}
