/**
 * @file login.component.spec.ts
 * @description Pruebas unitarias para LoginComponent y persistencia de bloqueo por intentos fallidos (HU-010).
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { SessionStorageService } from '../../../core/services/session-storage.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AUTH_CONFIG } from '../../../core/config/auth.config';

describe('LoginComponent — Persistencia de Bloqueo por Intentos Fallidos (HU-010)', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let sessionStorageService: SessionStorageService;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let authStateSpy: jasmine.SpyObj<AuthState>;

  beforeEach(async () => {
    localStorage.clear();

    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    authStateSpy = jasmine.createSpyObj('AuthState', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        SessionStorageService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AuthState, useValue: authStateSpy },
        provideRouter([]),
      ],
    }).compileComponents();

    sessionStorageService = TestBed.inject(SessionStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('1. Debe crearse el componente correctamente', () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('2. Debe restaurar inmediatamente el estado locked-temporary si existe un bloqueo activo en localStorage (F5 / Refresh)', () => {
    const futureTime = Date.now() + 120000; // 2 minutos en el futuro
    sessionStorageService.setAuthLockout({
      identifier: 'test@4guard.com',
      failedAttempts: 3,
      lockedUntil: futureTime,
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Ejecuta ngOnInit()

    expect((component as any).viewState()).toBe('locked-temporary');
    expect((component as any).lockTimeRemaining()).toBeGreaterThan(0);
  });

  it('3. Debe limpiar el bloqueo y mostrar el formulario normal si el timestamp en localStorage ya expiró', () => {
    const pastTime = Date.now() - 10000; // Expirado hace 10s
    sessionStorageService.setAuthLockout({
      identifier: 'test@4guard.com',
      failedAttempts: 3,
      lockedUntil: pastTime,
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect((component as any).viewState()).toBe('login');
    expect(sessionStorageService.getAuthLockout()).toBeNull();
  });

  it('4. Debe bloquear onSubmit() cuando el estado sea locked-temporary', () => {
    sessionStorageService.setAuthLockout({
      identifier: 'test@4guard.com',
      failedAttempts: 3,
      lockedUntil: Date.now() + 60000,
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.emailCtrl.setValue('test@4guard.com');
    component.passwordCtrl.setValue('admin123');

    (component as any).onSubmit();

    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('5. Debe incrementar y conservar intentos fallidos por correo normalizado', () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.emailCtrl.setValue('  TEST@4guard.com  ');
    component.passwordCtrl.setValue('wrongpass');

    authServiceSpy.login.and.returnValue(
      of({ success: false, message: 'Bad creds', data: null as any, timestamp: '' })
    );

    (component as any).onSubmit();

    expect(sessionStorageService.getFailedAttempts('test@4guard.com')).toBe(1);
    expect((component as any).attemptsRemaining()).toBe(AUTH_CONFIG.maxFailedAttempts - 1);
  });

  it('6. Debe activar el bloqueo al acumular 3 intentos fallidos consecutivamente', () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const normalizedEmail = 'op@4guard.com';
    sessionStorageService.saveFailedAttempts(normalizedEmail, 2);

    component.emailCtrl.setValue(normalizedEmail);
    component.passwordCtrl.setValue('wrongpass');

    authServiceSpy.login.and.returnValue(
      of({ success: false, message: 'Acceso denegado', data: null as any, timestamp: '' })
    );

    (component as any).onSubmit();

    expect((component as any).viewState()).toBe('locked-temporary');
    expect(sessionStorageService.getAuthLockout()).not.toBeNull();
    expect(sessionStorageService.getAuthLockout()?.identifier).toBe(normalizedEmail);
  });

  it('7. Debe limpiar el bloqueo e intentos tras un login exitoso', () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const normalizedEmail = 'success@4guard.com';
    sessionStorageService.saveFailedAttempts(normalizedEmail, 2);

    component.emailCtrl.setValue(normalizedEmail);
    component.passwordCtrl.setValue('correctpass');

    authServiceSpy.login.and.returnValue(
      of({
        success: true,
        message: 'OK',
        data: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: '',
          user: {
            id: '1',
            username: 'admin',
            fullName: 'Admin Test',
            email: normalizedEmail,
            role: 'ADMIN',
            roleLevel: 10,
            permissions: [],
            changePasswordRequired: false,
          },
        },
        timestamp: '',
      })
    );

    (component as any).onSubmit();

    expect(sessionStorageService.getFailedAttempts(normalizedEmail)).toBe(0);
    expect(sessionStorageService.getAuthLockout()).toBeNull();
    expect(authStateSpy.login).toHaveBeenCalled();
  });

  it('8. Debe manejar de forma segura JSON corrupto en localStorage sin romper la aplicación', () => {
    localStorage.setItem('4guard_auth_lockout', '{ corrupt_json: ');

    expect(() => {
      fixture = TestBed.createComponent(LoginComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    }).not.toThrow();

    expect((component as any).viewState()).toBe('login');
    expect(localStorage.getItem('4guard_auth_lockout')).toBeNull();
  });
});
