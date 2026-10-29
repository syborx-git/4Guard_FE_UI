/**
 * @file user.model.ts
 * @description Modelos de dominio para Usuario y Sesión.
 * Mapean exactamente el JSON retornado por el Backend Spring Boot.
 */

import { UserRole } from '../enums/role.enum';

/**
 * Representa un usuario del sistema 4GUARD WMS.
 * Mapea el DTO UserResponseDto del backend.
 */
export interface User {
  /** Identificador único del usuario (UUID) */
  id: string;

  /** Nombre completo del usuario */
  fullName: string;

  /** Correo electrónico (también usado como username) */
  email: string;

  /** Rol asignado en el sistema RBAC */
  role: UserRole;

  /** ID de la organización */
  organizationId?: string;

  /** ID de la sucursal/almacén al que pertenece */
  branchId: string;

  /** Nombre de la sucursal */
  branchName: string;

  /** Indica si la cuenta está activa */
  active: boolean;
  changePasswordRequired?: boolean;

  /** Username institucional (opcional si usa email) */
  username?: string;

  /** UUID del registro de Montacarguista vinculado (wms.forklift_operators.id) */
  forkliftOperatorId?: string;

  /** Código de operador / gafete (ej. MC-001) */
  employeeCode?: string;

  /** Organización o Corporativo */
  organizationName?: string;

  /** Fecha de creación del usuario (ISO 8601) */
  createdAt: string;

  /** Fecha de última modificación (ISO 8601) */
  updatedAt: string;
}

/**
 * Payload del JWT RS256 decodificado.
 * Refleja los claims del token emitido por el backend.
 */
export interface JwtPayload {
  /** Subject: ID del usuario */
  sub: string;

  /** Email del usuario */
  email: string;

  /** Rol del usuario */
  role: UserRole;

  /** ID de la sucursal activa */
  branchId: string;

  /** Timestamp de expiración (Unix) */
  exp: number;

  /** Timestamp de emisión (Unix) */
  iat: number;

  /** Issuer del token */
  iss: string;
}

/**
 * Respuesta del endpoint de login (/api/auth/login).
 */
export interface AuthResponse {
  /** JWT de acceso */
  accessToken: string;

  /** JWT de refresco */
  refreshToken: string;

  /** Segundos hasta expiración del access token */
  expiresIn: number;

  /** Datos del usuario autenticado */
  user: User;
}

/**
 * Payload para el endpoint de login.
 */
export interface LoginRequest {
  email: string;
  password: string;
}
