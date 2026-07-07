import { Injectable, signal } from '@angular/core';

export type IncidenceType = 'DAMAGE' | 'EXPIRATION' | 'LOSS' | 'SHORTAGE';
export type IncidenceSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type IncidenceStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface Incidence {
  id: string;
  folio: string; // INC-YYYY-XXX
  sscc: string;
  type: IncidenceType;
  severity: IncidenceSeverity;
  reporterUsername: string;
  status: IncidenceStatus;
  createdAt: Date;
  description: string;
  resolvedAt: Date | null;
  resolutionNotes: string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidenceService {
  private readonly items = signal<Incidence[]>([
    {
      id: 'inc-1',
      folio: 'INC-2026-001',
      sscc: '375005544332211099',
      type: 'DAMAGE',
      severity: 'CRITICAL',
      reporterUsername: 'jorge.rojas',
      status: 'OPEN',
      createdAt: new Date('2026-07-06T10:00:00'),
      description: 'Pallet inclinado con cajas maltratadas en nivel 3 del pasillo general.',
      resolvedAt: null,
      resolutionNotes: ''
    },
    {
      id: 'inc-2',
      folio: 'INC-2026-002',
      sscc: '375009876543210984',
      type: 'SHORTAGE',
      severity: 'WARNING',
      reporterUsername: 'carlos.mendoza',
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-07-05T14:20:00'),
      description: 'Diferencia física de stock detectada en recibo: se reportan 122 cajas pero solo llegaron 120.',
      resolvedAt: null,
      resolutionNotes: ''
    },
    {
      id: 'inc-3',
      folio: 'INC-2026-003',
      sscc: '375001234567890128',
      type: 'EXPIRATION',
      severity: 'INFO',
      reporterUsername: 'ana.gomez',
      status: 'CLOSED',
      createdAt: new Date('2026-07-01T09:15:00'),
      description: 'Lote próximo a vencer en menos de 45 días.',
      resolvedAt: new Date('2026-07-02T11:00:00'),
      resolutionNotes: 'Se liberó con descuento comercial y se priorizó en órdenes de salida PEPS (FIFO).'
    }
  ]);

  readonly incidences = this.items.asReadonly();

  getAll(): Incidence[] {
    return this.items();
  }

  create(incidence: Omit<Incidence, 'id' | 'folio' | 'createdAt' | 'resolvedAt' | 'resolutionNotes'>): void {
    const list = this.items();
    const count = list.length + 1;
    const year = new Date().getFullYear();
    const folioStr = `INC-${year}-${String(count).padStart(3, '0')}`;

    const newInc: Incidence = {
      ...incidence,
      id: `inc-${Date.now()}`,
      folio: folioStr,
      createdAt: new Date(),
      resolvedAt: null,
      resolutionNotes: ''
    };
    this.items.update(l => [newInc, ...l]);
  }

  updateStatus(id: string, status: IncidenceStatus, resolutionNotes: string): void {
    this.items.update(list => list.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status,
          resolutionNotes,
          resolvedAt: status === 'CLOSED' ? new Date() : null
        };
      }
      return item;
    }));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }
}
