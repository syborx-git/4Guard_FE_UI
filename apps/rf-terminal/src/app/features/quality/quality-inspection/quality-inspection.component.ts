/**
 * @file quality-inspection.component.ts
 * @description Pantalla de Inspección de Calidad (QM) RF.
 * Permite escanear SSCCs para inspeccionar el estado de los ítems.
 */

import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';

interface InspectedItem {
  sscc: string;
  sku: string;
  description: string;
  decision: 'APPROVED' | 'REJECTED' | 'PENDING';
  scannedAt: Date;
}

@Component({
  selector: 'fg-rf-quality-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality-inspection.component.html',
  styleUrl: './quality-inspection.component.css',
})
export class QualityInspectionComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  protected readonly currentInput  = signal('');
  protected readonly isProcessing  = signal(false);
  protected readonly lastError     = signal<string | null>(null);

  protected readonly buffer = signal<InspectedItem[]>([
    { sscc: 'SSCC-Q001', sku: 'SKU-CAFE-001', description: 'Café Molido 500g', decision: 'APPROVED', scannedAt: new Date(Date.now() - 4 * 60000) },
  ]);

  protected readonly inspectedCount = computed(() => this.buffer().length);
  protected readonly expectedTotal  = signal(5);

  private readonly MOCK_DB: Record<string, { sku: string; description: string; decision: 'APPROVED' | 'REJECTED' }> = {
    'SSCC-Q002': { sku: 'SKU-AGUA-002', description: 'Agua Purificada 1L', decision: 'APPROVED' },
    'SSCC-Q003': { sku: 'SKU-LECHE-003', description: 'Leche Entera UHT 1L',  decision: 'REJECTED' },
    'SSCC-Q004': { sku: 'SKU-ATUN-007',  description: 'Atún en Agua 180g',    decision: 'APPROVED' },
  };

  ngAfterViewInit(): void {
    this.focusScanInput();
  }

  protected focusScanInput(): void {
    this.scanInput?.nativeElement?.focus();
  }

  protected onScanInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val.length > 4) {
      this.processCode(val);
      this.currentInput.set('');
      (event.target as HTMLInputElement).value = '';
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.currentInput().trim();
      if (val) {
        this.processCode(val);
        this.currentInput.set('');
      }
    }
  }

  protected simulateScan(): void {
    const codes = Object.keys(this.MOCK_DB);
    const unscanned = codes.filter(c => !this.buffer().find(b => b.sscc === c));
    this.processCode(unscanned.length > 0 ? unscanned[0] : 'SSCC-UNKNOWN-999');
  }

  private processCode(code: string): void {
    this.lastError.set(null);

    if (this.buffer().find(b => b.sscc === code)) {
      this.lastError.set(`⚠ Duplicado: ${code} ya fue inspeccionado`);
      return;
    }

    const item = this.MOCK_DB[code];
    if (!item) {
      this.lastError.set(`❌ Código de calidad no reconocido: ${code}`);
      return;
    }

    this.isProcessing.set(true);
    setTimeout(() => {
      this.buffer.update(buf => [
        ...buf,
        { sscc: code, sku: item.sku, description: item.description, decision: item.decision, scannedAt: new Date() },
      ]);
      this.isProcessing.set(false);
    }, 300);
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  protected getDecisionLabel(decision: string): string {
    switch (decision) {
      case 'APPROVED': return 'Aprobado';
      case 'REJECTED': return 'Rechazado';
      default: return 'Pendiente';
    }
  }
}
