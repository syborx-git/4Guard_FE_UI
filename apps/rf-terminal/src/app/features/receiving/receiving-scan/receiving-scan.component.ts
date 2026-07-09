/**
 * @file receiving-scan.component.ts
 * @description P8 — Escaneo de Recepción RF.
 * Input oculto para láser. Buffer asíncrono con badges de estado.
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
import { FormsModule } from '@angular/forms';

interface ScannedItem {
  sscc: string;
  sku: string;
  description: string;
  status: 10 | 20;
  scannedAt: Date;
}

@Component({
  selector: 'fg-rf-receiving-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receiving-scan.component.html',
  styleUrl: './receiving-scan.component.css',
})
export class ReceivingScanComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  protected readonly currentInput = signal('');
  protected readonly isProcessing = signal(false);
  protected readonly lastError    = signal<string | null>(null);

  protected readonly buffer = signal<ScannedItem[]>([
    { sscc: 'SSCC-0009', sku: 'SKU-ATUN-007',  description: 'Atún en Agua 180g',  status: 10, scannedAt: new Date(Date.now() - 12 * 60000) },
    { sscc: 'SSCC-0001', sku: 'SKU-CAFE-001',  description: 'Café Molido 500g',   status: 20, scannedAt: new Date(Date.now() - 8 * 60000) },
    { sscc: 'SSCC-0002', sku: 'SKU-CAFE-001',  description: 'Café Molido 500g',   status: 20, scannedAt: new Date(Date.now() - 4 * 60000) },
  ]);

  protected readonly scannedCount = computed(() => this.buffer().length);
  protected readonly expectedTotal = signal(5);

  // Mock DB para validación
  private readonly MOCK_ITEMS: Record<string, { sku: string; description: string; status: 20 }> = {
    'SSCC-0003': { sku: 'SKU-AGUA-002',    description: 'Agua Purificada 19L',   status: 20 },
    'SSCC-0004': { sku: 'SKU-LECHE-003',   description: 'Leche Entera UHT 1L',  status: 20 },
    'SSCC-0005': { sku: 'SKU-LECHE-003',   description: 'Leche Entera UHT 1L',  status: 20 },
  };

  ngAfterViewInit(): void {
    // Auto-focus en el input oculto para capturar el láser
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
    const codes = Object.keys(this.MOCK_ITEMS);
    const unscanned = codes.filter(c => !this.buffer().find(b => b.sscc === c));
    if (unscanned.length > 0) {
      this.processCode(unscanned[0]);
    } else {
      this.processCode('SSCC-UNKNOWN-999');
    }
  }

  private processCode(code: string): void {
    this.lastError.set(null);

    // Verifica si ya fue escaneado
    if (this.buffer().find(b => b.sscc === code)) {
      this.lastError.set(`⚠ Duplicado: ${code} ya fue escaneado`);
      return;
    }

    const item = this.MOCK_ITEMS[code];
    if (!item) {
      this.lastError.set(`❌ SSCC no reconocido: ${code}`);
      return;
    }

    this.isProcessing.set(true);
    setTimeout(() => {
      this.buffer.update(buf => [
        ...buf,
        { sscc: code, sku: item.sku, description: item.description, status: 10, scannedAt: new Date() },
      ]);
      this.isProcessing.set(false);
    }, 300);
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  protected getStatusLabel(status: number): string {
    return status === 10 ? 'Andén' : 'Bolsa';
  }
}
