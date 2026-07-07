import { Injectable, signal } from '@angular/core';

export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface Branch {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: BranchStatus;
}

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private readonly items = signal<Branch[]>([
    {
      id: 'br-1',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      name: 'Centro de Distribución Norte',
      code: 'CDN-01',
      timezone: 'America/Mexico_City',
      addressLine1: 'Av. Industrial 500, Monterrey, NL',
      status: 'ACTIVE'
    },
    {
      id: 'br-2',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      name: 'Sucursal Metropolitana Sur',
      code: 'SMS-02',
      timezone: 'America/Mexico_City',
      addressLine1: 'Calzada de la Viga 1200, CDMX',
      status: 'ACTIVE'
    },
    {
      id: 'br-3',
      orgId: 'org-2',
      orgName: 'Omni Retail Corp',
      name: 'Almacén de Tránsito Pacífico',
      code: 'ATP-04',
      timezone: 'America/Tijuana',
      addressLine1: 'Carretera Transpeninsular km 12, Tijuana, BC',
      status: 'ACTIVE'
    },
    {
      id: 'br-4',
      orgId: 'org-3',
      orgName: 'Apex Manufacturing',
      name: 'Planta Bajío',
      code: 'PBJ-03',
      timezone: 'America/Mexico_City',
      addressLine1: 'Parque Industrial Silao, Gto',
      status: 'INACTIVE'
    }
  ]);

  readonly branches = this.items.asReadonly();

  getAll(): Branch[] {
    return this.items();
  }

  create(branch: Omit<Branch, 'id'>): void {
    const newBranch: Branch = {
      ...branch,
      id: `br-${Date.now()}`
    };
    this.items.update(list => [...list, newBranch]);
  }

  update(id: string, updatedFields: Partial<Branch>): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, ...updatedFields } : item
    ));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }

  toggleStatus(id: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : item
    ));
  }
}
