/**
 * @file blocks-submodule.component.ts
 * @description Submódulo 1 de Calidad: Gestión de Bloqueos y Producto No Conforme en 4 Etapas (Diagrama 1).
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QualityStateService } from '../../services/quality-state.service';
import {
  QualityBlockItem,
  DetectionStage,
  DefectCategory,
  DETECTION_STAGE_LABELS,
  DEFECT_CATEGORY_LABELS
} from '../../models/quality.models';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';
import { QualityInspectionModalComponent } from '../../components/quality-inspection-modal/quality-inspection-modal.component';
import { Item, InventoryStatus, UnitOfMeasure } from '@4guard/shared-core';

export interface CatalogProductItem {
  sku: string;
  description: string;
  unitOfMeasure: UnitOfMeasure;
  defaultLocation: string;
  defaultStage: DetectionStage;
}

export interface AvailableInventoryOption {
  id: string;
  sourceType: 'INBOUND' | 'STORAGE' | 'OUTBOUND' | 'QA_TEST' | 'MANUAL';
  groupLabel: string;
  sku: string;
  description: string;
  clientName: string;
  batchNumber: string;
  sscc: string;
  locationId: string;
  availableQty: number;
  unitOfMeasure: UnitOfMeasure;
  suggestedStage: DetectionStage;
  suggestedCategory: DefectCategory;
}

@Component({
  selector: 'fg-blocks-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective, QualityInspectionModalComponent],
  templateUrl: './blocks-submodule.component.html',
  styleUrl: './blocks-submodule.component.css'
})
export class BlocksSubmoduleComponent {
  protected readonly qualityState = inject(QualityStateService);
  private readonly router = inject(Router);

  // Filtros reactivos
  protected readonly selectedStage = signal<DetectionStage | 'ALL'>('ALL');
  protected readonly selectedCategory = signal<DefectCategory | 'ALL'>('ALL');
  protected readonly searchQuery = signal('');
  protected readonly selectedClient = signal('');

  // ── Catálogo Maestro de Clientes / Proveedores y Claves de Producto ──
  protected readonly catalogData: Record<string, CatalogProductItem[]> = {
    'Lala S.A. de C.V.': [
      { sku: 'LALA-MILK-1L', description: 'Leche Lala Entera UHT 1L (Caja 12 pzas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-DOCK-02', defaultStage: 'INBOUND_UNLOAD' },
      { sku: 'LALA-YOG-250G', description: 'Yogurt Griego Lala Fresa 250g (Sixpack x8)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-DOCK-01', defaultStage: 'OUTBOUND_LOAD' },
      { sku: 'LALA-CHEESE-400G', description: 'Queso Panela Lala 400g (Caja 10 pzas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-COLD-01', defaultStage: 'STORAGE' }
    ],
    'Nestlé México S.A.': [
      { sku: '12572733', description: 'COFFEE-MATE ORIGINAL BOTELLA 12X400G', unitOfMeasure: UnitOfMeasure.UNIT, defaultLocation: 'A-01-N1', defaultStage: 'STORAGE' },
      { sku: '12448910', description: 'NESCAFE CLASICO FRASCO 12X200G', unitOfMeasure: UnitOfMeasure.UNIT, defaultLocation: 'B-03-N2', defaultStage: 'STORAGE' },
      { sku: 'NESP-CAPS-10P', description: 'Cápsulas Nespresso Ristretto Intenso x10', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-REC-DOCK-01', defaultStage: 'INBOUND_UNLOAD' }
    ],
    'Bimbo de México S.A.': [
      { sku: 'BIMBO-BREAD-680G', description: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-ISO-01', defaultStage: 'STORAGE' },
      { sku: 'BIMBO-DONAS-6P', description: 'Donitas Bimbo Espolvoreadas (Caja Master 48 pzas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-ISO-02', defaultStage: 'STORAGE' }
    ],
    'Coca-Cola FEMSA': [
      { sku: 'COCA-600ML', description: 'Refresco Coca-Cola Original 600ml (Pack 24)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-REC-DOCK-03', defaultStage: 'INBOUND_UNLOAD' },
      { sku: 'CIEL-1L', description: 'Agua Purificada Ciel 1L (Pack 12)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-STG-DOCK-02', defaultStage: 'OUTBOUND_LOAD' }
    ],
    'Unilever México': [
      { sku: '12345678', description: 'LECHE NIDO ENTERA LATA 12X800G', unitOfMeasure: UnitOfMeasure.UNIT, defaultLocation: 'C-05-N1', defaultStage: 'STORAGE' },
      { sku: 'KNO-POLLO-1KG', description: 'Consomé de Pollo Knorr 1kg (Caja 12 pzas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'D-02-N3', defaultStage: 'STORAGE' }
    ],
    'PharmaCorp México S.A.': [
      { sku: 'PHARMA-VACC-SERUM', description: 'Suero Inmunológico Grado Médico 50ml', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-COLD-02', defaultStage: 'TEST_MATERIAL' },
      { sku: 'PHARMA-SOL-500ML', description: 'Solución Fisiológica Estéril 500ml (Caja 20 pzas)', unitOfMeasure: UnitOfMeasure.BOX, defaultLocation: 'LOC-QM-COLD-03', defaultStage: 'TEST_MATERIAL' }
    ]
  };

  protected readonly catalogClientsList = computed(() => Object.keys(this.catalogData));

  // ── Catálogo de Lotes e Inventario Activo para Selección Rápida ──
  protected readonly availableInventoryOptions: AvailableInventoryOption[] = [
    {
      id: 'inv-inbound-01',
      sourceType: 'INBOUND',
      groupLabel: '1. Recepciones en Andén (Inbound)',
      sku: 'LALA-MILK-1L',
      description: 'Leche Lala Entera UHT 1L (Caja 12 pzas)',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-901',
      sscc: '375010203040500018',
      locationId: 'LOC-QM-DOCK-02',
      availableQty: 120,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'INBOUND_UNLOAD',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-inbound-02',
      sourceType: 'INBOUND',
      groupLabel: '1. Recepciones en Andén (Inbound)',
      sku: 'NESP-CAPS-10P',
      description: 'Cápsulas Nespresso Ristretto Intenso x10',
      clientName: 'Nestlé México S.A.',
      batchNumber: 'LOT-NES-2026-883',
      sscc: '376130369876500025',
      locationId: 'LOC-REC-DOCK-01',
      availableQty: 240,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'INBOUND_UNLOAD',
      suggestedCategory: 'TRANSPORT',
    },
    {
      id: 'inv-inbound-03',
      sourceType: 'INBOUND',
      groupLabel: '1. Recepciones en Andén (Inbound)',
      sku: 'COCA-600ML',
      description: 'Refresco Coca-Cola Original 600ml (Pack 24)',
      clientName: 'Coca-Cola FEMSA',
      batchNumber: 'LOT-KO-2026-114',
      sscc: '375011998877600012',
      locationId: 'LOC-REC-DOCK-03',
      availableQty: 350,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'INBOUND_UNLOAD',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-storage-01',
      sourceType: 'STORAGE',
      groupLabel: '2. Inventario en Racks (Storage)',
      sku: '12572733',
      description: 'COFFEE-MATE ORIGINAL BOTELLA 12X400G',
      clientName: 'Nestlé México S.A.',
      batchNumber: '0376130491001',
      sscc: '376130491001000001',
      locationId: 'A-01-N1',
      availableQty: 480,
      unitOfMeasure: UnitOfMeasure.UNIT,
      suggestedStage: 'STORAGE',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-storage-02',
      sourceType: 'STORAGE',
      groupLabel: '2. Inventario en Racks (Storage)',
      sku: '12448910',
      description: 'NESCAFE CLASICO FRASCO 12X200G',
      clientName: 'Nestlé México S.A.',
      batchNumber: '0376130492001',
      sscc: '376130492001000002',
      locationId: 'B-03-N2',
      availableQty: 480,
      unitOfMeasure: UnitOfMeasure.UNIT,
      suggestedStage: 'STORAGE',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-storage-03',
      sourceType: 'STORAGE',
      groupLabel: '2. Inventario en Racks (Storage)',
      sku: '12345678',
      description: 'LECHE NIDO ENTERA LATA 12X800G',
      clientName: 'Unilever México',
      batchNumber: '0376130493001',
      sscc: '376130493001000003',
      locationId: 'C-05-N1',
      availableQty: 480,
      unitOfMeasure: UnitOfMeasure.UNIT,
      suggestedStage: 'STORAGE',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-storage-04',
      sourceType: 'STORAGE',
      groupLabel: '2. Inventario en Racks (Storage)',
      sku: 'BIMBO-BREAD-680G',
      description: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)',
      clientName: 'Bimbo de México S.A.',
      batchNumber: 'LOT-BIM-2026-902',
      sscc: '375010080031200032',
      locationId: 'LOC-QM-ISO-01',
      availableQty: 80,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'STORAGE',
      suggestedCategory: 'MATERIAL',
    },
    {
      id: 'inv-outbound-01',
      sourceType: 'OUTBOUND',
      groupLabel: '3. Pedidos en Staging de Carga (Outbound)',
      sku: 'LALA-YOG-250G',
      description: 'Yogurt Griego Lala Fresa 250g (Sixpack x8)',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-889',
      sscc: '375019887766500099',
      locationId: 'LOC-QM-DOCK-01',
      availableQty: 200,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'OUTBOUND_LOAD',
      suggestedCategory: 'TRANSPORT',
    },
    {
      id: 'inv-qa-01',
      sourceType: 'QA_TEST',
      groupLabel: '4. Muestras de Laboratorio / Pruebas (QA)',
      sku: 'PHARMA-VACC-SERUM',
      description: 'Suero Inmunológico Grado Médico 50ml',
      clientName: 'PharmaCorp México S.A.',
      batchNumber: 'LOT-PHARMA-2026-77',
      sscc: '375099881122300044',
      locationId: 'LOC-QM-COLD-02',
      availableQty: 30,
      unitOfMeasure: UnitOfMeasure.BOX,
      suggestedStage: 'TEST_MATERIAL',
      suggestedCategory: 'SPECIAL_TREATMENT',
    }
  ];

  // Modal de Nuevo Bloqueo
  protected readonly isCreateModalOpen = signal(false);
  protected readonly selectedInventoryId = signal<string>('inv-inbound-01');
  protected readonly isManualMode = signal(false);
  protected readonly modalSearchTerm = signal('');
  protected readonly isSearchDropdownOpen = signal(false);
  protected readonly modalSupplierFilter = signal<string>('ALL');

  // Datos para modo Catálogo de Claves
  protected readonly modalCatalogClient = signal<string>('Lala S.A. de C.V.');
  protected readonly modalCatalogSku = signal<string>('LALA-MILK-1L');
  protected readonly catalogSkusForSelectedClient = computed(() => this.catalogData[this.modalCatalogClient()] || []);

  protected readonly newBlockStage = signal<DetectionStage>('INBOUND_UNLOAD');
  protected readonly newBlockCategory = signal<DefectCategory>('MATERIAL');
  protected readonly newBlockClient = signal('Lala S.A. de C.V.');
  protected readonly newBlockSku = signal('LALA-MILK-1L');
  protected readonly newBlockDescription = signal('Leche Lala Entera UHT 1L (Caja 12 pzas)');
  protected readonly newBlockBatch = signal('LOT-2026-LALA-901');
  protected readonly newBlockSscc = signal('375010203040500018');
  protected readonly newBlockQty = signal<number>(120);
  protected readonly newBlockLocation = signal('LOC-QM-DOCK-02');
  protected readonly newBlockNotes = signal('');
  protected readonly selectedCriteriaList = signal<string[]>([]);

  // Opciones de inventario disponibles (EXCLUYE automáticamente lotes que ya están bloqueados en el sistema)
  protected readonly unblockedInventoryOptions = computed(() => {
    const blockedSsccs = new Set(
      this.qualityState.blocks()
        .filter(b => b.status === 'BLOCKED' || b.status === 'UNDER_INSPECTION')
        .map(b => b.sscc.toLowerCase())
    );
    const blockedBatches = new Set(
      this.qualityState.blocks()
        .filter(b => b.status === 'BLOCKED' || b.status === 'UNDER_INSPECTION')
        .map(b => b.batchNumber.toLowerCase())
    );

    return this.availableInventoryOptions.filter(opt =>
      !blockedSsccs.has(opt.sscc.toLowerCase()) && !blockedBatches.has(opt.batchNumber.toLowerCase())
    );
  });

  // Item seleccionado actualmente
  protected readonly selectedInventoryItem = computed(() => {
    const id = this.selectedInventoryId();
    return this.availableInventoryOptions.find(opt => opt.id === id) || null;
  });

  // Opciones de inventario filtradas en tiempo real por Proveedor/Cliente + SSCC, Lote, SKU o Ubicación
  protected readonly filteredModalInventoryOptions = computed(() => {
    const term = this.modalSearchTerm().toLowerCase().trim();
    const supplierFilter = this.modalSupplierFilter();
    let list = this.unblockedInventoryOptions();

    if (supplierFilter !== 'ALL') {
      list = list.filter(opt => opt.clientName.toLowerCase().includes(supplierFilter.toLowerCase()));
    }

    if (!term) return list;

    return list.filter(opt =>
      opt.sscc.toLowerCase().includes(term) ||
      opt.batchNumber.toLowerCase().includes(term) ||
      opt.sku.toLowerCase().includes(term) ||
      opt.description.toLowerCase().includes(term) ||
      opt.clientName.toLowerCase().includes(term) ||
      opt.locationId.toLowerCase().includes(term)
    );
  });

  // Modal de Inspección Técnica
  protected readonly isInspectionModalOpen = signal(false);
  protected readonly selectedItemForInspection = signal<Item | null>(null);

  // Lista de etapas para el filtro visual (Pills)
  protected readonly stageFilterOptions: { key: DetectionStage | 'ALL'; label: string; icon: string }[] = [
    { key: 'ALL', label: 'Todas las Etapas', icon: 'apps' },
    { key: 'INBOUND_UNLOAD', label: '1. Descarga (Inbound)', icon: 'move_to_inbox' },
    { key: 'STORAGE', label: '2. Almacenamiento (Rack)', icon: 'shelves' },
    { key: 'OUTBOUND_LOAD', label: '3. Carga (Outbound)', icon: 'local_shipping' },
    { key: 'TEST_MATERIAL', label: '4. Material de Prueba', icon: 'biotech' }
  ];

  // Categorías de defecto permitidas según la etapa de detección (Diagrama de Decisión de Calidad)
  protected readonly allowedCategoriesForStage = computed<{ key: DefectCategory; label: string; icon: string }[]>(() => {
    return this.getAllowedCategoriesForStage(this.newBlockStage());
  });

  protected getAllowedCategoriesForStage(stage: DetectionStage): { key: DefectCategory; label: string; icon: string }[] {
    switch (stage) {
      case 'INBOUND_UNLOAD':
        return [
          { key: 'TRANSPORT', label: 'Defecto de transporte', icon: 'local_shipping' },
          { key: 'DOCUMENTATION', label: 'Documentación incorrecta', icon: 'description' },
          { key: 'MATERIAL', label: 'Defecto de material', icon: 'inventory_2' }
        ];
      case 'STORAGE':
        return [
          { key: 'MATERIAL', label: 'Defecto de material', icon: 'inventory_2' }
        ];
      case 'OUTBOUND_LOAD':
        return [
          { key: 'TRANSPORT', label: 'Defecto de transporte', icon: 'local_shipping' },
          { key: 'MATERIAL', label: 'Defecto de material', icon: 'inventory_2' }
        ];
      case 'TEST_MATERIAL':
        return [
          { key: 'SPECIAL_TREATMENT', label: 'Prueba QA / Tratamiento especial', icon: 'biotech' }
        ];
    }
  }

  // Opciones de criterios según categoría seleccionada en el modal de creación (Diagrama Oficial de Calidad)
  protected readonly defectCriteriaOptions = computed(() => {
    const cat = this.newBlockCategory();
    switch (cat) {
      case 'TRANSPORT':
        return [
          'Camión abierto o con lona en malas condiciones.',
          'Paredes sucias.',
          'Puertas sucias.',
          'Presencia de indicios de plagas.',
          'Presencia de aromas extraños.',
          'Piso sucio, con obstáculos o en malas condiciones.',
          'Presencia de perforaciones.',
          'Llantas en mal estado.'
        ];
      case 'DOCUMENTATION':
        return [
          'Ausencia de certificado de calidad o es incorrecto.',
          'Ausencia de certificado de fumigación o es incorrecto.',
          'Sin remisión o factura.'
        ];
      case 'MATERIAL':
        return [
          'Caduco.',
          'No cumple con especificación.',
          'Embalaje en malas condiciones.',
          'Material sin identificar.',
          'Material con humedad.',
          'Material visualmente inestable.',
          'Material con plaga.',
          'Material colapsado.'
        ];
      case 'SPECIAL_TREATMENT':
        return [
          'Prueba QA.',
          'Material para tratamiento especial.'
        ];
    }
  });

  // Lista de clientes derivados de los datos
  protected readonly clientList = computed(() => {
    const clients = this.qualityState.blocks().map(b => b.clientName);
    return Array.from(new Set(clients));
  });

  // Lotes filtrados reactivamente
  protected readonly filteredBlocks = computed(() => {
    const stage = this.selectedStage();
    const category = this.selectedCategory();
    const client = this.selectedClient();
    const q = this.searchQuery().toLowerCase().trim();

    return this.qualityState.blocks().filter(b => {
      if (stage !== 'ALL' && b.stage !== stage) return false;
      if (category !== 'ALL' && b.defectCategory !== category) return false;
      if (client && b.clientName !== client) return false;
      if (q) {
        return (
          b.folio.toLowerCase().includes(q) ||
          b.sku.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.clientName.toLowerCase().includes(q) ||
          b.defectCriteria.some(c => c.toLowerCase().includes(q))
        );
      }
      return true;
    });
  });

  protected setStageFilter(stage: DetectionStage | 'ALL'): void {
    this.selectedStage.set(stage);
  }

  protected getStageLabel(stage: DetectionStage): string {
    return DETECTION_STAGE_LABELS[stage] || stage;
  }

  protected getCategoryLabel(category: DefectCategory): string {
    return DEFECT_CATEGORY_LABELS[category] || category;
  }

  protected setCategory(category: DefectCategory): void {
    this.newBlockCategory.set(category);
    this.selectedCriteriaList.set([]);
  }

  protected onManualStageChange(stage: DetectionStage): void {
    this.newBlockStage.set(stage);
    const allowed = this.getAllowedCategoriesForStage(stage);
    if (!allowed.some(c => c.key === this.newBlockCategory())) {
      this.newBlockCategory.set(allowed[0].key);
    }
    this.selectedCriteriaList.set([]);
  }

  // ── SELECCIÓN DE LOTE DEL INVENTARIO (CON BÚSQUEDA) ───────────
  protected selectInventoryItem(item: AvailableInventoryOption): void {
    this.selectedInventoryId.set(item.id);
    this.isManualMode.set(false);
    this.isSearchDropdownOpen.set(false);
    this.modalSearchTerm.set('');

    // La etapa se resuelve automáticamente desde la ubicación física/fuente del lote
    this.newBlockStage.set(item.suggestedStage);
    const allowed = this.getAllowedCategoriesForStage(item.suggestedStage);
    const validCategory = allowed.some(c => c.key === item.suggestedCategory)
      ? item.suggestedCategory
      : allowed[0].key;
    this.newBlockCategory.set(validCategory);

    this.newBlockSku.set(item.sku);
    this.newBlockDescription.set(item.description);
    this.newBlockBatch.set(item.batchNumber);
    this.newBlockSscc.set(item.sscc);
    this.newBlockClient.set(item.clientName);
    this.newBlockLocation.set(item.locationId);
    this.newBlockQty.set(item.availableQty);
    this.selectedCriteriaList.set([]);
  }

  protected setModalSupplierFilter(supplier: string): void {
    this.modalSupplierFilter.set(supplier);
  }

  protected activateCatalogMode(): void {
    this.selectedInventoryId.set('CATALOG');
    this.isManualMode.set(true);
    this.isSearchDropdownOpen.set(false);
    this.modalSearchTerm.set('');
    this.onCatalogClientChange(this.catalogClientsList()[0]);
  }

  protected onCatalogClientChange(client: string): void {
    this.modalCatalogClient.set(client);
    this.newBlockClient.set(client);
    const products = this.catalogData[client] || [];
    if (products.length > 0) {
      this.onCatalogSkuChange(products[0].sku);
    }
  }

  protected onCatalogSkuChange(sku: string): void {
    this.modalCatalogSku.set(sku);
    const products = this.catalogData[this.modalCatalogClient()] || [];
    const product = products.find(p => p.sku === sku);
    if (product) {
      this.newBlockSku.set(product.sku);
      this.newBlockDescription.set(product.description);
      this.newBlockLocation.set(product.defaultLocation);
      this.newBlockStage.set(product.defaultStage);
      const allowed = this.getAllowedCategoriesForStage(product.defaultStage);
      this.newBlockCategory.set(allowed[0].key);
      this.newBlockQty.set(100);
      this.newBlockBatch.set(`LOT-${Date.now().toString().slice(-4)}`);
      this.newBlockSscc.set(`3750${Date.now().toString().slice(-14)}`);
      this.selectedCriteriaList.set([]);
    }
  }

  // ── MODAL DE CREACIÓN DE BLOQUEO ─────────────────────────────
  protected openCreateModal(): void {
    this.selectedCriteriaList.set([]);
    this.newBlockNotes.set('');
    this.modalSearchTerm.set('');
    this.modalSupplierFilter.set('ALL');
    this.isSearchDropdownOpen.set(false);

    const available = this.unblockedInventoryOptions();
    if (available.length > 0) {
      this.selectInventoryItem(available[0]);
    } else {
      this.activateCatalogMode();
    }
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  protected toggleCriterion(crit: string): void {
    const current = this.selectedCriteriaList();
    if (current.includes(crit)) {
      this.selectedCriteriaList.set(current.filter(c => c !== crit));
    } else {
      this.selectedCriteriaList.set([...current, crit]);
    }
  }

  protected isCriterionSelected(crit: string): boolean {
    return this.selectedCriteriaList().includes(crit);
  }

  protected saveNewBlock(): void {
    if (this.selectedCriteriaList().length === 0) {
      alert('Debe seleccionar al menos un criterio de defecto para registrar el bloqueo.');
      return;
    }

    this.qualityState.createBlock({
      sku: this.newBlockSku() || 'SKU-GENERIC',
      description: this.newBlockDescription() || `Producto bloqueado (${this.getCategoryLabel(this.newBlockCategory())})`,
      clientId: 'cli-01',
      clientName: this.newBlockClient(),
      batchNumber: this.newBlockBatch(),
      sscc: this.newBlockSscc(),
      quantity: this.newBlockQty() || 50,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: this.newBlockLocation(),
      stage: this.newBlockStage(),
      defectCategory: this.newBlockCategory(),
      defectCriteria: this.selectedCriteriaList(),
      severity: this.selectedCriteriaList().some(c => c.includes('plaga') || c.includes('humedad') || c.includes('Caducó')) ? 'CRITICAL' : 'WARNING',
      status: 'BLOCKED',
      reportedBy: 'Laura Valdés (Auditora QM)',
      notes: this.newBlockNotes() || 'Bloqueo registrado manualmente por inspector de calidad.',
      evidenceFiles: [
        { id: `ev-${Date.now()}`, name: 'evidencia_bloqueo_inspeccion.jpg', size: '1.4 MB', type: 'image', uploadedAt: new Date().toISOString() }
      ]
    });

    this.closeCreateModal();
    alert('¡Lote bloqueado exitosamente! Ha sido registrado como Producto No Conforme en el sistema.');
  }

  // ── MODAL DE INSPECCIÓN TÉCNICA ──────────────────────────────
  protected openInspectionModal(block: QualityBlockItem): void {
    const itemAdapter: Item = {
      id: block.id,
      sku: block.sku,
      description: block.description,
      clientId: block.clientId,
      clientName: block.clientName,
      batchNumber: block.batchNumber,
      expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(),
      quantity: block.quantity,
      unitOfMeasure: block.unitOfMeasure,
      locationId: block.locationId,
      status: block.status === 'BLOCKED' ? InventoryStatus.QM_BLOCKED : InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: block.quantity * 12,
      volumeM3: 1.5,
      barcode: block.sscc.slice(0, 13),
      sscc: block.sscc,
      receivedAt: block.reportedAt,
      lastStatusChangeAt: block.reportedAt,
      notes: block.notes,
      metadata: null
    };

    this.selectedItemForInspection.set(itemAdapter);
    this.isInspectionModalOpen.set(true);
  }

  protected closeInspectionModal(): void {
    this.isInspectionModalOpen.set(false);
    this.selectedItemForInspection.set(null);
  }

  protected handleInspectionStatusUpdate(event: { itemId: string; newStatus: InventoryStatus; notes: string }): void {
    if (event.newStatus === InventoryStatus.AVAILABLE) {
      // Si fue aprobado, redirigir o actualizar
      this.qualityState.blocks.update(list =>
        list.map(b => b.id === event.itemId ? { ...b, status: 'RELEASED', notes: event.notes } : b)
      );
    } else {
      this.qualityState.blocks.update(list =>
        list.map(b => b.id === event.itemId ? { ...b, status: 'BLOCKED', notes: event.notes } : b)
      );
    }
  }

  protected navigateToReleases(block: QualityBlockItem): void {
    this.router.navigate(['/quality/releases'], { queryParams: { blockId: block.id } });
  }
}
