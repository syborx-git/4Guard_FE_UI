import { Injectable, signal } from '@angular/core';

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export interface Client {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  externalId: string; // SAP/ERP integration code (max 50 chars)
  status: ClientStatus;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly items = signal<Client[]>([
    {
      id: 'cli-1',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      name: 'Samsung Electronics Latam',
      externalId: 'SAP-SAM-99',
      status: 'ACTIVE'
    },
    {
      id: 'cli-2',
      orgId: 'org-1',
      orgName: 'IronShark Logistics',
      name: 'Nestlé Foods Mexico',
      externalId: 'SAP-NES-44',
      status: 'ACTIVE'
    },
    {
      id: 'cli-3',
      orgId: 'org-2',
      orgName: 'Omni Retail Corp',
      name: 'Nike Retail Mexico',
      externalId: 'ERP-NKE-10',
      status: 'ACTIVE'
    },
    {
      id: 'cli-4',
      orgId: 'org-3',
      orgName: 'Apex Manufacturing',
      name: 'General Motors Autoparts',
      externalId: 'ERP-GM-550',
      status: 'INACTIVE'
    }
  ]);

  readonly clients = this.items.asReadonly();

  getAll(): Client[] {
    return this.items();
  }

  create(client: Omit<Client, 'id'>): void {
    const newClient: Client = {
      ...client,
      id: `cli-${Date.now()}`
    };
    this.items.update(list => [...list, newClient]);
  }

  update(id: string, updatedFields: Partial<Client>): void {
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
