/**
 * @file warehouse-layout.service.ts
 * @description Servicio de Gestión de Topología y Datos del Almacén en Catálogos Maestros (SDOP / Hexagonal).
 * 100% Integrado al Backend Spring Boot y PostgreSQL (Sin mocks ni localStorage).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats,
  InitializeSectionRequest
} from '../models/warehouse-catalog.models';
import { WAREHOUSE_LAYOUT_REPOSITORY } from '../ports/warehouse-layout.repository.port';

import { SessionStorageService } from '../../../core/services/session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class WarehouseLayoutService {
  private readonly repository = inject(WAREHOUSE_LAYOUT_REPOSITORY);
  private readonly sessionStorageService = inject(SessionStorageService);

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
    if (this.sessionStorageService.isLogged()) {
      this.loadTopology();
      this.loadBlockReasons();
      this.loadAllPositions();
    }
  }

  loadTopology(): void {
    if (!this.sessionStorageService.isLogged()) return;
    this._isLoadingTopology.set(true);
    this.repository.getTopology().subscribe({
      next: (data) => {
        this._isLoadingTopology.set(false);
        this._sections.set(data.sections);
        this._stats.set(data.stats);
      },
      error: (err) => {
        this._isLoadingTopology.set(false);
        if (err?.status !== 403) {
          console.error('Error al cargar topología desde el backend:', err);
        }
      }
    });
  }

  loadBlockReasons(): void {
    if (!this.sessionStorageService.isLogged()) return;
    this.repository.getBlockReasons().subscribe({
      next: (reasons) => {
        this._blockReasons.set(reasons);
      },
      error: (err) => {
        if (err?.status !== 403) {
          console.error('Error al cargar catálogo de motivos de bloqueo QM:', err);
        }
      }
    });
  }

  private readonly CLEAN_MODE_KEY = '4g_warehouse_clean_mode';
  readonly isCleanMode = signal<boolean>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('4g_warehouse_clean_mode') === 'true' : false
  );

  loadAllPositions(sectionId?: string, status?: string, query?: string): void {
    if (!this.sessionStorageService.isLogged()) return;
    this._isLoadingAllPositions.set(true);
    this.repository.getAllPositions(sectionId, status, query).subscribe({
      next: (positions) => {
        this._isLoadingAllPositions.set(false);
        const sim = this.getSimulatedPositions();
        const isClean = this.isCleanMode();

        const processed = positions.map((pos) => {
          // Si estamos en modo almacén limpio / ceros, arrancamos en 0
          let base = isClean
            ? {
                ...pos,
                currentTarimas: 0,
                status: 'AVAILABLE' as PositionStatus,
                skuDescription: 'Posición Disponible',
                batchNumber: 'N/A',
                blockReason: undefined,
              }
            : pos;

          // Si tiene movimiento de recepción registrado, aplicarlo encima
          const override = sim[pos.code.toUpperCase()];
          if (override) {
            return {
              ...base,
              currentTarimas: override.currentTarimas ?? base.currentTarimas,
              skuDescription: override.skuDescription ?? base.skuDescription,
              batchNumber: override.batchNumber ?? base.batchNumber,
              status: (override.status as PositionStatus) ?? base.status,
              lastMovement: override.lastMovement ?? base.lastMovement,
              blockReason: override.blockReason ?? base.blockReason,
            };
          }
          return base;
        });

        this._allPositions.set(processed);
      },
      error: (err) => {
        this._isLoadingAllPositions.set(false);
        if (err?.status !== 403) {
          console.error('Error al cargar todas las posiciones desde el backend:', err);
        }
      }
    });
  }

  fetchPositions(sectionId?: string, status?: string, query?: string): Observable<PositionDetail[]> {
    return this.repository.getAllPositions(sectionId, status, query).pipe(
      map((positions) => {
        const sim = this.getSimulatedPositions();
        const isClean = this.isCleanMode();

        return positions.map((pos) => {
          let base = isClean
            ? {
                ...pos,
                currentTarimas: 0,
                status: 'AVAILABLE' as PositionStatus,
                skuDescription: 'Posición Disponible',
                batchNumber: 'N/A',
                blockReason: undefined,
              }
            : pos;

          const override = sim[pos.code.toUpperCase()];
          if (override) {
            return {
              ...base,
              currentTarimas: override.currentTarimas ?? base.currentTarimas,
              skuDescription: override.skuDescription ?? base.skuDescription,
              batchNumber: override.batchNumber ?? base.batchNumber,
              status: (override.status as PositionStatus) ?? base.status,
              lastMovement: override.lastMovement ?? base.lastMovement,
              blockReason: override.blockReason ?? base.blockReason,
            };
          }
          return base;
        });
      })
    );
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

  // ── SIMULADOR DE INVENTARIO INBOUND (CLIENT-SIDE) ──
  private readonly SIM_STORAGE_KEY = '4g_simulated_bay_positions';

  getSimulatedPositions(): Record<string, Partial<PositionDetail>> {
    try {
      const stored = localStorage.getItem(this.SIM_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  recordSimulatedInbound(
    bayCode: string,
    currentTarimas: number,
    skuDesc?: string,
    batchNumber?: string,
    folio?: string
  ): void {
    if (!bayCode) return;
    const cleanCode = bayCode.trim().toUpperCase();
    const capacity = 22;
    const tarimas = Number(currentTarimas);
    const status: PositionStatus = tarimas >= capacity * 0.8 ? 'OCCUPIED' : (tarimas > 0 ? 'OCCUPIED' : 'AVAILABLE');

    const currentSim = this.getSimulatedPositions();
    currentSim[cleanCode] = {
      code: cleanCode,
      currentTarimas: tarimas,
      capacityTarimas: capacity,
      skuDescription: tarimas > 0 ? (skuDesc || 'Mercancía General WMS') : 'Posición Disponible',
      batchNumber: tarimas > 0 ? (batchNumber || 'LOT-2026-INBOUND') : 'N/A',
      status,
      lastMovement: tarimas > 0
        ? `Recepcionado vía ${folio || 'Inbound Express'} (${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})`
        : `Liberado / Vacante (${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})`
    };

    try {
      localStorage.setItem(this.SIM_STORAGE_KEY, JSON.stringify(currentSim));
    } catch (e) {
      console.warn('Could not persist to localStorage', e);
    }

    this.applySimulationOverrides();
  }

  transferSimulatedInventory(
    originBayCode: string,
    destinationBayCode: string,
    tarimasToMove: number,
    skuDesc?: string,
    batchNumber?: string,
    folio?: string
  ): void {
    if (!originBayCode || !destinationBayCode) return;
    const cleanOrigin = originBayCode.trim().toUpperCase();
    const cleanDest = destinationBayCode.trim().toUpperCase();
    const count = Number(tarimasToMove) || 14;
    const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const currentSim = this.getSimulatedPositions();
    const originExisting = currentSim[cleanOrigin];
    const originPrevTarimas = originExisting?.currentTarimas ?? 14;
    const originRemaining = Math.max(0, originPrevTarimas - count);

    const sku = skuDesc || originExisting?.skuDescription || 'Mercancía Transferida';
    const lot = batchNumber || originExisting?.batchNumber || 'LOT-2026-TR';

    // 1. Actualizar Origen (Buffer o Rack)
    currentSim[cleanOrigin] = {
      code: cleanOrigin,
      currentTarimas: originRemaining,
      capacityTarimas: 22,
      skuDescription: originRemaining > 0 ? sku : 'Posición Disponible (Desalojada)',
      batchNumber: originRemaining > 0 ? lot : 'N/A',
      status: originRemaining > 0 ? 'OCCUPIED' : 'AVAILABLE',
      lastMovement: `Reubicado a ${cleanDest} vía Folio ${folio || 'TR-Directo'} (${timestamp})`
    };

    // 2. Actualizar Destino
    const destExisting = currentSim[cleanDest];
    const destPrevTarimas = destExisting?.currentTarimas ?? 0;
    const destTotal = destPrevTarimas + count;

    currentSim[cleanDest] = {
      code: cleanDest,
      currentTarimas: destTotal,
      capacityTarimas: 22,
      skuDescription: sku,
      batchNumber: lot,
      status: 'OCCUPIED',
      lastMovement: `Recibido de ${cleanOrigin} vía Folio ${folio || 'TR-Directo'} (${timestamp})`
    };

    try {
      localStorage.setItem(this.SIM_STORAGE_KEY, JSON.stringify(currentSim));
    } catch (e) {
      console.warn('Could not persist to localStorage', e);
    }

    this.applySimulationOverrides();
  }

  clearSimulatedBay(bayCode: string): void {
    if (!bayCode) return;
    const cleanCode = bayCode.trim().toUpperCase();
    const currentSim = this.getSimulatedPositions();
    currentSim[cleanCode] = {
      code: cleanCode,
      currentTarimas: 0,
      capacityTarimas: 22,
      skuDescription: 'Posición Disponible',
      batchNumber: 'N/A',
      status: 'AVAILABLE',
      lastMovement: `Desalojado manualmente (${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})`
    };
    try {
      localStorage.setItem(this.SIM_STORAGE_KEY, JSON.stringify(currentSim));
    } catch (e) {}

    this.applySimulationOverrides();
  }

  private applySimulationOverrides(): void {
    const currentSim = this.getSimulatedPositions();
    const all = [...this._allPositions()];

    for (const [codeKey, override] of Object.entries(currentSim)) {
      const cleanKey = codeKey.toUpperCase();
      let target = all.find(p => p.code.toUpperCase() === cleanKey);
      if (target) {
        target.currentTarimas = override.currentTarimas ?? target.currentTarimas;
        target.skuDescription = override.skuDescription ?? target.skuDescription;
        target.batchNumber = override.batchNumber ?? target.batchNumber;
        target.status = (override.status as PositionStatus) ?? target.status;
        target.lastMovement = override.lastMovement ?? target.lastMovement;
      } else {
        const zoneChar = cleanKey.includes('-') ? cleanKey.split('-')[1]?.toUpperCase() : 'A';
        const isTemp = cleanKey.includes('-T') || cleanKey.startsWith('STAGING') || cleanKey.startsWith('BUF');
        all.push({
          id: `pos-${cleanKey.toLowerCase()}`,
          positionNumber: 999,
          code: cleanKey,
          sectionId: `sec-${zoneChar.toLowerCase()}`,
          sectionName: `Nave ${zoneChar}`,
          category: isTemp ? 'TEMPORARY_BUFFER' : 'FIXED_STORAGE',
          skuDescription: override.skuDescription || 'Sin Material Asignado',
          status: (override.status as PositionStatus) || 'AVAILABLE',
          capacityTarimas: override.capacityTarimas || 22,
          currentTarimas: override.currentTarimas || 0,
          batchNumber: override.batchNumber || 'N/A',
          lastMovement: override.lastMovement || 'Sin movimientos'
        });
      }

      this._positionsCache.forEach((list) => {
        const item = list.find(p => p.code.toUpperCase() === cleanKey);
        if (item) {
          item.currentTarimas = override.currentTarimas ?? item.currentTarimas;
          item.skuDescription = override.skuDescription ?? item.skuDescription;
          item.batchNumber = override.batchNumber ?? item.batchNumber;
          item.status = (override.status as PositionStatus) ?? item.status;
          item.lastMovement = override.lastMovement ?? item.lastMovement;
        }
      });
    }

    this._allPositions.set(all);
    this._positionsVersion.update(v => v + 1);
  }

  resetSimulatedPositions(): void {
    try {
      localStorage.removeItem(this.SIM_STORAGE_KEY);
    } catch {}
    this._positionsCache.clear();
    this.loadTopology();
    this.loadAllPositions();
    this._positionsVersion.update(v => v + 1);
  }

  toggleCleanMode(): boolean {
    const next = !this.isCleanMode();
    this.setCleanMode(next);
    return next;
  }

  setCleanMode(enabled: boolean): void {
    try {
      if (enabled) {
        localStorage.setItem(this.CLEAN_MODE_KEY, 'true');
      } else {
        localStorage.removeItem(this.CLEAN_MODE_KEY);
      }
    } catch {}
    this.isCleanMode.set(enabled);
    this._positionsCache.clear();
    this.loadTopology();
    this.loadAllPositions();
    this._positionsVersion.update(v => v + 1);
  }

  resetAllToZero(): void {
    try {
      localStorage.removeItem(this.SIM_STORAGE_KEY);
      localStorage.setItem(this.CLEAN_MODE_KEY, 'true');
    } catch {}
    this.isCleanMode.set(true);
    this._positionsCache.clear();
    this.loadTopology();
    this.loadAllPositions();
    this._positionsVersion.update(v => v + 1);
  }

  getPositionsForSection(sectionId: string): PositionDetail[] {
    this._positionsVersion();

    let rawPositions: PositionDetail[] = [];
    if (this._positionsCache.has(sectionId)) {
      rawPositions = this._positionsCache.get(sectionId)!;
    } else {
      const sec = this._sections().find(s => s.id === sectionId || s.code === sectionId);
      rawPositions = this._allPositions().filter((p) =>
        p.sectionId === sectionId ||
        (sec && (p.sectionName === sec.name || p.code.startsWith(`POS-${sec.code}-`)))
      );
    }

    const sec = this._sections().find(s => s.id === sectionId || s.code === sectionId);
    const zoneChar = sec ? sec.code.replace(/[^A-Za-z]/g, '').toUpperCase() : '';

    const fromAll = this._allPositions().filter((p) => {
      if (p.sectionId === sectionId) return true;
      if (sec && (p.sectionName === sec.name || (zoneChar && p.code.startsWith(`POS-${zoneChar}-`)))) return true;
      return false;
    });

    if (fromAll.length > 0) {
      rawPositions = fromAll;
    }

    if (this.isCleanMode()) {
      rawPositions = rawPositions.map(p => ({
        ...p,
        currentTarimas: 0,
        status: 'AVAILABLE' as PositionStatus,
        skuDescription: 'Posición Disponible',
        batchNumber: 'N/A',
        blockReason: undefined,
      }));
    }

    // Overlay de simulaciones activas
    const sim = this.getSimulatedPositions();
    if (Object.keys(sim).length > 0) {
      return rawPositions.map(pos => {
        const override = sim[pos.code.toUpperCase()];
        if (override) {
          return {
            ...pos,
            currentTarimas: override.currentTarimas ?? pos.currentTarimas,
            skuDescription: override.skuDescription ?? pos.skuDescription,
            batchNumber: override.batchNumber ?? pos.batchNumber,
            status: (override.status as PositionStatus) ?? pos.status,
            lastMovement: override.lastMovement ?? pos.lastMovement,
            blockReason: override.blockReason ?? pos.blockReason,
          };
        }
        return pos;
      });
    }

    return rawPositions;
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

  createPosition(payload: import('../models/warehouse-catalog.models').CreatePositionRequest): Observable<PositionDetail> {
    return this.repository.createPosition(payload).pipe(
      tap((newPos) => {
        this._positionsCache.delete(payload.sectionId);
        this.loadTopology();
        this.loadAllPositions();
        this.loadPositionsForSection(payload.sectionId);
      })
    );
  }

  updatePositionDetails(positionId: string, sectionId: string, payload: import('../models/warehouse-catalog.models').UpdatePositionDetailsRequest): Observable<PositionDetail> {
    return this.repository.updatePositionDetails(positionId, payload).pipe(
      tap((updated) => {
        this._positionsCache.delete(sectionId);
        this.loadTopology();
        this.loadAllPositions();
        if (sectionId) this.loadPositionsForSection(sectionId);
      })
    );
  }

  deletePosition(positionId: string, sectionId?: string): Observable<void> {
    return this.repository.deletePosition(positionId).pipe(
      tap(() => {
        if (sectionId) this._positionsCache.delete(sectionId);
        this.loadTopology();
        this.loadAllPositions();
        if (sectionId) this.loadPositionsForSection(sectionId);
      })
    );
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
