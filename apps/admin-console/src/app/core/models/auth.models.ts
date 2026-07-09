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
