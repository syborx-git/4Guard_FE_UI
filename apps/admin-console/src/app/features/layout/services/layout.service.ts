/**
 * @file layout.service.ts
 * @description Servicio de Gestión de Layout y Ubicaciones — 4GUARD WMS.
 * HU-127
 *
 * Integrado completamente con el Backend a través de LocationService y SectionService.
 */

import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { LocationService, Location, LocationResponse, LocationType } from '../../admin/services/location.service';
import { SectionService } from '../../admin/services/section.service';
import {
  WarehouseLocation,
  LocationAuditEntry,
  CreateLocationPayload,
  UpdateLocationPayload,
  ChangeStatusPayload,
  WarehouseZone,
  LocationStatus,
} from '../models/warehouse-location.model';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly locationSvc = inject(LocationService);
  private readonly sectionSvc = inject(SectionService);

  // ── Consultas ──────────────────────────────────────────────────────────────

  /** Retorna la lista completa de ubicaciones del almacén */
  getLocations(): Observable<WarehouseLocation[]> {
    return this.locationSvc.loadLocations().pipe(
      map(locs => locs.map(l => this.mapLocationToWarehouseLocation(l)))
    );
  }

  /** Retorna las zonas disponibles del almacén desde SectionService */
  getZones(): Observable<WarehouseZone[]> {
    return this.sectionSvc.loadSections().pipe(
      map(sections => sections.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
      })))
    );
  }

  /** Retorna una ubicación por ID */
  getLocationById(id: string): Observable<WarehouseLocation> {
    return this.getLocations().pipe(
      map(locs => {
        const found = locs.find(l => l.id === id);
        if (!found) {
          throw new Error(`Ubicación ${id} no encontrada`);
        }
        return found;
      })
    );
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /** Crea una nueva ubicación en el backend */
  createLocation(payload: CreateLocationPayload): Observable<WarehouseLocation> {
    const levelNum = payload.level ? parseInt(payload.level.replace(/\D/g, ''), 10) || 1 : 1;

    const request: Partial<Location> = {
      branchId: payload.warehouseId,
      sectionId: payload.zoneId,
      zone: payload.zoneCode || 'ALMC',
      aisle: payload.aisle || undefined,
      rack: payload.rack || undefined,
      level: levelNum,
      position: payload.position || undefined,
      coordX: payload.coordX ?? 0,
      coordY: payload.coordY ?? 0,
      coordZ: payload.coordZ ?? 0,
      type: (payload.locationType || 'PALLET') as LocationType,
      capacityUnits: payload.maxCapacity,
      code: payload.code,
      name: payload.name,
      notes: payload.observations || undefined,
    };

    return this.locationSvc.create(request).pipe(
      map(res => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Error al crear la ubicación.');
        }
        return this.mapLocationToWarehouseLocation(this.locationSvc.getAll().find(l => l.id === res.data.id) || {
          ...res.data,
          type: res.data.type as LocationType,
          status: res.data.status || 'ACTIVE',
          blockReason: res.data.blockReason || ''
        });
      })
    );
  }

  /** Edita una ubicación existente en el backend */
  updateLocation(id: string, payload: UpdateLocationPayload): Observable<WarehouseLocation> {
    const levelNum = payload.level ? parseInt(payload.level.replace(/\D/g, ''), 10) || 1 : 1;

    const request: Partial<Location> = {
      id,
      branchId: payload.warehouseId,
      sectionId: payload.zoneId,
      zone: payload.zoneCode || 'ALMC',
      aisle: payload.aisle || undefined,
      rack: payload.rack || undefined,
      level: levelNum,
      position: payload.position || undefined,
      coordX: payload.coordX ?? 0,
      coordY: payload.coordY ?? 0,
      coordZ: payload.coordZ ?? 0,
      type: (payload.locationType || 'PALLET') as LocationType,
      capacityUnits: payload.maxCapacity,
      code: payload.code,
      name: payload.name,
      notes: payload.observations || undefined,
    };

    return this.locationSvc.update(id, request).pipe(
      map(res => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Error al actualizar la ubicación.');
        }
        return this.mapLocationToWarehouseLocation(this.locationSvc.getAll().find(l => l.id === id) || {
          ...res.data,
          type: res.data.type as LocationType,
          status: res.data.status || 'ACTIVE',
          blockReason: res.data.blockReason || ''
        });
      })
    );
  }

  /** Cambia el estado FSM de una ubicación vía PATCH /status */
  changeStatus(id: string, payload: ChangeStatusPayload): Observable<WarehouseLocation> {
    return this.locationSvc.changeStatus(id, payload.status, payload.reason).pipe(
      map(res => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Error al cambiar el estado de la ubicación.');
        }
        return this.mapLocationToWarehouseLocation(this.locationSvc.getAll().find(l => l.id === id) || {
          ...res.data,
          type: res.data.type as LocationType,
          status: res.data.status || 'ACTIVE',
          blockReason: res.data.blockReason || ''
        });
      })
    );
  }

  /** Elimina una ubicación del backend */
  deleteLocation(id: string): Observable<void> {
    return this.locationSvc.delete(id).pipe(
      map(res => {
        if (!res.success) {
          throw new Error(res.message || 'Error al eliminar la ubicación.');
        }
        return undefined;
      })
    );
  }

  /** Retorna el historial de auditoría de una ubicación desde el backend */
  getLocationHistory(id: string): Observable<LocationAuditEntry[]> {
    return this.locationSvc.getLocationAudit(id).pipe(
      map(res => {
        if (!res.success || !res.data) return [];
        return res.data.map(entry => {
          let summary = 'Acción registrada';
          let icon = 'info';
          let color: 'create' | 'update' | 'status' | 'delete' | 'info' = 'info';

          switch (entry.action) {
            case 'LOCATION_CREATED':
              summary = 'Ubicación registrada';
              icon = 'add_circle';
              color = 'create';
              break;
            case 'LOCATION_UPDATED':
              summary = 'Información actualizada';
              icon = 'edit';
              color = 'update';
              break;
            case 'LOCATION_STATUS_UPDATED':
              summary = 'Cambio de estatus operativo';
              icon = 'swap_horiz';
              color = 'status';
              break;
            case 'LOCATION_DELETED':
              summary = 'Ubicación eliminada';
              icon = 'delete';
              color = 'delete';
              break;
            default:
              summary = entry.action;
          }

          const friendlyDetails = (entry.details || []).map(det => ({
            ...det,
            fieldName: this.formatAuditFieldName(det.fieldName)
          }));

          return {
            id: entry.logId,
            locationId: id,
            action: entry.action,
            summary,
            performedBy: entry.username || 'Sistema WMS',
            performedAt: entry.createdAt,
            username: entry.username || 'Sistema WMS',
            createdAt: entry.createdAt,
            details: friendlyDetails,
            timelineIcon: icon,
            timelineColor: color,
          };
        });
      }),
      catchError(() => of([]))
    );
  }

  private formatAuditFieldName(fieldName: string): string {
    const fieldMap: Record<string, string> = {
      notes: 'Notas / Observaciones',
      capacityUnits: 'Capacidad Máxima',
      status: 'Estatus Operativo',
      statusReason: 'Motivo de Estatus',
      blockReason: 'Motivo de Bloqueo',
      type: 'Tipo de Ubicación',
      isBlocked: 'Estado de Bloqueo',
      code: 'Código',
      name: 'Nombre Descriptivo',
      aisle: 'Pasillo',
      rack: 'Rack',
      level: 'Nivel',
      position: 'Posición',
      sectionId: 'Sección / Zona',
      branchId: 'Sucursal'
    };
    return fieldMap[fieldName] || fieldName;
  }

  // ── Mappers Privados ───────────────────────────────────────────────────────

  private mapLocationToWarehouseLocation(loc: Location | LocationResponse): WarehouseLocation {
    const maxCap = loc.capacityUnits || 1;
    const currentOcc = loc.currentOccupancy ?? 0;
    const occPct = Math.min(100, Math.round((currentOcc / maxCap) * 100));
    const availCap = Math.max(0, maxCap - currentOcc);
    const status: LocationStatus = loc.status || (loc.isBlocked ? 'BLOCKED' : 'ACTIVE');

    return {
      id: loc.id,
      code: loc.code || `${loc.zone || 'Z'}-${loc.aisle || ''}-${loc.rack || ''}-${loc.level ? 'N' + loc.level : ''}`,
      name: loc.name || `${loc.sectionName || loc.zone} – Pasillo ${loc.aisle || 'N/A'} – Rack ${loc.rack || 'N/A'}`,
      warehouseId: loc.branchId,
      warehouseName: loc.branchName || 'Almacén Principal',
      zoneId: loc.sectionId || loc.zone,
      zoneCode: loc.zone,
      zoneName: loc.sectionName || loc.zone,
      aisle: loc.aisle || undefined,
      rack: loc.rack || undefined,
      level: loc.level ? String(loc.level) : undefined,
      position: loc.position || undefined,
      coordX: loc.coordX,
      coordY: loc.coordY,
      coordZ: loc.coordZ,
      locationType: (loc.type as LocationType) || 'PALLET',
      maxCapacity: maxCap,
      currentOccupancy: currentOcc,
      occupancyPercentage: occPct,
      availableCapacity: availCap,
      status: status,
      observations: loc.notes || loc.statusReason || loc.blockReason || undefined,
      createdAt: loc.createdAt || new Date().toISOString(),
      updatedAt: loc.updatedAt || new Date().toISOString(),
      updatedBy: 'Sistema WMS',
      lastAction: 'UPDATE',
      canDelete: currentOcc === 0 && status === 'INACTIVE',
      canDeactivate: status === 'ACTIVE',
      canBlock: status === 'ACTIVE',
      canReactivate: status !== 'ACTIVE',
    };
  }
}
