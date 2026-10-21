/**
 * @file login.service.ts
 * @description Servicio Mock de Autenticación para HU-001.
 * Simula peticiones asíncronas al servidor con retardo y manejo de errores.
 */

import { Injectable, signal, Signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { LoginRequest } from '../../domain/models/user.model';
import { LoginResponse, Branch } from '../../domain/models/login.model';
import { UserRole } from '../../domain/enums/role.enum';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly _isLoading = signal<boolean>(false);

  /**
   * Señal para indicar si hay un proceso de carga de login en curso.
   */
  get isLoading(): Signal<boolean> {
    return this._isLoading.asReadonly();
  }

  /**
   * Simula la autenticación asíncrona de un usuario.
   * Si la contraseña es "wrongpassword" o el email contiene "invalid",
   * la petición fallará con fines de prueba para el manejo de errores.
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    this._isLoading.set(true);

    const email = request.email.toLowerCase();

    // Simular error de credenciales incorrectas
    if (request.password === 'wrongpassword' || email.includes('invalid')) {
      return throwError(() => new Error('Credenciales incorrectas. Verifica tu correo y contraseña.'))
        .pipe(
          delay(800), // Simula latencia del servidor en caso de error
          tap({
            finalize: () => this._isLoading.set(false)
          })
        );
    }

    // Determinar el rol y nombre según el email para mantener coherencia con el sistema RBAC
    let role = UserRole.ADMIN;
    let fullName = 'Carlos Herrera';

    // Extraer solo la parte local del usuario para no colisionar con el dominio @4guard.mx
    const userPrefix = email.split('@')[0];

    if (userPrefix.includes('director') || userPrefix.includes('admin') || userPrefix.includes('ceo')) {
      role = UserRole.ADMIN;
      fullName = 'Ing. Carlos Herrera (Director General)';
    } else if (userPrefix.includes('manager') || userPrefix.includes('gerente')) {
      role = UserRole.OPERATIONS_MANAGER;
      fullName = 'Ing. Roberto Garza (Gerente Operaciones)';
    } else if (userPrefix.includes('coord')) {
      role = UserRole.OPERATIONS_COORDINATOR;
      fullName = 'Lic. Fernando Lozano (Coordinador Operaciones)';
    } else if (userPrefix.includes('super') || userPrefix.includes('sup')) {
      role = UserRole.OPERATIONS_SUPERVISOR;
      fullName = 'Ing. Héctor Salinas (Supervisor Operaciones)';
    } else if (userPrefix.includes('control') || userPrefix.includes('mesa')) {
      role = UserRole.CONTROL_DESK;
      fullName = 'Lic. Patricia Gómez (Mesa de Control)';
    } else if (userPrefix.includes('lider') || userPrefix.includes('shift')) {
      role = UserRole.SHIFT_LEADER;
      fullName = 'Ricardo Peña (Líder de Turno)';
    } else if (userPrefix.includes('qm') || userPrefix.includes('calidad')) {
      role = UserRole.QM_INSPECTOR;
      fullName = 'Dra. Elena Ramos (Inspector de Calidad)';
    } else if (userPrefix.includes('security') || userPrefix.includes('guard') || userPrefix.includes('caseta') || userPrefix.includes('vigilant')) {
      role = UserRole.SECURITY_GUARD;
      fullName = 'Carlos Mendoza (Guardia Caseta)';
    } else if (userPrefix.includes('montacarg') || userPrefix.includes('operad') || userPrefix.includes('fork') || userPrefix.includes('op')) {
      role = UserRole.WAREHOUSE_OPERATOR;
      fullName = 'Oficial Montacarguista';
    } else {
      role = UserRole.WAREHOUSE_OPERATOR;
      fullName = 'Oficial Montacarguista';
    }

    // Asignar sucursal según el correo electrónico para simular la base de datos
    const isQueretaro = email.includes('qro') || email.includes('queretaro');
    const branchId = isQueretaro ? 'BR-QRO-01' : 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    const branchName = isQueretaro ? '4GUARD Querétaro' : 'CENTRO DE DISTRIBUCION CDMX';

    const mockUser = {
      id: `u-${role.toLowerCase()}`,
      fullName,
      email: request.email,
      role,
      branchId,
      branchName,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockBranches: Branch[] = [
      { id: 'BR-TOL-01', name: '4GUARD Toluca', enabled: true },
      { id: 'BR-QRO-01', name: '4GUARD Querétaro', enabled: false, statusText: 'Próximamente disponible' }
    ];

    const response: LoginResponse = {
      accessToken: `mock-jwt-token-for-${role}-${Date.now()}`,
      refreshToken: `mock-refresh-token-for-${role}-${Date.now()}`,
      user: mockUser,
      branches: mockBranches
    };

    return of(response).pipe(
      delay(800), // Simula latencia del servidor en caso de éxito
      tap({
        next: () => this._isLoading.set(false),
        error: () => this._isLoading.set(false),
        finalize: () => this._isLoading.set(false)
      })
    );
  }
}
