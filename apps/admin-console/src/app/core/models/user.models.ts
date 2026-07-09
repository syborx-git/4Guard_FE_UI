/**
 * @file user.models.ts
 * @description Interfaces tipadas basadas en la documentación Swagger del backend 4GUARD WMS.
 *
 * Endpoints documentados:
 *   PUT /api/v1/users/reset-password-temp?usernameOrEmail={valor}  — Pública, sin token
 *   PUT /api/v1/users/change-password                              — Con Bearer token
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
 *   PUT /api/v1/users/reset-password-temp?usernameOrEmail={valor}
 *
 * data: string — La contraseña temporal generada. Ejemplo: "4G-697c20ed*"
 */
export type ResetPasswordTempResponse = ApiResponse<string>;

/**
 * Body para el endpoint:
 *   PUT /api/v1/users/change-password
 *
 * Requiere Authorization: Bearer {accessToken}
 */
export interface ChangePasswordRequest {
  newPassword: string;
}

/**
 * Respuesta del endpoint:
 *   PUT /api/v1/users/change-password
 *
 * data: null — El backend no devuelve payload en este caso.
 */
export type ChangePasswordResponse = ApiResponse<null>;

/**
 * Datos detallados de un perfil de usuario.
 */
export interface UserProfileDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  roleId: string;
  roleName: string;
  status: string;
  isEnabled: boolean;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Respuesta del endpoint GET /api/v1/users/{id}
 */
export type UserProfileResponse = ApiResponse<UserProfileDto>;

/**
 * Payload requerido para crear un nuevo usuario mediante POST /api/v1/users.
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  branchId: string;
  roleId: string;
  status: string;
  isEnabled: boolean;
}



