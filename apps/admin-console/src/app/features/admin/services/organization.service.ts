import { Injectable, signal } from '@angular/core';

export type OrganizationType = 'WAREHOUSE' | 'DISTRIBUTION' | 'MANUFACTURING' | 'RETAIL' | 'LOGISTICS' | 'THIRD_PARTY';
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

export interface Organization {
  id: string;
  name: string;
  code: string; // unique, locked in edit
  taxId: string;
  type: OrganizationType;
  status: OrganizationStatus;
  settings: string; // JSON string
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly items = signal<Organization[]>([
    {
      id: 'org-1',
      name: 'IronShark Logistics',
      code: 'IRN-LOG',
      taxId: 'ISL120908AA3',
      type: 'LOGISTICS',
      status: 'ACTIVE',
      settings: '{\n  "allowCrossDocking": true,\n  "maxWeightCapacityKg": 500000\n}',
      createdAt: new Date('2025-01-10T08:00:00Z')
    },
    {
      id: 'org-2',
      name: 'Omni Retail Corp',
      code: 'OMNI-RET',
      taxId: 'ORC150423BB9',
      type: 'RETAIL',
      status: 'ACTIVE',
      settings: '{\n  "autoReplenish": true,\n  "preferredCarrier": "DHL"\n}',
      createdAt: new Date('2025-03-15T09:30:00Z')
    },
    {
      id: 'org-3',
      name: 'Apex Manufacturing',
      code: 'APX-MFG',
      taxId: 'AMF201130CC5',
      type: 'MANUFACTURING',
      status: 'INACTIVE',
      settings: '{\n  "qualityControlRate": 0.15\n}',
      createdAt: new Date('2025-06-01T14:15:00Z')
    }
  ]);

  readonly organizations = this.items.asReadonly();

  getAll(): Organization[] {
    return this.items();
  }

  create(org: Omit<Organization, 'id' | 'createdAt'>): void {
    const newOrg: Organization = {
      ...org,
      id: `org-${Date.now()}`,
      createdAt: new Date()
    };
    this.items.update(list => [...list, newOrg]);
  }

  update(id: string, updatedFields: Partial<Organization>): void {
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
