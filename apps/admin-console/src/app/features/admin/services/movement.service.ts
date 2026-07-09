import { Injectable, signal } from '@angular/core';

export type MovementType = 'RECEIPT' | 'INTERNAL_TRANSFER' | 'ADJUSTMENT' | 'DISPATCH';

export interface InventoryMovement {
  id: string;
  timestamp: Date;
  type: MovementType;
  sscc: string;
  originLocation: string;
  destinationLocation: string;
  username: string;
  reason: string;
}

@Injectable({
  providedIn: 'root'
})
export class MovementService {
  private readonly items = signal<InventoryMovement[]>([
    {
      id: 'mov-1',
      timestamp: new Date('2026-07-06T14:32:00'),
      type: 'RECEIPT',
      sscc: '375001234567890128',
      originLocation: 'ANDÉN DE RECIBO #1',
      destinationLocation: 'CDN-01 / REC-01 / A-01-01-01',
      username: 'carlos.mendoza',
      reason: 'Ingreso inicial por Orden de Compra OC-2026-009'
    },
    {
      id: 'mov-2',
      timestamp: new Date('2026-07-06T15:45:00'),
      type: 'INTERNAL_TRANSFER',
      sscc: '375009876543210984',
      originLocation: 'ANDÉN DE RECIBO #1',
      destinationLocation: 'SMS-02 / FR-01 / F-12-04-02',
      username: 'jorge.rojas',
      reason: 'Reubicación por optimización de zona (cámara fría)'
    },
    {
      id: 'mov-3',
      timestamp: new Date('2026-07-06T16:10:00'),
      type: 'ADJUSTMENT',
      sscc: '375005544332211099',
      originLocation: 'SMS-02 / PAS-05 / P-05-08-01',
      destinationLocation: 'SMS-02 / PAS-05 / P-05-08-01',
      username: 'enrique',
      reason: 'Ajuste negativo de cantidad por merma física (caja rota)'
    },
    {
      id: 'mov-4',
      timestamp: new Date('2026-07-06T18:22:00'),
      type: 'DISPATCH',
      sscc: '375001122334455660',
      originLocation: 'ATP-04 / XDK-01 / X-02-05-03',
      destinationLocation: 'ANDÉN DE EMBARQUE #3',
      username: 'ana.gomez',
      reason: 'Salida de mercancía asociada a Pedido de Venta SO-4819'
    }
  ]);

  readonly movements = this.items.asReadonly();

  getAll(): InventoryMovement[] {
    return this.items();
  }

  // Append-only logs
  addLog(log: Omit<InventoryMovement, 'id' | 'timestamp'>): void {
    const newLog: InventoryMovement = {
      ...log,
      id: `mov-${Date.now()}`,
      timestamp: new Date()
    };
    this.items.update(list => [newLog, ...list]); // newest first
  }
}
