import { Injectable, signal } from '@angular/core';

export interface WarehouseSection {
  id: string;
  branchId: string;
  branchName: string;
  code: string; // short code (max 10 chars)
  name: string; // name (max 100 chars)
}

@Injectable({
  providedIn: 'root'
})
export class SectionService {
  private readonly items = signal<WarehouseSection[]>([
    { id: 'sec-1', branchId: 'br-1', branchName: 'Centro de Distribución Norte', code: 'REC-01', name: 'Área de Recibo' },
    { id: 'sec-2', branchId: 'br-1', branchName: 'Centro de Distribución Norte', code: 'EMB-01', name: 'Área de Embarques' },
    { id: 'sec-3', branchId: 'br-2', branchName: 'Sucursal Metropolitana Sur', code: 'FR-01', name: 'Cámara Fría General' },
    { id: 'sec-4', branchId: 'br-2', branchName: 'Sucursal Metropolitana Sur', code: 'PAS-05', name: 'Pasillo General 05' },
    { id: 'sec-5', branchId: 'br-3', branchName: 'Almacén de Tránsito Pacífico', code: 'XDK-01', name: 'Cross-Docking Central' }
  ]);

  readonly sections = this.items.asReadonly();

  getAll(): WarehouseSection[] {
    return this.items();
  }

  create(section: Omit<WarehouseSection, 'id'>): void {
    const newSec: WarehouseSection = {
      ...section,
      id: `sec-${Date.now()}`
    };
    this.items.update(list => [...list, newSec]);
  }

  update(id: string, updatedFields: Partial<WarehouseSection>): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, ...updatedFields } : item
    ));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }
}
