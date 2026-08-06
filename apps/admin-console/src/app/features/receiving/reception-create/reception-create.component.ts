/**
 * @file reception-create.component.ts
 * @description Consola de Preparación de Expediente de Recepción [HU-016 Etapa A].
 * Componente standalone para preparación, cruce visual de líneas y derivación de prerrequisitos.
 * NO crea expedientes persistentes, NO asigna folios oficiales y NO muta FSM ni localStorage.
 */

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReceptionAppointmentService } from '../services/reception-appointment.service';
import { PurchaseOrderValidationService } from '../services/purchase-order-validation.service';
import { ReceptionCreationPreparationService } from '../services/reception-creation-preparation.service';
import {
  ReceptionCreationViewModel,
  CreateReceptionCommand,
} from '../models/reception-creation.models';

@Component({
  selector: 'fg-reception-create',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reception-create.component.html',
  styleUrl: './reception-create.component.css',
})
export class ReceptionCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentService = inject(ReceptionAppointmentService);
  private readonly poValidationService = inject(PurchaseOrderValidationService);
  private readonly prepService = inject(ReceptionCreationPreparationService);

  protected readonly isLoading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly viewModel = signal<ReceptionCreationViewModel | null>(null);

  // Estado de Preparación / Validado en UI (Sin Persistencia)
  protected readonly isValidated = signal<boolean>(false);
  protected readonly validationMessage = signal<string | null>(null);

  // Panel Técnico Dev/QA (Colapsado por defecto)
  protected readonly showTechnicalPanel = signal<boolean>(false);
  protected readonly commandPreview = signal<CreateReceptionCommand | null>(null);
  protected readonly commandJson = computed(() => {
    const cmd = this.commandPreview();
    return cmd ? JSON.stringify(cmd, null, 2) : '';
  });

  ngOnInit(): void {
    const appointmentId = this.route.snapshot.paramMap.get('appointmentId');
    if (!appointmentId) {
      this.error.set('No se especificó un código de cita válido.');
      this.isLoading.set(false);
      return;
    }

    this._loadPreparationContext(appointmentId);
  }

  private _loadPreparationContext(appointmentId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    const appt = this.appointmentService.getAppointmentById(appointmentId);
    if (!appt) {
      this.error.set(`No se encontró la cita con ID ${appointmentId}.`);
      this.isLoading.set(false);
      return;
    }

    const poNumber = appt.poNumber;
    const po = poNumber ? this.poValidationService.getPOByNumber(poNumber) : undefined;

    const vm = this.prepService.buildCreationViewModel(appt, po);
    this.viewModel.set(vm);

    const cmdPreview = this.prepService.buildCreationCommandPreview(vm);
    this.commandPreview.set(cmdPreview);

    this.isLoading.set(false);
  }

  /**
   * Acción Principal: "Validar expediente para creación"
   * Verifica la preparación técnica visual sin crear registros ni folios falsos.
   */
  protected validateExpedient(): void {
    const vm = this.viewModel();
    if (!vm) return;

    if (!vm.hasCreatePermission) {
      this.error.set('Acción no autorizada: Su usuario no cuenta con la capacidad RECEIVING_CREATE.');
      return;
    }

    if (vm.operationalReadiness.overallState === 'BLOCKED') {
      this.error.set('No es posible validar la preparación: La cita presenta prerrequisitos logísticos bloqueantes.');
      return;
    }

    if (!vm.isPoEligible) {
      this.error.set('No es posible validar la preparación: La Orden de Compra no está elegible o no cuenta con saldo.');
      return;
    }

    this.isValidated.set(true);
    this.validationMessage.set(
      'La información frontend fue validada. La autorización de sucursal, tenant y RLS aún requiere validación del servidor.'
    );
  }

  /**
   * Alterna la visibilidad del Panel Técnico de Dev/QA (Command JSON DTO)
   */
  protected toggleTechnicalPanel(): void {
    this.showTechnicalPanel.update((v) => !v);
  }

  /**
   * Copia el Command JSON al portapapeles (Herramienta QA)
   */
  protected copyCommandJson(): void {
    const json = this.commandJson();
    if (json) {
      navigator.clipboard.writeText(json);
    }
  }

  /**
   * Navega de regreso al Centro de Recepciones (HU-028)
   */
  protected navigateToCenter(): void {
    this.router.navigate(['/receiving']);
  }
}
