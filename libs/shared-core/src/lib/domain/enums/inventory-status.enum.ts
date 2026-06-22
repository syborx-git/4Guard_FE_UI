/**
 * @file inventory-status.enum.ts
 * @description FSM (Finite State Machine) de inventario de 4GUARD.
 * Define los 8 estados posibles de un ítem en el WMS, del estado 10 al 80.
 * Estos valores mapean exactamente los códigos del Backend (Spring Boot).
 */

/**
 * Estados del inventario de 4GUARD WMS.
 * La FSM controla las transiciones válidas entre estados.
 */
export enum InventoryStatus {
  /** Estado 10: El ítem ha sido recibido físicamente pero aún no procesado */
  RECEIVED = 10,

  /** Estado 20: El ítem está en cuarentena pendiente de inspección de calidad (QM) */
  QUARANTINE = 20,

  /** Estado 30: El ítem está disponible para picking y despacho */
  AVAILABLE = 30,

  /** Estado 40: El ítem tiene reserva activa para una orden de salida */
  RESERVED = 40,

  /** Estado 50: El ítem está siendo extraído físicamente (picking en proceso) */
  IN_PICKING = 50,

  /** Estado 60: El ítem ha sido despachado y salió del almacén */
  DISPATCHED = 60,

  /** Estado 70: El ítem está bloqueado por control de calidad (no puede moverse) */
  QM_BLOCKED = 70,

  /** Estado 80: El ítem ha sido dado de baja del sistema (ajuste de inventario) */
  WRITTEN_OFF = 80,
}

/**
 * Mapa de transiciones válidas en la FSM.
 * Clave: estado origen. Valor: array de estados destino permitidos.
 */
export const INVENTORY_FSM_TRANSITIONS: Record<InventoryStatus, InventoryStatus[]> = {
  [InventoryStatus.RECEIVED]:   [InventoryStatus.QUARANTINE, InventoryStatus.AVAILABLE, InventoryStatus.QM_BLOCKED],
  [InventoryStatus.QUARANTINE]: [InventoryStatus.AVAILABLE, InventoryStatus.QM_BLOCKED, InventoryStatus.WRITTEN_OFF],
  [InventoryStatus.AVAILABLE]:  [InventoryStatus.RESERVED, InventoryStatus.QM_BLOCKED, InventoryStatus.QUARANTINE],
  [InventoryStatus.RESERVED]:   [InventoryStatus.AVAILABLE, InventoryStatus.IN_PICKING, InventoryStatus.QM_BLOCKED],
  [InventoryStatus.IN_PICKING]: [InventoryStatus.DISPATCHED, InventoryStatus.AVAILABLE, InventoryStatus.QM_BLOCKED],
  [InventoryStatus.DISPATCHED]: [],
  [InventoryStatus.QM_BLOCKED]: [InventoryStatus.AVAILABLE, InventoryStatus.QUARANTINE, InventoryStatus.WRITTEN_OFF],
  [InventoryStatus.WRITTEN_OFF]: [],
};

/**
 * Obtiene las etiquetas legibles para cada estado.
 */
export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  [InventoryStatus.RECEIVED]:   'Recibido',
  [InventoryStatus.QUARANTINE]: 'Cuarentena',
  [InventoryStatus.AVAILABLE]:  'Disponible',
  [InventoryStatus.RESERVED]:   'Reservado',
  [InventoryStatus.IN_PICKING]: 'En Picking',
  [InventoryStatus.DISPATCHED]: 'Despachado',
  [InventoryStatus.QM_BLOCKED]: 'Bloqueado QM',
  [InventoryStatus.WRITTEN_OFF]:'Dado de Baja',
};

/**
 * Verifica si una transición de estado es válida según la FSM.
 */
export function isValidTransition(from: InventoryStatus, to: InventoryStatus): boolean {
  return INVENTORY_FSM_TRANSITIONS[from]?.includes(to) ?? false;
}
