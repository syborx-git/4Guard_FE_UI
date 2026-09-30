/**
 * @file warehouse-layout.service.ts
 * @description Servicio de Gestión de Topología y Datos del Almacén en Catálogos Maestros (SDOP / Hexagonal).
 * 100% Integrado al Backend Spring Boot y PostgreSQL (Sin mocks ni localStorage).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats,
  InitializeSectionRequest
} from '../models/warehouse-catalog.models';
import { WAREHOUSE_LAYOUT_REPOSITORY } from '../ports/warehouse-layout.repository.port';

@Injectable({
  providedIn: 'root'
})
export class WarehouseLayoutService {
  private readonly repository = inject(WAREHOUSE_LAYOUT_REPOSITORY);

  private readonly _sections = signal<WarehouseSection[]>([]);
  private readonly _stats = signal<WarehouseLayoutStats>({
    totalSections: 0,
    loadedSections: 0,
    pendingSections: 0,
    totalPositions: 0,
    totalCapacityTarimas: 0,
    occupiedPositions: 0,
    blockedPositions: 0
  });

  private readonly _positionsCache = new Map<string, PositionDetail[]>();
  private readonly _allPositions = signal<PositionDetail[]>([]);
  private readonly _positionsVersion = signal<number>(0);
  private readonly _loadingSections = signal<Set<string>>(new Set());
  private readonly _isLoadingTopology = signal<boolean>(false);
  private readonly _isLoadingAllPositions = signal<boolean>(false);
  private readonly _blockReasons = signal<string[]>([]);

  readonly sections = computed(() => this._sections());
  readonly stats = computed(() => this._stats());
  readonly allPositions = computed(() => this._allPositions());
  readonly isLoadingTopology = computed(() => this._isLoadingTopology());
  readonly isLoadingAllPositions = computed(() => this._isLoadingAllPositions());
  readonly blockReasons = computed(() => this._blockReasons());

  constructor() {
    this.loadTopology();
    this.loadBlockReasons();
    this.loadAllPositions();
  }

  loadTopology(): void {
    this._isLoadingTopology.set(true);
    this.repository.getTopology().subscribe({
      next: (data) => {
        this._isLoadingTopology.set(false);
        this._sections.set(data.sections);
        this._stats.set(data.stats);
      },
      error: (err) => {
        this._isLoadingTopology.set(false);
        console.error('Error al cargar topología desde el backend:', err);
      }
    });
  }

  loadBlockReasons(): void {
    this.repository.getBlockReasons().subscribe({
      next: (reasons) => {
        this._blockReasons.set(reasons);
      },
      error: (err) => {
        console.error('Error al cargar catálogo de motivos de bloqueo QM:', err);
      }
    });
  }

  loadAllPositions(sectionId?: string, status?: string, query?: string): void {
    this._isLoadingAllPositions.set(true);
    this.repository.getAllPositions(sectionId, status, query).subscribe({
      next: (positions) => {
        this._isLoadingAllPositions.set(false);
        this._allPositions.set(positions);
      },
      error: (err) => {
        this._isLoadingAllPositions.set(false);
        console.error('Error al cargar todas las posiciones desde el backend:', err);
      }
    });
  }

  getSectionById(id: string): WarehouseSection | undefined {
    return this._sections().find((s) => s.id === id);
  }

  isLoadingPositionsForSection(sectionId: string): boolean {
    return this._loadingSections().has(sectionId);
  }

  loadPositionsForSection(sectionId: string): void {
    if (this._loadingSections().has(sectionId)) {
      return;
    }

    const nextSet = new Set(this._loadingSections());
    nextSet.add(sectionId);
    this._loadingSections.set(nextSet);

    this.repository.getPositionsForSection(sectionId).subscribe({
      next: (positions) => {
        const updatedSet = new Set(this._loadingSections());
        updatedSet.delete(sectionId);
        this._loadingSections.set(updatedSet);

        this._positionsCache.set(sectionId, positions);
        this._positionsVersion.update(v => v + 1);
      },
      error: (err) => {
        const updatedSet = new Set(this._loadingSections());
        updatedSet.delete(sectionId);
        this._loadingSections.set(updatedSet);
        console.error(`Error al cargar posiciones de la sección ${sectionId}:`, err);
      }
    });
  }

  getPositionsForSection(sectionId: string): PositionDetail[] {
    this._positionsVersion();

    if (this._positionsCache.has(sectionId)) {
      return this._positionsCache.get(sectionId)!;
    }

    const fromAll = this._allPositions().filter((p) => p.sectionId === sectionId);
    if (fromAll.length > 0) {
      return fromAll;
    }

    return [];
  }

  updatePositionStatus(
    sectionId: string,
    positionId: string,
    newStatus: PositionStatus,
    meta: { reason?: string; comment?: string } = {}
  ): void {
    const list = this._positionsCache.get(sectionId);
    const item = list?.find((p) => p.id === positionId);

    // Actualizar también en _allPositions si existe
    const allList = this._allPositions();
    const itemInAll = allList.find((p) => p.id === positionId);

    const prevStatus = item?.status ?? itemInAll?.status ?? 'AVAILABLE';
    const prevCurrentTarimas = item?.currentTarimas ?? itemInAll?.currentTarimas ?? 0;
    const prevBlockReason = item?.blockReason ?? itemInAll?.blockReason;

    // Optimistic update
    const applyOptimistic = (target: PositionDetail) => {
      target.status = newStatus;
      if (newStatus === 'AVAILABLE') {
        target.currentTarimas = 0;
        target.blockReason = undefined;
      } else if (newStatus === 'OCCUPIED') {
        target.currentTarimas = target.capacityTarimas;
        target.blockReason = undefined;
      } else if (newStatus === 'BLOCKED') {
        target.currentTarimas = 0;
        const parts: string[] = [];
        if (meta.reason) parts.push(meta.reason);
        if (meta.comment) parts.push(`Nota: ${meta.comment}`);
        target.blockReason = parts.length ? parts.join(' — ') : 'Bloqueo Manual QM';
      }
    };

    if (item) applyOptimistic(item);
    if (itemInAll) applyOptimistic(itemInAll);
    this._positionsVersion.update(v => v + 1);

    const action = newStatus === 'AVAILABLE' ? 'RELEASE' : (newStatus === 'BLOCKED' ? 'BLOCK' : 'OCCUPY');
    this.repository.updatePositionStatus(positionId, action, {
      reasonCode: meta.reason,
      comment: meta.comment
    }).subscribe({
      next: (updatedPos) => {
        if (list) {
          const idx = list.findIndex(p => p.id === positionId);
          if (idx !== -1) list[idx] = updatedPos;
        }
        const idxAll = allList.findIndex(p => p.id === positionId);
        if (idxAll !== -1) {
          allList[idxAll] = updatedPos;
          this._allPositions.set([...allList]);
        }
        this._positionsVersion.update(v => v + 1);
        this.loadTopology();
      },
      error: (err) => {
        console.error('Error al actualizar estado en el backend, revirtiendo estado optimista:', err);
        const rollback = (target: PositionDetail) => {
          target.status = prevStatus;
          target.currentTarimas = prevCurrentTarimas;
          target.blockReason = prevBlockReason;
        };
        if (item) rollback(item);
        if (itemInAll) rollback(itemInAll);
        this._positionsVersion.update(v => v + 1);
      }
    });
  }

  initializeSection(sectionId: string, payload: InitializeSectionRequest): Observable<any> {
    return this.repository.initializeSection(sectionId, payload).pipe(
      tap(() => {
        this._positionsCache.delete(sectionId);
        this.loadTopology();
        this.loadAllPositions();
      })
    );
  }
}
