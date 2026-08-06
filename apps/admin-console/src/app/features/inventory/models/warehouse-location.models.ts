/**
 * @file warehouse-location.models.ts
 * @description Modelos de datos compartidos para Ubicaciones Físicas del Almacén (Racks, Cuarentena, Staging y Muelles) [HU-030 / HU-048].
 */

/** Estado Operativo Físico del Muelle en la Sucursal */
export type DockOperationalStatus =
  | 'AVAILABLE'            // Disponible para recibir vehículos
  | 'RESERVED'             // Reservado por una cita entrante
  | 'OCCUPIED'             // Ocupado físicamente por un tráiler
  | 'MAINTENANCE'          // En mantenimiento técnico
  | 'OUT_OF_SERVICE'       // Fuera de servicio operativo
  | 'BLOCKED';             // Bloqueado administrativamente

/** Representa la entidad física de un Muelle en la Sucursal */
export interface DockItem {
  id: string;                  // e.g. 'LOC-AND-01'
  code: string;                // e.g. 'AND-01'
  displayName: string;         // e.g. 'Muelle AND-01'
  branchId: string;
  branchName: string;
  operationalStatus: DockOperationalStatus;
  currentAppointmentId?: string;
  reservedAppointmentId?: string;
  reservationExpiresAt?: string; // Timestamp ISO para expiración (Lazy timeout)
  occupiedSince?: string;
  positioningStartedAt?: string;
  version: number;
  updatedAt: string;
}

/** Entidad genérica para Bahía/Ubicación en el Almacén (Topología HU-048) */
export interface WarehouseBayItem {
  id: string;
  code: string;
  type: 'RACK' | 'QUARANTINE_ZONE' | 'DOCK' | 'STAGING';
  branchId: string;
  row: number;
  col: number;
  capacity: number;
  occupied: number;
  isBlocked: boolean;
}
