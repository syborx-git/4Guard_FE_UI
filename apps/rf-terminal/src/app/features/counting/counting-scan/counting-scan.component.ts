/**
 * @file counting-scan.component.ts
 * @description Pantalla de Conteo Físico RF.
 * Permite escanear SKUs/SSCCs para registrar conteo de inventario.
 * Patrón idéntico a receiving-scan: input oculto + buffer de conteo.
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

interface CountedItem {
  sscc: string;
  sku: string;
  description: string;
  location: string;
  qty: number;
  scannedAt: Date;
}

@Component({
  selector: 'fg-rf-counting-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './counting-scan.component.html',
  styleUrl: './counting-scan.component.css',
})
export class CountingScanComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  protected readonly currentInput  = signal('');
  protected readonly isProcessing  = signal(false);
  protected readonly lastError     = signal<string | null>(null);

  protected readonly buffer = signal<CountedItem[]>([
    { sscc: 'SSCC-C001', sku: 'SKU-CAFE-001', description: 'Café Molido 500g',  location: 'A-01-01', qty: 12, scannedAt: new Date(Date.now() - 5 * 60000) },
    { sscc: 'SSCC-C002', sku: 'SKU-AGUA-002', description: 'Agua Purificada 1L', location: 'A-01-02', qty: 48, scannedAt: new Date(Date.now() - 2 * 60000) },
  ]);

  protected readonly countedItems  = computed(() => this.buffer().length);
  protected readonly totalExpected = signal(10);

  private readonly MOCK_DB: Record<string, { sku: string; description: string; location: string; qty: number }> = {
    'SSCC-C003': { sku: 'SKU-LECHE-003', description: 'Leche Entera UHT 1L',   location: 'B-02-01', qty: 24 },
    'SSCC-C004': { sku: 'SKU-ATUN-007',  description: 'Atún en Agua 180g',     location: 'B-02-02', qty: 36 },
    'SSCC-C005': { sku: 'SKU-ACEITE-004',description: 'Aceite de Oliva 500ml', location: 'C-03-01', qty: 18 },
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
      this.lastError.set(`⚠ Duplicado: ${code} ya fue contado`);
      return;
    }

    const item = this.MOCK_DB[code];
    if (!item) {
      this.lastError.set(`❌ Código no reconocido: ${code}`);
      return;
    }

    this.isProcessing.set(true);
    setTimeout(() => {
      this.buffer.update(buf => [
        ...buf,
        { sscc: code, sku: item.sku, description: item.description, location: item.location, qty: item.qty, scannedAt: new Date() },
      ]);
      this.isProcessing.set(false);
    }, 300);
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
