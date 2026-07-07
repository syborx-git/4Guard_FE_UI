import { Injectable, signal } from '@angular/core';

export type LocationType = 'PALLET' | 'BIN' | 'SHELF' | 'RAMP';

export interface Location {
  id: string;
  branchId: string;
  branchName: string;
  sectionId: string;
  sectionName: string;
  zone: string;
  aisle: string;
  rack: string;
  position: string;
  level: number;
  coordX: number;
  coordY: number;
  coordZ: number;
  type: LocationType;
  capacityUnits: number;
  isBlocked: boolean;
  blockReason: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly items = signal<Location[]>([
    {
      id: 'loc-1',
      branchId: 'br-1',
      branchName: 'Centro de Distribución Norte',
      sectionId: 'sec-1',
      sectionName: 'Área de Recibo',
      zone: 'A',
      aisle: '01',
      rack: '01',
      position: '01',
      level: 1,
      coordX: 10,
      coordY: 5,
      coordZ: 2,
      type: 'PALLET',
      capacityUnits: 2,
      isBlocked: false,
      blockReason: ''
    },
    {
      id: 'loc-2',
      branchId: 'br-1',
      branchName: 'Centro de Distribución Norte',
      sectionId: 'sec-2',
      sectionName: 'Área de Embarques',
      zone: 'E',
      aisle: '02',
      rack: '05',
      position: '03',
      level: 2,
      coordX: 15,
      coordY: 8,
      coordZ: 4,
      type: 'RAMP',
      capacityUnits: 1,
      isBlocked: false,
      blockReason: ''
    },
    {
      id: 'loc-3',
      branchId: 'br-2',
      branchName: 'Sucursal Metropolitana Sur',
      sectionId: 'sec-3',
      sectionName: 'Cámara Fría General',
      zone: 'F',
      aisle: '12',
      rack: '04',
      position: '02',
      level: 3,
      coordX: 45,
      coordY: 15,
      coordZ: 6,
      type: 'SHELF',
      capacityUnits: 5,
      isBlocked: true,
      blockReason: 'Mantenimiento preventivo de refrigeración'
    },
    {
      id: 'loc-4',
      branchId: 'br-2',
      branchName: 'Sucursal Metropolitana Sur',
      sectionId: 'sec-4',
      sectionName: 'Pasillo General 05',
      zone: 'P',
      aisle: '05',
      rack: '08',
      position: '01',
      level: 1,
      coordX: 30,
      coordY: 22,
      coordZ: 1,
      type: 'BIN',
      capacityUnits: 10,
      isBlocked: false,
      blockReason: ''
    }
  ]);

  readonly locations = this.items.asReadonly();

  getAll(): Location[] {
    return this.items();
  }

  create(loc: Omit<Location, 'id'>): void {
    const newLoc: Location = {
      ...loc,
      id: `loc-${Date.now()}`
    };
    this.items.update(list => [...list, newLoc]);
  }

  update(id: string, updatedFields: Partial<Location>): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, ...updatedFields } : item
    ));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }

  toggleBlock(id: string, isBlocked: boolean, reason: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, isBlocked, blockReason: isBlocked ? reason : '' } : item
    ));
  }
}
