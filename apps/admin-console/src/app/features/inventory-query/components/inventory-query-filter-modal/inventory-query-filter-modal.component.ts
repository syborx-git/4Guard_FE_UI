/**
 * @file inventory-query-filter-modal.component.ts
 * @description Componente Modal de Filtros Multicriterio para Consulta de Inventarios en 4GUARD WMS.
 * Incluye rangos de fechas, buscadores con autocompletado, dropdowns de tarimas y los 3 radio buttons de Regla de Pablo.
 */

import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  InventoryFilterCriteria,
  PalletType,
  LabeledStatus,
  ExpirationFilterMode,
  ExpirationBadgeStatus
} from '../../models/inventory-query.models';
import { InventoryQueryService } from '../../services/inventory-query.service';

@Component({
  selector: 'fg-inventory-query-filter-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventory-query-filter-modal.component.html',
  styleUrl: './inventory-query-filter-modal.component.css'
})
export class InventoryQueryFilterModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  protected readonly inventoryService = inject(InventoryQueryService);

  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  protected filterForm!: FormGroup;

  // Multi-select arrays
  protected selectedSkus: string[] = [];
  protected selectedWarehouses: string[] = [];
  protected selectedExpirationStatuses: ExpirationBadgeStatus[] = [];
  protected skuSearchTerm = '';

  // Opciones de Dropdowns oficiales 4GUARD (7 tipos maestros)
  protected readonly palletTypes: PalletType[] = [
    'MADERA OWENS',
    'MADERA ESTANDAR',
    'PLASTICO NEGRO OWENS',
    'PLASTICO AZUL',
    'TARIMA CHEP NACIONAL',
    'TARIMA CHEP EXPORTACION',
    'TARIMA PLASTICO NEGRO ESTANDAR',
  ];

  protected readonly labeledStatuses: LabeledStatus[] = [
    'ETIQUETADO',
    'PENDIENTE',
    'OBSOLETO'
  ];

  // Lista de sugerencias para Autocompletado de Producto
  protected productSuggestions: string[] = [];
  protected showSuggestions = false;

  ngOnInit(): void {
    const active = this.inventoryService.activeFilters();

    this.selectedSkus = active.selectedSkus ? [...active.selectedSkus] : [];
    this.selectedWarehouses = active.selectedWarehouses ? [...active.selectedWarehouses] : [];
    this.selectedExpirationStatuses = active.selectedExpirationStatuses ? [...active.selectedExpirationStatuses] : [];

    this.filterForm = this.fb.group({
      entryDateFrom: [active.entryDateFrom || ''],
      entryDateTo: [active.entryDateTo || ''],
      elaborationDateFrom: [active.elaborationDateFrom || ''],
      elaborationDateTo: [active.elaborationDateTo || ''],
      expirationDateFrom: [active.expirationDateFrom || ''],
      expirationDateTo: [active.expirationDateTo || ''],

      remision: [active.remision || ''],
      sku: [active.sku || ''],
      productDescription: [active.productDescription || ''],
      location: [active.location || ''],
      supplier: [active.supplier || ''],
      client: [active.client || ''],

      palletType: [active.palletType || ''],
      labeledStatus: [active.labeledStatus || ''],

      expirationMode: [active.expirationMode || 'GENERAL']
    });

    // Cargar sugerencias dinámicas de productos desde el inventario
    const allProducts = Array.from(
      new Set(this.inventoryService.rawInventory().map((r) => r.productDescription))
    );
    this.productSuggestions = allProducts;
  }

  // --- MULTI-SELECT HANDLERS ---
  protected toggleSku(sku: string): void {
    if (this.selectedSkus.includes(sku)) {
      this.selectedSkus = this.selectedSkus.filter((s) => s !== sku);
    } else {
      this.selectedSkus = [...this.selectedSkus, sku];
    }
  }

  protected isSkuSelected(sku: string): boolean {
    return this.selectedSkus.includes(sku);
  }

  protected toggleWarehouse(wh: string): void {
    if (this.selectedWarehouses.includes(wh)) {
      this.selectedWarehouses = this.selectedWarehouses.filter((w) => w !== wh);
    } else {
      this.selectedWarehouses = [...this.selectedWarehouses, wh];
    }
  }

  protected isWarehouseSelected(wh: string): boolean {
    return this.selectedWarehouses.includes(wh);
  }

  protected toggleExpirationStatus(st: ExpirationBadgeStatus): void {
    if (this.selectedExpirationStatuses.includes(st)) {
      this.selectedExpirationStatuses = this.selectedExpirationStatuses.filter((s) => s !== st);
    } else {
      this.selectedExpirationStatuses = [...this.selectedExpirationStatuses, st];
    }
  }

  protected isExpirationStatusSelected(st: ExpirationBadgeStatus): boolean {
    return this.selectedExpirationStatuses.includes(st);
  }

  protected filteredAvailableSkus(): { sku: string; description: string; count: number }[] {
    const list = this.inventoryService.distinctSkus();
    if (!this.skuSearchTerm.trim()) return list;
    const term = this.skuSearchTerm.toUpperCase().trim();
    return list.filter(
      (s) => s.sku.toUpperCase().includes(term) || s.description.toUpperCase().includes(term)
    );
  }

  protected onSkuSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.skuSearchTerm = input.value;
  }

  protected selectProductSuggestion(desc: string): void {
    this.filterForm.patchValue({ productDescription: desc });
    this.showSuggestions = false;
  }

  protected onApplyFilters(): void {
    const val = this.filterForm.value as InventoryFilterCriteria;
    val.selectedSkus = this.selectedSkus.length > 0 ? this.selectedSkus : undefined;
    val.selectedWarehouses = this.selectedWarehouses.length > 0 ? this.selectedWarehouses : undefined;
    val.selectedExpirationStatuses = this.selectedExpirationStatuses.length > 0 ? this.selectedExpirationStatuses : undefined;

    this.inventoryService.setFilters(val);
    this.closeModal.emit();
  }

  protected onClearFilters(): void {
    this.selectedSkus = [];
    this.selectedWarehouses = [];
    this.selectedExpirationStatuses = [];
    this.skuSearchTerm = '';

    this.filterForm.reset({
      entryDateFrom: '',
      entryDateTo: '',
      elaborationDateFrom: '',
      elaborationDateTo: '',
      expirationDateFrom: '',
      expirationDateTo: '',
      remision: '',
      sku: '',
      productDescription: '',
      location: '',
      supplier: '',
      client: '',
      palletType: '',
      labeledStatus: '',
      expirationMode: 'GENERAL'
    });
    this.inventoryService.clearFilters();
  }

  protected onClose(): void {
    this.closeModal.emit();
  }
}
