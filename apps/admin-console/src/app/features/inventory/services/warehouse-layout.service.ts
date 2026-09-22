/**
 * @file warehouse-layout.service.ts
 * @description Servicio de Gestión de Topología y Datos del Almacén integrado 100% al Backend (SDOP / Hexagonal Architecture).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats
} from '../models/warehouse-layout.models';
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
  private readonly _positionsVersion = signal<number>(0);
  private readonly _loadingSections = signal<Set<string>>(new Set());
  private readonly _isLoadingTopology = signal<boolean>(false);
  private readonly _blockReasons = signal<string[]>([]);

  readonly sections = computed(() => this._sections());
  readonly stats = computed(() => this._stats());
  readonly isLoadingTopology = computed(() => this._isLoadingTopology());
  readonly blockReasons = computed(() => this._blockReasons());

  constructor() {
    this.loadTopology();
    this.loadBlockReasons();
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

  getSectionById(id: string): WarehouseSection | undefined {
    return this._sections().find((s) => s.id === id);
  }

  isLoadingPositionsForSection(sectionId: string): boolean {
    return this._loadingSections().has(sectionId);
  }

  getPositionsForSection(sectionId: string): PositionDetail[] {
    this._positionsVersion();

    if (this._positionsCache.has(sectionId)) {
      return this._positionsCache.get(sectionId)!;
    }

    const section = this.getSectionById(sectionId);
    if (!section || section.status === 'PENDING' || section.posFijas === 0) {
      return [];
    }

    if (!this._loadingSections().has(sectionId)) {
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
    if (!item || !list) return;

    // Snapshot para rollback en caso de error
    const prevStatus = item.status;
    const prevCurrentTarimas = item.currentTarimas;
    const prevBlockReason = item.blockReason;

    // Actualización optimista inmediata en memoria
    item.status = newStatus;
    if (newStatus === 'AVAILABLE') {
      item.currentTarimas = 0;
      item.blockReason = undefined;
    } else if (newStatus === 'OCCUPIED') {
      item.currentTarimas = item.capacityTarimas;
      item.blockReason = undefined;
    } else if (newStatus === 'BLOCKED') {
      item.currentTarimas = 0;
      const parts: string[] = [];
      if (meta.reason) parts.push(meta.reason);
      if (meta.comment) parts.push(`Nota: ${meta.comment}`);
      item.blockReason = parts.length ? parts.join(' — ') : 'Bloqueo Manual QM';
    }

    this._positionsVersion.update(v => v + 1);

    const action = newStatus === 'AVAILABLE' ? 'RELEASE' : (newStatus === 'BLOCKED' ? 'BLOCK' : 'OCCUPY');
    this.repository.updatePositionStatus(positionId, action, {
      reasonCode: meta.reason,
      comment: meta.comment
    }).subscribe({
      next: (updatedPos) => {
        const idx = list.findIndex(p => p.id === positionId);
        if (idx !== -1) {
          list[idx] = updatedPos;
          this._positionsVersion.update(v => v + 1);
        }
        // Refrescar topología y KPIs desde el backend
        this.loadTopology();
      },
      error: (err) => {
        console.error('Error al actualizar estado en el backend, revirtiendo estado optimista:', err);
        item.status = prevStatus;
        item.currentTarimas = prevCurrentTarimas;
        item.blockReason = prevBlockReason;
        this._positionsVersion.update(v => v + 1);
      }
    });
  }
}
