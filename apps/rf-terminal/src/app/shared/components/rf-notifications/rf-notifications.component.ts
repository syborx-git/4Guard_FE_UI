/**
 * @file rf-notifications.component.ts
 * @description Widget Compacto de Notificaciones Operativas en Tiempo Real para la Terminal RF.
 * Homologado con el flujo de Caseta de Seguridad (ADR-017, ADR-018) y Almacén.
 * 
 * Flujo de Caseta (/security):
 * - Choferes QR: Pases enviados desde celular (F01) listos con acción 1-tap "Cargar en Caseta".
 * - Salidas (Check-Out): Unidades con maniobra concluida listas para registro de salida.
 * - Rampas: Andenes asignados por almacén para dar acceso al transportista.
 * 
 * Flujo de Almacén (/cockpit, /receiving):
 * - Pre-Recepciones: Unidades registradas en caseta listas para descarga física.
 */

import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  RfNotificationService,
  DriverPassNotification,
  ReadyExitPassNotification,
  RampAlertNotification,
  ReceptionAlertNotification
} from '../../../core/services/rf-notification.service';

export type SecurityNotifTab = 'ALL' | 'QR_PASSES' | 'EXITS' | 'RAMPS';

@Component({
  selector: 'fg-rf-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rf-notifications.component.html',
  styleUrl: './rf-notifications.component.css'
})
export class RfNotificationsComponent {
  protected readonly notifService = inject(RfNotificationService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  // ── Estado de apertura del dropdown ──
  public readonly isOpen = signal<boolean>(false);
  public readonly selectedTab = signal<SecurityNotifTab>('ALL');

  // ── Señales del Servicio ──
  public readonly isSecurityContext = this.notifService.isSecurityContext;
  public readonly pendingDriverPasses = this.notifService.pendingDriverPasses;
  public readonly pendingDriverPassesCount = this.notifService.pendingDriverPassesCount;

  public readonly pendingRampAssignments = this.notifService.pendingRampAssignments;
  public readonly pendingRampAssignmentsCount = this.notifService.pendingRampAssignmentsCount;

  public readonly readyForExitPasses = this.notifService.readyForExitPasses;
  public readonly readyForExitCount = this.notifService.readyForExitCount;

  public readonly pendingReceptions = this.notifService.pendingReceptions;
  public readonly pendingReceptionsCount = this.notifService.pendingReceptionsCount;

  public readonly totalVisibleCount = this.notifService.totalVisibleCount;
  public readonly hasNewArrivalBeacon = this.notifService.hasNewArrivalBeacon;
  public readonly isSoundMuted = this.notifService.isSoundMuted;

  // ── Control de Apertura / Cierre ──
  public toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  public closeDropdown(): void {
    this.isOpen.set(false);
  }

  public setTab(tab: SecurityNotifTab): void {
    this.selectedTab.set(tab);
  }

  // ── Acciones de Caseta de Seguridad (ADR-017 / ADR-018) ──

  /**
   * Carga 1-Tap de datos del Chofer en el Formulario Oficial F01
   */
  public loadDriverPassIntoGate(pass: DriverPassNotification): void {
    this.closeDropdown();
    this.notifService.requestLoadDriverPass(pass);
    this.router.navigate(['/security'], { queryParams: { tab: 'REGISTRATION', token: pass.token } });
  }

  /**
   * Lleva a la pestaña de Salidas en Caseta para registrar la salida oficial y sellos
   */
  public openCheckout(pass: ReadyExitPassNotification): void {
    this.closeDropdown();
    this.notifService.dismissExitPass(pass.folio);
    this.router.navigate(['/security'], { queryParams: { tab: 'IN_YARD', token: pass.token || pass.folio } });
  }

  /**
   * Da acceso a la rampa asignada
   */
  public openRampAccess(ramp: RampAlertNotification): void {
    this.closeDropdown();
    this.notifService.dismissRamp(ramp.folio);
    this.router.navigate(['/security'], { queryParams: { tab: 'IN_YARD', folio: ramp.folio } });
  }

  // ── Acciones de Almacén / Montacarguista ──
  public openReceptionInCockpit(rec: ReceptionAlertNotification): void {
    this.closeDropdown();
    this.router.navigate(['/cockpit'], { queryParams: { folio: rec.folio } });
  }

  public goToSecurityModule(): void {
    this.closeDropdown();
    this.router.navigate(['/security']);
  }

  public goToCockpit(): void {
    this.closeDropdown();
    this.router.navigate(['/cockpit']);
  }

  public toggleMute(): void {
    this.notifService.toggleSound();
  }

  // ── Cierre al hacer clic fuera del widget ──
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target) && this.isOpen()) {
      this.closeDropdown();
    }
  }

  // ── Tecla Escape para cerrar ──
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.closeDropdown();
    }
  }
}
