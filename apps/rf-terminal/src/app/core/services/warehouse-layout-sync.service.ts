/**
 * @file warehouse-layout-sync.service.ts
 * @description Servicio de sincronización de Bahías y Croquis 2D en Terminal RF (Tableta).
 * Conecta los movimientos físicos del Montacarguista (Descarga en Buffer, Reubicación en Rack y Putaway)
 * con el catálogo de bahías y la topología visual compartida con Mesa de Control / Admin Console.
 */

import { Injectable } from '@angular/core';

export const SIMULATED_BAY_STORAGE_KEY = '4g_simulated_bay_positions';
export const WAREHOUSE_CLEAN_MODE_KEY = '4g_warehouse_clean_mode';
export const DEFAULT_BAY_CAPACITY = 22;

export interface BayOccupancyRecord {
  code: string;
  currentTarimas: number;
  capacityTarimas: number;
  skuDescription: string;
  batchNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED';
  lastMovement: string;
}

@Injectable({
  providedIn: 'root',
})
export class WarehouseLayoutSyncService {
  /**
   * Obtiene las posiciones simuladas del almacén guardadas en localStorage
   */
  getSimulatedBays(): Record<string, Partial<BayOccupancyRecord>> {
    try {
      if (typeof localStorage === 'undefined') return {};
      const stored = localStorage.getItem(SIMULATED_BAY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Registra el depósito o reubicación de tarimas en una bahía o rack físico.
   * Homologado 100% con WarehouseLayoutService de la Consola Admin.
   */
  recordMovement(
    bayCode: string,
    tarimasCount: number,
    skuDescription?: string,
    batchNumber?: string,
    movementReference?: string,
    operatorName?: string
  ): void {
    if (!bayCode) return;
    const cleanCode = bayCode.trim().toUpperCase().replace(/\s+/g, '-');
    const currentSim = this.getSimulatedBays();
    const existing = currentSim[cleanCode];
    const capacity = (existing?.capacityTarimas && existing.capacityTarimas > 0)
      ? existing.capacityTarimas
      : DEFAULT_BAY_CAPACITY;
    const tarimas = Math.max(0, Number(tarimasCount) || 1);
    const status: 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' =
      tarimas >= capacity * 0.8 ? 'OCCUPIED' : (tarimas > 0 ? 'OCCUPIED' : 'AVAILABLE');
    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const op = operatorName || 'Montacarguista';

    currentSim[cleanCode] = {
      code: cleanCode,
      currentTarimas: tarimas,
      capacityTarimas: capacity,
      skuDescription: skuDescription || 'Mercancía WMS Almacenada',
      batchNumber: batchNumber || 'LOT-2026',
      status,
      lastMovement: `${movementReference || 'Depósito en bahía'} por ${op} (${timeStr})`,
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SIMULATED_BAY_STORAGE_KEY, JSON.stringify(currentSim));
        // Disparar evento de ventana para que otras pestañas o componentes reactivos sincronicen de inmediato
        window.dispatchEvent(new CustomEvent('4g:bay-updated', { detail: { code: cleanCode, tarimas } }));
      }
    } catch (e) {
      console.warn('No se pudo guardar la ocupación en localStorage', e);
    }
  }

  /**
   * Valida si un código corresponde a una ubicación de almacenamiento fija o temporal
   */
  isPermanentStorage(bayCode: string): boolean {
    if (!bayCode) return false;
    const upper = bayCode.toUpperCase();
    return !upper.startsWith('LOC-RAMP') && !upper.includes('RAMPA') && !upper.includes('BUFFER TEMPORAL');
  }
}
