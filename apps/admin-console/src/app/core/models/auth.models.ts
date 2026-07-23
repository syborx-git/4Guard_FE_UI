/**
 * @file auth.models.ts
 * @description Modelos de tipado para el sistema de autenticación y autorización JWT.
 */

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roleLevel: number;
  permissions: string[];
  /** Indica si el usuario debe cambiar su contraseña en el próximo inicio de sesión. */
  changePasswordRequired: boolean;
}

export interface JwtSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: JwtSession;
  timestamp: string;
}

export interface FailedLoginState {
  identifier: string;
  failedAttempts: number;
}

export interface AuthLockoutState {
  identifier: string;
  failedAttempts: number;
  lockedUntil: number;
}
