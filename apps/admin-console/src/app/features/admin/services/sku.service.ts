import { Injectable, signal } from '@angular/core';

export interface ProductSku {
  id: string;
  clientId: string;
  clientName: string;
  code: string; // unique SKU code (max 50 chars)
  name: string; // commercial name (max 200 chars)
  description: string;
  weight: number; // decimal (e.g., 12.500 kg)
  unit: string; // Unit of measure (max 20 chars, e.g., PZA, CAJA, TARIMA)
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SkuService {
  private readonly items = signal<ProductSku[]>([
    {
      id: 'sku-1',
      clientId: 'cli-1',
      clientName: 'Samsung Electronics Latam',
      code: 'SAM-S24-ULTRA',
      name: 'Samsung Galaxy S24 Ultra 512GB',
      description: 'Smartphone insignia con S-Pen, Titanio Gris. Embalaje premium.',
      weight: 0.232,
      unit: 'PZA',
      createdAt: new Date('2025-02-15T10:00:00Z')
    },
    {
      id: 'sku-2',
      clientId: 'cli-2',
      clientName: 'Nestlé Foods Mexico',
      code: 'NES-CAF-200G',
      name: 'Café Nescafé Clásico 200g',
      description: 'Frasco de vidrio de café soluble clásico. 12 piezas por caja.',
      weight: 4.560,
      unit: 'CAJA',
      createdAt: new Date('2025-03-01T11:30:00Z')
    },
    {
      id: 'sku-3',
      clientId: 'cli-3',
      clientName: 'Nike Retail Mexico',
      code: 'NKE-AF1-WHT-10',
      name: 'Nike Air Force 1 White Size 10',
      description: 'Tenis clásicos de cuero blanco. Talla 10 US.',
      weight: 0.950,
      unit: 'PAR',
      createdAt: new Date('2025-04-10T14:45:00Z')
    },
    {
      id: 'sku-4',
      clientId: 'cli-4',
      clientName: 'General Motors Autoparts',
      code: 'GM-ALT-AVE-16',
      name: 'Alternador Aveo 1.6L 12V',
      description: 'Alternador de refacción original Chevrolet Aveo 1.6L. Empacado individualmente.',
      weight: 5.120,
      unit: 'PZA',
      createdAt: new Date('2025-06-20T09:15:00Z')
    }
  ]);

  readonly skus = this.items.asReadonly();

  getAll(): ProductSku[] {
    return this.items();
  }

  create(sku: Omit<ProductSku, 'id' | 'createdAt'>): void {
    const newSku: ProductSku = {
      ...sku,
      id: `sku-${Date.now()}`,
      createdAt: new Date()
    };
    this.items.update(list => [...list, newSku]);
  }

  update(id: string, updatedFields: Partial<ProductSku>): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, ...updatedFields } : item
    ));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }
}
