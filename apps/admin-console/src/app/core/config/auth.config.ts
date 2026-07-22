/**
 * @file auth.config.ts
 * @description Configuración centralizada de constantes para el módulo de autenticación y seguridad (HU-010).
 */

export const AUTH_CONFIG = {
  /**
   * Duración del bloqueo temporal de cuenta tras agotar los intentos fallidos (en segundos).
   * 🚀 PRODUCCIÓN / FINAL: 900 segundos (15 minutos).
   */
  lockoutDurationSeconds: 900,

  /** Número máximo de intentos fallidos permitidos antes de activar el bloqueo temporal */
  maxFailedAttempts: 3,
};
