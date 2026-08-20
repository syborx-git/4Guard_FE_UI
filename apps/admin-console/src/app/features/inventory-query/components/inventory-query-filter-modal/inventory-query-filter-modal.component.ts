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
  ExpirationFilterMode
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
  private readonly inventoryService = inject(InventoryQueryService);

  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  protected filterForm!: FormGroup;

  // Opciones de Dropdowns oficiales 4GUARD
  protected readonly palletTypes: PalletType[] = [
    'CHEP',
    'MADERA',
    'PLASTICO',
    'SUPERIOR',
    'EURO',
    'RETORNABLE',
    'ESTANDAR'
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

  protected selectProductSuggestion(desc: string): void {
    this.filterForm.patchValue({ productDescription: desc });
    this.showSuggestions = false;
  }

  protected onApplyFilters(): void {
    const val = this.filterForm.value as InventoryFilterCriteria;
    this.inventoryService.setFilters(val);
    this.closeModal.emit();
  }

  protected onClearFilters(): void {
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
