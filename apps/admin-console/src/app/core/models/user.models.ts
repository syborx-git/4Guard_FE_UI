/**
 * @file user.models.ts
 * @description Interfaces tipadas basadas en la documentación Swagger del backend 4GUARD WMS.
 *
 * Endpoint documentado:
 *   PUT /api/v1/users/{id}/reset-password-temp
 *   Permiso requerido: USERS_UPDATE
 */

/**
 * Envoltorio genérico de respuesta del API del backend.
 * Cubre todos los endpoints bajo /api/v1.
 */
export interface ApiResponse<T> {
  /** Indica si la operación fue exitosa */
  success: boolean;
  /** Mensaje legible proveniente del backend */
  message: string;
  /** Payload de la respuesta — tipado genérico */
  data: T;
  /** Timestamp ISO 8601 del servidor */
  timestamp: string;
}

/**
 * Datos del usuario devueltos por los endpoints de gestión de usuarios.
 */
export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roleLevel: number;
  branchId: string;
  branchName: string;
  active: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Respuesta específica del endpoint:
 *   PUT /api/v1/users/{id}/reset-password-temp
 *
 * data: string — La contraseña temporal generada. Ejemplo: "4G-temp-ABCD"
 */
export type ResetPasswordTempResponse = ApiResponse<string>;
