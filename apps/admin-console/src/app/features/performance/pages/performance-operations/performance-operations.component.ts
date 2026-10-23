import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceKpiService } from '../../services/performance-kpi.service';

@Component({
  selector: 'app-performance-operations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-operations.component.html',
  styleUrls: ['./performance-operations.component.css']
})
export class PerformanceOperationsComponent {
  readonly perfService = inject(PerformanceKpiService);
}
