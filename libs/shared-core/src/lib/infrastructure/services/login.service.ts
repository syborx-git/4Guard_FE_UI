/**
 * @file login.service.ts
 * @description Servicio de autenticación legado homologado con AuthService real (ADR-007).
 * Cero Mocks y Cero contraseñas quemadas. Todas las peticiones van al backend Spring Boot.
 */

import { Injectable, inject, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { LoginRequest } from '../../domain/models/user.model';
import { LoginResponse } from '../../domain/models/login.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly authService = inject(AuthService);

  get isLoading(): Signal<boolean> {
    return this.authService.isLoading;
  }

  /**
   * Autenticación segura delegada directamente a la API de backend de Spring Boot.
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.authService.login(request) as unknown as Observable<LoginResponse>;
  }
}
