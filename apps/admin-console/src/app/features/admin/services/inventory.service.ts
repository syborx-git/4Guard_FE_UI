import { Injectable, signal } from '@angular/core';

export type InventoryState = 'AVAILABLE' | 'IN_QUALITY' | 'DAMAGED' | 'QUARANTINE';

export interface InventoryItem {
  id: string;
  orgName: string;
  branchName: string;
  clientName: string;
  sscc: string; // SSCC barcode container code
  skuCode: string;
  skuName: string;
  locationCode: string;
  state: InventoryState;
  quantity: number;
  lotNumber: string;
  manufactureDate: Date | null;
  expirationDate: Date | null;
  sapFolio: string;
  quarantineReason: string;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly items = signal<InventoryItem[]>([
    {
      id: 'inv-1',
      orgName: 'IronShark Logistics',
      branchName: 'Centro de Distribución Norte',
      clientName: 'Samsung Electronics Latam',
      sscc: '375001234567890128',
      skuCode: 'SAM-S24-ULTRA',
      skuName: 'Samsung Galaxy S24 Ultra 512GB',
      locationCode: 'CDN-01 / REC-01 / A-01-01-01',
      state: 'AVAILABLE',
      quantity: 45,
      lotNumber: 'L-SAM-S24U-2025A',
      manufactureDate: new Date('2025-01-15'),
      expirationDate: new Date('2028-01-15'),
      sapFolio: 'SAP-998812',
      quarantineReason: ''
    },
    {
      id: 'inv-2',
      orgName: 'IronShark Logistics',
      branchName: 'Sucursal Metropolitana Sur',
      clientName: 'Nestlé Foods Mexico',
      sscc: '375009876543210984',
      skuCode: 'NES-CAF-200G',
      skuName: 'Café Nescafé Clásico 200g',
      locationCode: 'SMS-02 / FR-01 / F-12-04-02',
      state: 'IN_QUALITY',
      quantity: 120,
      lotNumber: 'L-NES-CAF-2025B',
      manufactureDate: new Date('2025-02-10'),
      expirationDate: new Date('2027-02-10'),
      sapFolio: 'SAP-995400',
      quarantineReason: 'Muestreo aleatorio de humedad en lote'
    },
    {
      id: 'inv-3',
      orgName: 'IronShark Logistics',
      branchName: 'Sucursal Metropolitana Sur',
      clientName: 'Nike Retail Mexico',
      sscc: '375005544332211099',
      skuCode: 'NKE-AF1-WHT-10',
      skuName: 'Nike Air Force 1 White Size 10',
      locationCode: 'SMS-02 / PAS-05 / P-05-08-01',
      state: 'DAMAGED',
      quantity: 12,
      lotNumber: 'L-NKE-AF1-05X',
      manufactureDate: new Date('2025-03-01'),
      expirationDate: null,
      sapFolio: 'SAP-887711',
      quarantineReason: 'Caja exterior maltratada por manipulación en andén'
    },
    {
      id: 'inv-4',
      orgName: 'Omni Retail Corp',
      branchName: 'Almacén de Tránsito Pacífico',
      clientName: 'Nike Retail Mexico',
      sscc: '375001122334455660',
      skuCode: 'NKE-AF1-WHT-10',
      skuName: 'Nike Air Force 1 White Size 10',
      locationCode: 'ATP-04 / XDK-01 / X-02-05-03',
      state: 'AVAILABLE',
      quantity: 350,
      lotNumber: 'L-NKE-AF1-05X',
      manufactureDate: new Date('2025-03-01'),
      expirationDate: null,
      sapFolio: 'SAP-887711',
      quarantineReason: ''
    }
  ]);

  readonly inventoryItems = this.items.asReadonly();

  getAll(): InventoryItem[] {
    return this.items();
  }

  setQuarantineState(id: string, state: InventoryState, reason: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, state, quarantineReason: state !== 'AVAILABLE' ? reason : '' } : item
    ));
  }

  updateQuantity(id: string, newQty: number): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  }
}
