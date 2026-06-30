/**
 * @file login.model.ts
 * @description Interfaces de dominio para la respuesta de login y sucursales.
 */

import { User } from './user.model';

/**
 * Representa una sucursal del sistema 4GUARD.
 */
export interface Branch {
  /** Identificador único de la sucursal */
  id: string;

  /** Nombre comercial o descriptivo de la sucursal */
  name: string;

  /** Indica si la sucursal está habilitada para operar */
  enabled: boolean;

  /** Texto opcional que describe el estado (ej. "Próximamente disponible") */
  statusText?: string;
}

/**
 * Respuesta del servicio de autenticación estructurada para inicio de sesión en dos pasos.
 */
export interface LoginResponse {
  /** Token JWT de acceso */
  accessToken: string;

  /** Token JWT de refresco */
  refreshToken: string;

  /** Datos del usuario autenticado */
  user: User;

  /** Lista de sucursales a las que tiene acceso el usuario */
  branches: Branch[];
}
