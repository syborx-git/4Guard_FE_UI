/**
 * @file layout-management.component.ts
 * @description HU-127 — Gestión de Layout y Ubicaciones.
 *
 * Módulo administrativo maestro de configuración de ubicaciones físicas del
 * almacén 4GUARD WMS. Proporciona el catálogo de ubicaciones que consume el
 * resto del sistema: Recepción, Calidad, Inventario, Picking y Embarques.
 *
 * Arquitectura:
 * - Standalone Component con Angular Signals
 * - ReactiveForm con validaciones progresivas
 * - Árbol jerárquico construido dinámicamente desde computed()
 * - LayoutService desacoplado (intercambiable HTTP/mock)
 * - ToastService existente para notificaciones
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule, NgTemplateOutlet } from '@angular/common';

import { ToastService } from '../../../core/services/toast.service';
import { LayoutService } from '../services/layout.service';
import {
  WarehouseLocation,
  LocationTreeNode,
  LocationStatus,
  LocationAuditEntry,
  WarehouseZone,
  CreateLocationPayload,
  UpdateLocationPayload,
  ChangeStatusPayload,
  CAPACITY_UNIT_LABELS,
  LOCATION_TYPE_LABELS,
  LOGISTIC_FUNCTION_LABELS,
  LOCATION_STATUS_LABELS,
  LOCATION_FSM_TRANSITIONS,
  STATUS_REQUIRES_REASON,
  CapacityUnit,
  LocationType,
  LogisticFunction,
} from '../models/warehouse-location.model';

// ── Validator: código de ubicación ───────────────────────────────────────────
function locationCodeValidator(ctrl: AbstractControl): ValidationErrors | null {
  const val = ctrl.value as string;
  if (!val) return null;
  return /^[A-Z0-9\-]+$/.test(val) ? null : { invalidCode: true };
}

@Component({
  selector:        'fg-layout-management',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule, ReactiveFormsModule, NgTemplateOutlet],
  templateUrl:     './layout-management.component.html',
  styleUrl:        './layout-management.component.css',
})
export class LayoutManagementComponent implements OnInit {

  // ── Dependencias ───────────────────────────────────────────────────────────
  private readonly layoutSvc = inject(LayoutService);
  private readonly toastSvc  = inject(ToastService);
  private readonly fb        = inject(FormBuilder);

  // ── Exposición de enums al template ───────────────────────────────────────
  readonly CAPACITY_UNIT_LABELS       = CAPACITY_UNIT_LABELS;
  readonly LOCATION_TYPE_LABELS       = LOCATION_TYPE_LABELS;
  readonly LOGISTIC_FUNCTION_LABELS   = LOGISTIC_FUNCTION_LABELS;
  readonly LOCATION_STATUS_LABELS     = LOCATION_STATUS_LABELS;
  readonly capacityUnits   = Object.keys(CAPACITY_UNIT_LABELS) as CapacityUnit[];
  readonly locationTypes   = Object.keys(LOCATION_TYPE_LABELS) as LocationType[];
  readonly logisticFunctions = Object.keys(LOGISTIC_FUNCTION_LABELS) as LogisticFunction[];
  readonly allStatuses     = Object.keys(LOCATION_STATUS_LABELS) as LocationStatus[];

  // ── Estado de datos ────────────────────────────────────────────────────────
  readonly isLoading   = signal(true);
  readonly locations   = signal<WarehouseLocation[]>([]);
  readonly zones       = signal<WarehouseZone[]>([]);
  readonly selectedId  = signal<string | null>(null);

  readonly selectedLoc = computed<WarehouseLocation | null>(() =>
    this.locations().find(l => l.id === this.selectedId()) ?? null
  );

  // ── Estado del árbol ───────────────────────────────────────────────────────
  readonly searchTerm    = signal('');
  readonly statusFilter  = signal<LocationStatus | 'ALL'>('ALL');
  readonly zoneFilter    = signal<string>('ALL');
  readonly expandedNodes = signal<Set<string>>(new Set(['Z-001', 'Z-002', 'Z-003', 'Z-004']));

  /** Árbol jerárquico — construido 100% dinámicamente desde los datos */
  readonly locationTree = computed<LocationTreeNode[]>(() => {
    const search = this.searchTerm().toLowerCase().trim();
    const sFilt  = this.statusFilter();
    const zFilt  = this.zoneFilter();
    const expanded = this.expandedNodes();

    // 1. Filtrar ubicaciones
    let filtered = this.locations();
    if (sFilt !== 'ALL') {
      filtered = filtered.filter(l => l.status === sFilt);
    }
    if (zFilt !== 'ALL') {
      filtered = filtered.filter(l => l.zoneId === zFilt);
    }
    if (search) {
      filtered = filtered.filter(l =>
        l.code.toLowerCase().includes(search) ||
        l.name.toLowerCase().includes(search) ||
        l.zoneName.toLowerCase().includes(search)
      );
    }

    // 2. Agrupar por zona → pasillo → bahía → leaf
    const zoneMap = new Map<string, Map<string, Map<string, WarehouseLocation[]>>>();

    for (const loc of filtered) {
      const zoneKey  = `${loc.zoneId}::${loc.zoneName}`;
      const aisleKey = loc.aisle ?? '__NONE__';
      const bayKey   = loc.bay   ?? '__NONE__';

      if (!zoneMap.has(zoneKey)) zoneMap.set(zoneKey, new Map());
      const aisleMap = zoneMap.get(zoneKey)!;

      if (!aisleMap.has(aisleKey)) aisleMap.set(aisleKey, new Map());
      const bayMap = aisleMap.get(aisleKey)!;

      if (!bayMap.has(bayKey)) bayMap.set(bayKey, []);
      bayMap.get(bayKey)!.push(loc);
    }

    // 3. Construir nodos
    const tree: LocationTreeNode[] = [];

    for (const [zoneKey, aisleMap] of zoneMap) {
      const [zoneId, zoneName] = zoneKey.split('::');
      const zoneNode = this._buildZoneNode(zoneId, zoneName, aisleMap, expanded);
      tree.push(zoneNode);
    }

    return tree;
  });

  // ── KPIs — derivados del catálogo ─────────────────────────────────────────
  readonly kpiTotal       = computed(() => this.locations().length);
  readonly kpiActive      = computed(() => this.locations().filter(l => l.status === 'ACTIVE').length);
  readonly kpiBlocked     = computed(() => this.locations().filter(l => l.status === 'BLOCKED').length);
  readonly kpiMaintenance = computed(() => this.locations().filter(l => l.status === 'MAINTENANCE').length);

  /**
   * Capacidad utilizada global — depende de datos del módulo de Inventario.
   * Si los registros no tienen currentOccupancy, se retorna null (no disponible).
   */
  readonly kpiOccupancy = computed<number | null>(() => {
    const locs = this.locations();
    const total   = locs.reduce((s, l) => s + (l.maxCapacity ?? 0), 0);
    const current = locs.reduce((s, l) => s + (l.currentOccupancy ?? 0), 0);
    if (total === 0) return null;
    // Solo calcular si al menos una ubicación tiene currentOccupancy definido
    const hasOccupancy = locs.some(l => l.currentOccupancy !== undefined);
    if (!hasOccupancy) return null;
    return Math.round((current / total) * 100);
  });

  // ── Estado del formulario ──────────────────────────────────────────────────
  readonly isCreating    = signal(false);
  readonly isDirty       = signal(false);
  readonly isSaving      = signal(false);
  readonly saveError     = signal<string | null>(null);
  readonly formSubmitted = signal(false);

  // ── Estado de cambio de estado FSM ────────────────────────────────────────
  readonly isChangingStatus      = signal(false);
  readonly showStatusReasonModal = signal(false);
  readonly pendingStatus         = signal<LocationStatus | null>(null);
  readonly statusReason          = signal('');

  // ── Historial de auditoría ─────────────────────────────────────────────────
  readonly auditHistory         = signal<LocationAuditEntry[]>([]);
  readonly showAuditHistory     = signal(false);
  readonly isLoadingAudit       = signal(false);

  // ── ReactiveForm ───────────────────────────────────────────────────────────
  readonly editForm = this.fb.group({
    code:             ['', [Validators.required, locationCodeValidator]],
    name:             ['', [Validators.required, Validators.maxLength(100)]],
    warehouseId:      ['', Validators.required],
    warehouseName:    ['', Validators.required],
    zoneId:           ['', Validators.required],
    zoneCode:         [''],
    zoneName:         [''],
    aisle:            [''],
    bay:              [''],
    rack:             [''],
    level:            [''],
    position:         [''],
    locationType:     ['', Validators.required],
    logisticFunction: ['', Validators.required],
    maxCapacity:      [null as number | null, [Validators.required, Validators.min(1)]],
    capacityUnit:     ['', Validators.required],
    isStorageAllowed: [true],
    observations:     [''],
  });

  // Accesores rápidos de controles
  get fCode()             { return this.editForm.controls['code']; }
  get fName()             { return this.editForm.controls['name']; }
  get fWarehouseId()      { return this.editForm.controls['warehouseId']; }
  get fZoneId()           { return this.editForm.controls['zoneId']; }
  get fLocationType()     { return this.editForm.controls['locationType']; }
  get fLogisticFunction() { return this.editForm.controls['logisticFunction']; }
  get fMaxCapacity()      { return this.editForm.controls['maxCapacity']; }
  get fCapacityUnit()     { return this.editForm.controls['capacityUnit']; }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.layoutSvc.getLocations().subscribe({
      next: (locs) => {
        this.locations.set(locs);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastSvc.error('Error al cargar las ubicaciones. Verifica la conexión.');
        this.isLoading.set(false);
      },
    });

    this.layoutSvc.getZones().subscribe({
      next: (zones) => this.zones.set(zones),
      error: () => { /* No bloquear la UI */ },
    });
  }

  // ── Interacciones del árbol ────────────────────────────────────────────────

  onToggleNode(nodeId: string): void {
    this.expandedNodes.update(set => {
      const next = new Set(set);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }

  onSelectLocation(loc: WarehouseLocation): void {
    // Advertir si hay cambios sin guardar
    if (this.isDirty() && this.selectedId() !== null) {
      // En producción: confirmar con modal. Por ahora notificar.
      this.toastSvc.warning('Tienes cambios sin guardar en la ubicación anterior.');
    }
    this.selectedId.set(loc.id);
    this.isCreating.set(false);
    this.isDirty.set(false);
    this.saveError.set(null);
    this.formSubmitted.set(false);
    this.showAuditHistory.set(false);
    this.auditHistory.set([]);
    this._patchForm(loc);
  }

  onNewLocation(): void {
    if (this.isDirty()) {
      this.toastSvc.warning('Tienes cambios sin guardar.');
    }
    this.selectedId.set(null);
    this.isCreating.set(true);
    this.isDirty.set(false);
    this.saveError.set(null);
    this.formSubmitted.set(false);
    this.showAuditHistory.set(false);
    this.editForm.reset({
      warehouseId:   'WH-4GUARD-001',
      warehouseName: '4GUARD — Almacén Principal',
      isStorageAllowed: true,
    });
    this.editForm.markAsUntouched();
  }

  onCancelEdit(): void {
    this.isDirty.set(false);
    this.saveError.set(null);
    this.formSubmitted.set(false);
    if (this.isCreating()) {
      this.isCreating.set(false);
      this.selectedId.set(null);
    } else if (this.selectedLoc()) {
      this._patchForm(this.selectedLoc()!);
    }
  }

  onFormChange(): void {
    this.isDirty.set(true);
  }

  onZoneChange(event: Event): void {
    const zoneId = (event.target as HTMLSelectElement).value;
    const zone = this.zones().find(z => z.id === zoneId);
    if (zone) {
      this.editForm.patchValue({ zoneCode: zone.code, zoneName: zone.name });
    }
    this.isDirty.set(true);
  }

  // ── Guardado ───────────────────────────────────────────────────────────────

  onSave(): void {
    // Anti-double-submit
    if (this.isSaving()) return;

    this.formSubmitted.set(true);
    this.saveError.set(null);

    if (this.editForm.invalid) {
      this.toastSvc.warning('Completa todos los campos requeridos antes de guardar.');
      return;
    }

    this.isSaving.set(true);
    const raw = this.editForm.getRawValue();

    if (this.isCreating()) {
      const payload: CreateLocationPayload = {
        code:             raw.code!,
        name:             raw.name!,
        warehouseId:      raw.warehouseId!,
        warehouseName:    raw.warehouseName ?? '',
        zoneId:           raw.zoneId!,
        zoneCode:         raw.zoneCode ?? '',
        zoneName:         raw.zoneName ?? '',
        aisle:            raw.aisle    || undefined,
        bay:              raw.bay      || undefined,
        rack:             raw.rack     || undefined,
        level:            raw.level    || undefined,
        position:         raw.position || undefined,
        locationType:     raw.locationType as LocationType,
        logisticFunction: raw.logisticFunction as LogisticFunction,
        maxCapacity:      raw.maxCapacity!,
        capacityUnit:     raw.capacityUnit as CapacityUnit,
        isStorageAllowed: raw.isStorageAllowed ?? true,
        observations:     raw.observations || undefined,
      };
      this._execCreate(payload);
    } else {
      const payload: UpdateLocationPayload = {
        code:             raw.code!,
        name:             raw.name!,
        warehouseId:      raw.warehouseId!,
        warehouseName:    raw.warehouseName ?? '',
        zoneId:           raw.zoneId!,
        zoneCode:         raw.zoneCode ?? '',
        zoneName:         raw.zoneName ?? '',
        aisle:            raw.aisle    || undefined,
        bay:              raw.bay      || undefined,
        rack:             raw.rack     || undefined,
        level:            raw.level    || undefined,
        position:         raw.position || undefined,
        locationType:     raw.locationType as LocationType,
        logisticFunction: raw.logisticFunction as LogisticFunction,
        maxCapacity:      raw.maxCapacity!,
        capacityUnit:     raw.capacityUnit as CapacityUnit,
        isStorageAllowed: raw.isStorageAllowed ?? true,
        observations:     raw.observations || undefined,
      };
      this._execUpdate(this.selectedId()!, payload);
    }
  }

  private _execCreate(payload: CreateLocationPayload): void {
    this.layoutSvc.createLocation(payload).subscribe({
      next: (created) => {
        this.locations.update(list => [...list, created]);
        this.selectedId.set(created.id);
        this.isCreating.set(false);
        this.isDirty.set(false);
        this.isSaving.set(false);
        this._patchForm(created);
        this.toastSvc.success(`Ubicación "${created.code}" creada correctamente.`);
        // Expandir el nodo de la zona recién usada
        this.expandedNodes.update(s => {
          const next = new Set(s);
          next.add(created.zoneId);
          return next;
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err?.message ?? 'Error al crear la ubicación.';
        this.saveError.set(msg);
        this.toastSvc.error(msg);
      },
    });
  }

  private _execUpdate(id: string, payload: UpdateLocationPayload): void {
    this.layoutSvc.updateLocation(id, payload).subscribe({
      next: (updated) => {
        this.locations.update(list =>
          list.map(l => l.id === updated.id ? updated : l)
        );
        this.isDirty.set(false);
        this.isSaving.set(false);
        this._patchForm(updated);
        this.toastSvc.success(`Ubicación "${updated.code}" guardada correctamente.`);
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err?.message ?? 'Error al guardar la ubicación.';
        this.saveError.set(msg);
        this.toastSvc.error(msg);
        // El formulario permanece abierto con los datos del usuario
      },
    });
  }

  // ── Cambio de estado FSM ───────────────────────────────────────────────────

  onRequestStatusChange(newStatus: LocationStatus): void {
    this.pendingStatus.set(newStatus);
    this.statusReason.set('');
    if (STATUS_REQUIRES_REASON[newStatus]) {
      this.showStatusReasonModal.set(true);
    } else {
      this._execStatusChange(newStatus, undefined);
    }
  }

  onConfirmStatusChange(): void {
    const status = this.pendingStatus();
    if (!status) return;
    const reason = this.statusReason().trim();
    if (STATUS_REQUIRES_REASON[status] && !reason) {
      this.toastSvc.warning('Debes ingresar un motivo para esta acción.');
      return;
    }
    this.showStatusReasonModal.set(false);
    this._execStatusChange(status, reason || undefined);
  }

  onCancelStatusChange(): void {
    this.showStatusReasonModal.set(false);
    this.pendingStatus.set(null);
    this.statusReason.set('');
  }

  onReasonInput(event: Event): void {
    this.statusReason.set((event.target as HTMLTextAreaElement).value);
  }

  private _execStatusChange(status: LocationStatus, reason?: string): void {
    const id = this.selectedId();
    if (!id) return;

    this.isChangingStatus.set(true);
    const payload: ChangeStatusPayload = { status, reason };

    this.layoutSvc.changeStatus(id, payload).subscribe({
      next: (updated) => {
        this.locations.update(list =>
          list.map(l => l.id === updated.id ? updated : l)
        );
        this.isChangingStatus.set(false);
        this.pendingStatus.set(null);
        this._patchForm(updated);
        const label = LOCATION_STATUS_LABELS[status];
        this.toastSvc.success(`Estado cambiado a "${label}" correctamente.`);
      },
      error: (err) => {
        this.isChangingStatus.set(false);
        const msg = err?.message ?? 'Error al cambiar el estado.';
        this.toastSvc.error(msg);
      },
    });
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  onDelete(): void {
    const loc = this.selectedLoc();
    if (!loc || !loc.canDelete) return;

    if (!confirm(`¿Eliminar permanentemente la ubicación "${loc.code}"?\nEsta acción no se puede deshacer.`)) return;

    this.layoutSvc.deleteLocation(loc.id).subscribe({
      next: () => {
        this.locations.update(list => list.filter(l => l.id !== loc.id));
        this.selectedId.set(null);
        this.isCreating.set(false);
        this.isDirty.set(false);
        this.toastSvc.success(`Ubicación "${loc.code}" eliminada.`);
      },
      error: (err) => {
        const msg = err?.message ?? 'Error al eliminar la ubicación.';
        this.toastSvc.error(msg);
      },
    });
  }

  // ── Auditoría ──────────────────────────────────────────────────────────────

  onViewHistory(): void {
    const id = this.selectedId();
    if (!id) return;

    if (this.showAuditHistory()) {
      this.showAuditHistory.set(false);
      return;
    }

    this.isLoadingAudit.set(true);
    this.showAuditHistory.set(true);

    this.layoutSvc.getLocationHistory(id).subscribe({
      next: (entries) => {
        this.auditHistory.set(entries);
        this.isLoadingAudit.set(false);
      },
      error: () => {
        this.isLoadingAudit.set(false);
        this.toastSvc.error('No se pudo cargar el historial de auditoría.');
      },
    });
  }

  // ── Búsqueda y filtros ─────────────────────────────────────────────────────

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onClearSearch(): void {
    this.searchTerm.set('');
  }

  onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as LocationStatus | 'ALL');
  }

  onZoneFilterChange(event: Event): void {
    this.zoneFilter.set((event.target as HTMLSelectElement).value);
  }

  // ── Transiciones permitidas ────────────────────────────────────────────────

  canTransitionTo(target: LocationStatus): boolean {
    const current = this.selectedLoc()?.status;
    if (!current) return false;
    return LOCATION_FSM_TRANSITIONS[current]?.includes(target) ?? false;
  }

  // ── Helpers de template ────────────────────────────────────────────────────

  getStatusClass(status: LocationStatus): string {
    const map: Record<LocationStatus, string> = {
      ACTIVE:      'status--active',
      BLOCKED:     'status--blocked',
      MAINTENANCE: 'status--maintenance',
      INACTIVE:    'status--inactive',
    };
    return map[status] ?? '';
  }

  getStatusIcon(status: LocationStatus): string {
    const map: Record<LocationStatus, string> = {
      ACTIVE:      'check_circle',
      BLOCKED:     'block',
      MAINTENANCE: 'build',
      INACTIVE:    'do_not_disturb',
    };
    return map[status] ?? 'help';
  }

  getOccupancyClass(pct?: number): string {
    if (pct === undefined) return '';
    if (pct >= 90) return 'occ--critical';
    if (pct >= 70) return 'occ--warning';
    return 'occ--ok';
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('es-MX', {
        day:    '2-digit',
        month:  'long',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  trackByNodeId(_: number, node: LocationTreeNode): string {
    return node.id;
  }

  trackByLocId(_: number, loc: WarehouseLocation): string {
    return loc.id;
  }

  trackByAuditId(_: number, entry: LocationAuditEntry): string {
    return entry.id;
  }

  /** Determina si mostrar el error de un control */
  hasError(ctrlName: string): boolean {
    const ctrl = this.editForm.get(ctrlName);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || this.formSubmitted()));
  }

  getErrorMessage(ctrlName: string): string {
    const ctrl = this.editForm.get(ctrlName);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])     return 'Este campo es obligatorio.';
    if (ctrl.errors['min'])          return `El valor mínimo es ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['maxlength'])    return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['invalidCode'])  return 'Solo letras mayúsculas, números y guiones (A-Z, 0-9, -).';
    return 'Valor inválido.';
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private _patchForm(loc: WarehouseLocation): void {
    this.editForm.patchValue({
      code:             loc.code,
      name:             loc.name,
      warehouseId:      loc.warehouseId,
      warehouseName:    loc.warehouseName,
      zoneId:           loc.zoneId,
      zoneCode:         loc.zoneCode,
      zoneName:         loc.zoneName,
      aisle:            loc.aisle    ?? '',
      bay:              loc.bay      ?? '',
      rack:             loc.rack     ?? '',
      level:            loc.level    ?? '',
      position:         loc.position ?? '',
      locationType:     loc.locationType,
      logisticFunction: loc.logisticFunction,
      maxCapacity:      loc.maxCapacity,
      capacityUnit:     loc.capacityUnit,
      isStorageAllowed: loc.isStorageAllowed,
      observations:     loc.observations ?? '',
    });
    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();
  }

  private _buildZoneNode(
    zoneId: string,
    zoneName: string,
    aisleMap: Map<string, Map<string, WarehouseLocation[]>>,
    expanded: Set<string>
  ): LocationTreeNode {
    const children: LocationTreeNode[] = [];

    for (const [aisleKey, bayMap] of aisleMap) {
      if (aisleKey === '__NONE__') {
        // Sin pasillo — los hijos directos son los nodos de bahía o leaf
        for (const [bayKey, locs] of bayMap) {
          if (bayKey === '__NONE__') {
            // Sin bahía — las ubicaciones son hojas directas de la zona
            for (const loc of locs) {
              children.push(this._buildLeafNode(loc));
            }
          } else {
            children.push(this._buildBayNode(`${zoneId}-${bayKey}`, bayKey, locs, expanded));
          }
        }
      } else {
        children.push(this._buildAisleNode(zoneId, aisleKey, bayMap, expanded));
      }
    }

    const total = children.reduce((s, c) => s + (c.level === 'leaf' ? 1 : c.count), 0);
    return {
      id: zoneId, label: zoneName, level: 'zone',
      isExpanded: expanded.has(zoneId),
      count: total,
      statusSummary: this._sumStatus(children),
      children,
    };
  }

  private _buildAisleNode(
    zoneId: string,
    aisle: string,
    bayMap: Map<string, WarehouseLocation[]>,
    expanded: Set<string>
  ): LocationTreeNode {
    const nodeId = `${zoneId}-AISLE-${aisle}`;
    const children: LocationTreeNode[] = [];

    for (const [bayKey, locs] of bayMap) {
      if (bayKey === '__NONE__') {
        for (const loc of locs) children.push(this._buildLeafNode(loc));
      } else {
        children.push(this._buildBayNode(`${nodeId}-${bayKey}`, bayKey, locs, expanded));
      }
    }

    const total = children.reduce((s, c) => s + (c.level === 'leaf' ? 1 : c.count), 0);
    return {
      id: nodeId, label: `Pasillo ${aisle}`, level: 'aisle',
      isExpanded: expanded.has(nodeId),
      count: total,
      statusSummary: this._sumStatus(children),
      children,
    };
  }

  private _buildBayNode(
    nodeId: string,
    bay: string,
    locs: WarehouseLocation[],
    expanded: Set<string>
  ): LocationTreeNode {
    const children = locs.map(l => this._buildLeafNode(l));
    return {
      id: nodeId, label: `Bahía ${bay}`, level: 'bay',
      isExpanded: expanded.has(nodeId),
      count: locs.length,
      statusSummary: this._sumStatus(children),
      children,
    };
  }

  private _buildLeafNode(loc: WarehouseLocation): LocationTreeNode {
    return {
      id:       `leaf-${loc.id}`,
      label:    loc.name,
      level:    'leaf',
      isExpanded: false,
      count:    1,
      statusSummary: {
        active:      loc.status === 'ACTIVE'      ? 1 : 0,
        blocked:     loc.status === 'BLOCKED'     ? 1 : 0,
        maintenance: loc.status === 'MAINTENANCE' ? 1 : 0,
        inactive:    loc.status === 'INACTIVE'    ? 1 : 0,
      },
      children: [],
      location: loc,
    };
  }

  private _sumStatus(nodes: LocationTreeNode[]): LocationTreeNode['statusSummary'] {
    return nodes.reduce(
      (acc, n) => ({
        active:      acc.active      + n.statusSummary.active,
        blocked:     acc.blocked     + n.statusSummary.blocked,
        maintenance: acc.maintenance + n.statusSummary.maintenance,
        inactive:    acc.inactive    + n.statusSummary.inactive,
      }),
      { active: 0, blocked: 0, maintenance: 0, inactive: 0 }
    );
  }
}
