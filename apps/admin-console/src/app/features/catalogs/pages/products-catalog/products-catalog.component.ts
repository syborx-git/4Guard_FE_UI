/**
 * @file products-catalog.component.ts
 * @description Catálogo de Productos / SKUs en 4GUARD WMS.
 * Jerarquía de Pestañas: 1. Alta de Productos -> 2. Inactivación NOM-251 -> 3. Consulta de SKUs.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CatalogsService } from '../../services/catalogs.service';
import {
  CatalogProduct,
  OFFICIAL_4GUARD_SUPPLIERS,
  UOM_OPTIONS,
  UnitOfMeasure,
  getExpirationCriticality,
  ExpirationCriticality,
} from '../../models/products-catalog.models';

type ProductSubTab = 'create' | 'inactivate' | 'consult';

@Component({
  selector: 'fg-products-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './products-catalog.component.html',
  styleUrl: './products-catalog.component.css',
})
export class ProductsCatalogComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly fb = inject(FormBuilder);

  // Jerarquía: Alta por defecto
  protected readonly activeTab = signal<ProductSubTab>('create');

  // Filtros
  protected readonly statusFilter = signal<string>('ALL');
  protected readonly supplierFilter = signal<string>('ALL');
  protected readonly uomFilter = signal<string>('ALL');
  protected readonly searchTerm = signal<string>('');

  // Modal Selector de Proveedores
  protected readonly showSupplierModal = signal<boolean>(false);
  protected readonly selectedSupplierForForm = signal<string>('');

  // Toast alert
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  protected readonly officialSuppliers: string[] = OFFICIAL_4GUARD_SUPPLIERS;
  protected readonly uomOptions = UOM_OPTIONS;

  // Formulario Alta de Productos
  protected readonly productForm = this.fb.group({
    sku: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(5)]],
    lotNumber: ['LOT-2026-N1', [Validators.required]],
    supplier: ['', [Validators.required]],
    uom: ['CAJ' as UnitOfMeasure, [Validators.required]],
    expirationDays: [365, [Validators.required, Validators.min(1)]],
  });

  protected readonly filteredProducts = computed(() => {
    const list = this.catalogsService.products();
    const sFilter = this.statusFilter();
    const supFilter = this.supplierFilter();
    const uFilter = this.uomFilter();
    const query = this.searchTerm().toLowerCase().trim();

    return list.filter((p) => {
      const matchStatus = sFilter === 'ALL' || p.status === sFilter;
      const matchSupplier = supFilter === 'ALL' || p.supplier === supFilter;
      const matchUom = uFilter === 'ALL' || p.uom === uFilter;
      const matchQuery =
        !query ||
        p.sku.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.lotNumber.toLowerCase().includes(query) ||
        p.supplier.toLowerCase().includes(query);

      return matchStatus && matchSupplier && matchUom && matchQuery;
    });
  });

  getBadgeCriticality(days: number): ExpirationCriticality {
    return getExpirationCriticality(days);
  }

  openSupplierModal(): void {
    this.showSupplierModal.set(true);
  }

  closeSupplierModal(): void {
    this.showSupplierModal.set(false);
  }

  selectSupplier(supplierName: string): void {
    this.productForm.patchValue({ supplier: supplierName });
    this.selectedSupplierForForm.set(supplierName);
    this.closeSupplierModal();
  }

  onSubmitCreateProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const val = this.productForm.value;
    this.catalogsService.createProduct({
      sku: val.sku!,
      description: val.description!,
      lotNumber: val.lotNumber!,
      supplier: val.supplier!,
      uom: val.uom as UnitOfMeasure,
      expirationDays: val.expirationDays!,
    });

    this.showToast('success', `SKU ${val.sku} registrado exitosamente con caducidad a ${val.expirationDays} días.`);
    this.productForm.reset({ uom: 'CAJ', expirationDays: 365, lotNumber: 'LOT-2026-N1' });
    this.activeTab.set('consult');
  }

  onToggleStatus(product: CatalogProduct): void {
    this.catalogsService.toggleProductStatus(product.id);
    const newSt = product.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.showToast(
      'success',
      `Estatus de SKU ${product.sku} cambiado a ${newSt} (Conmutación NOM-251 sin borrado físico).`
    );
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
