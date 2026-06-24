/**
 * @file putaway-scan.component.ts
 * @description Pantalla de Ubicación en Rack (Putaway) RF.
 * Permite escanear SSCCs para indicar en qué ubicación se guardarán.
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

interface PutawayItem {
  sscc: string;
  sku: string;
  description: string;
  targetLocation: string;
  status: 'PENDING' | 'COMPLETED';
  scannedAt: Date;
}

@Component({
  selector: 'fg-rf-putaway-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './putaway-scan.component.html',
  styleUrl: './putaway-scan.component.css',
})
export class PutawayScanComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  protected readonly currentInput  = signal('');
  protected readonly isProcessing  = signal(false);
  protected readonly lastError     = signal<string | null>(null);

  protected readonly buffer = signal<PutawayItem[]>([
    { sscc: 'SSCC-P001', sku: 'SKU-CAFE-001', description: 'Café Molido 500g',  targetLocation: 'RACK-A-12', status: 'COMPLETED', scannedAt: new Date(Date.now() - 6 * 60000) },
  ]);

  protected readonly completedCount = computed(() => this.buffer().filter(i => i.status === 'COMPLETED').length);
  protected readonly expectedTotal  = signal(6);

  private readonly MOCK_DB: Record<string, { sku: string; description: string; targetLocation: string }> = {
    'SSCC-P002': { sku: 'SKU-AGUA-002', description: 'Agua Purificada 1L', targetLocation: 'RACK-B-04' },
    'SSCC-P003': { sku: 'SKU-LECHE-003', description: 'Leche Entera UHT 1L',  targetLocation: 'RACK-C-08' },
    'SSCC-P004': { sku: 'SKU-ATUN-007',  description: 'Atún en Agua 180g',    targetLocation: 'RACK-D-10' },
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
      this.lastError.set(`⚠ Duplicado: ${code} ya fue ubicado`);
      return;
    }

    const item = this.MOCK_DB[code];
    if (!item) {
      this.lastError.set(`❌ Código de Putaway no reconocido: ${code}`);
      return;
    }

    this.isProcessing.set(true);
    setTimeout(() => {
      this.buffer.update(buf => [
        ...buf,
        { sscc: code, sku: item.sku, description: item.description, targetLocation: item.targetLocation, status: 'COMPLETED', scannedAt: new Date() },
      ]);
      this.isProcessing.set(false);
    }, 300);
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
