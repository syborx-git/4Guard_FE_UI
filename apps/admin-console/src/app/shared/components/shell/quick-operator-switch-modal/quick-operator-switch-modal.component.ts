/**
 * @file quick-operator-switch-modal.component.ts
 * @description Componente Modal para Autenticación y Cambio Rápido de Operador por PIN de 4 dígitos.
 */

import { Component, EventEmitter, Input, Output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthState } from '../../../../core/auth/auth.state';
import { AuthenticatedUser } from '../../../../core/models/auth.models';

@Component({
  selector: 'fg-quick-operator-switch-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quick-operator-switch-modal.component.html',
  styleUrl: './quick-operator-switch-modal.component.css'
})
export class QuickOperatorSwitchModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  protected readonly authState = inject(AuthState);

  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  protected switchForm!: FormGroup;
  protected pinError = signal<string | null>(null);
  protected switchSuccess = signal<string | null>(null);

  /** Lista de Operadores Habilitados para Cambio Rápido de Turno */
  protected readonly availableOperators: AuthenticatedUser[] = [
    {
      id: 'usr-001',
      username: 'enrique.morales',
      fullName: 'Enrique Morales',
      email: 'enrique@4guard.com',
      role: 'OPERATIONS_MANAGER',
      roleLevel: 9,
      permissions: ['ALL'],
      changePasswordRequired: false,
      pinCode: '1234',
      shift: 'TURNO 1'
    },
    {
      id: 'usr-002',
      username: 'christian.duran',
      fullName: 'Christian Durán',
      email: 'cduran@4guard.com',
      role: 'FORKLIFT_OPERATOR',
      roleLevel: 3,
      permissions: ['INVENTORY_READ', 'RECEIVING_CREATE'],
      changePasswordRequired: false,
      pinCode: '4321',
      shift: 'TURNO 1'
    },
    {
      id: 'usr-003',
      username: 'pablo.ruiz',
      fullName: 'Pablo Ruiz',
      email: 'pablo.ruiz@4guard.com',
      role: 'RECEIVING_SUPERVISOR',
      roleLevel: 5,
      permissions: ['RECEIVING_READ', 'RECEIVING_CREATE', 'SHIPPING_CREATE'],
      changePasswordRequired: false,
      pinCode: '9999',
      shift: 'TURNO 2'
    },
    {
      id: 'usr-004',
      username: 'maria.lopez',
      fullName: 'María Fernanda López',
      email: 'mlopez@4guard.com',
      role: 'QUALITY_AUDITOR',
      roleLevel: 4,
      permissions: ['QUALITY_READ', 'QUALITY_CREATE'],
      changePasswordRequired: false,
      pinCode: '8888',
      shift: 'TURNO 2'
    }
  ];

  ngOnInit(): void {
    const currentId = this.authState.currentUser()?.id || 'usr-001';

    this.switchForm = this.fb.group({
      selectedOperatorId: [currentId, Validators.required],
      pinCode: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
    });
  }

  protected onSwitchSubmit(): void {
    if (this.switchForm.invalid) {
      this.pinError.set('Ingresa un PIN válido de 4 dígitos.');
      return;
    }

    const { selectedOperatorId, pinCode } = this.switchForm.value;
    const targetOperator = this.availableOperators.find((op) => op.id === selectedOperatorId);

    if (!targetOperator) {
      this.pinError.set('Operador no encontrado.');
      return;
    }

    const isOk = this.authState.switchOperator(targetOperator, pinCode);

    if (isOk) {
      this.pinError.set(null);
      this.switchSuccess.set(`¡Operador conmutado exitosamente a ${targetOperator.fullName}!`);
      
      setTimeout(() => {
        this.switchSuccess.set(null);
        this.switchForm.patchValue({ pinCode: '' });
        this.closeModal.emit();
      }, 1200);
    } else {
      this.pinError.set('PIN incorrecto. Verifica la clave de 4 dígitos.');
    }
  }

  protected onClose(): void {
    this.pinError.set(null);
    this.switchSuccess.set(null);
    this.switchForm.patchValue({ pinCode: '' });
    this.closeModal.emit();
  }
}
