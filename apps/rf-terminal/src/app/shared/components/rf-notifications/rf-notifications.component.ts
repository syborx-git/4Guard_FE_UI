/**
 * @file rf-notifications.component.ts
 * @description Widget de Notificaciones Operativas en Tiempo Real para la Terminal RF.
 * Diseñado conforme al estándar Synexia Dual-Theme (Linen/Gold en Light Mode, Obsidian/Gold en Dark Mode).
 * 
 * Incluye:
 * - Badge / Pill en Header con indicador de conteo en cola y baliza pulsante en tiempo real.
 * - Menú Desplegable Flotante Táctil (touch-first, min 56px de interacción / ADR-012).
 * - Sonido Amigable (Web Audio API Triada Mayor) con botón de prueba interactiva y toggle de silencio.
 * - Tarjetas de Pre-Recepción Inbound y Asignación de Andenes con botón de atención inmediata.
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
  RfOperationalNotification,
  RfNotificationCategory
} from '../../../core/services/rf-notification.service';

export type RfNotificationTab = 'ALL' | 'RECEIVING' | 'RAMP' | 'OUTBOUND';

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
  public readonly activeTab = signal<RfNotificationTab>('ALL');

  // ── Señales Reactivas del Servicio ──
  public readonly notifications = this.notifService.notifications;
  public readonly unreadCount = this.notifService.unreadCount;
  public readonly pendingReceptions = this.notifService.pendingReceptions;
  public readonly pendingReceptionsCount = this.notifService.pendingReceptionsCount;
  public readonly pendingRampAssignments = this.notifService.pendingRampAssignments;
  public readonly pendingRampAssignmentsCount = this.notifService.pendingRampAssignmentsCount;
  public readonly totalVisibleCount = this.notifService.totalVisibleCount;
  public readonly hasNewArrivalBeacon = this.notifService.hasNewArrivalBeacon;
  public readonly isSoundMuted = this.notifService.isSoundMuted;

  // ── Filtrado dinámico por pestaña seleccionada ──
  public readonly filteredNotifications = computed(() => {
    const tab = this.activeTab();
    const list = this.notifications();
    if (tab === 'RECEIVING') {
      return list.filter(n => n.category === 'RECEIVING');
    }
    if (tab === 'RAMP') {
      return list.filter(n => n.category === 'RAMP');
    }
    if (tab === 'OUTBOUND') {
      return list.filter(n => n.category === 'OUTBOUND');
    }
    return list;
  });

  // ── Control de Apertura / Cierre ──
  public toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  public closeDropdown(): void {
    this.isOpen.set(false);
  }

  public setActiveTab(tab: RfNotificationTab): void {
    this.activeTab.set(tab);
  }

  // ── Acciones de Atención Inmediata ──
  public attendNotification(notif: RfOperationalNotification): void {
    this.closeDropdown();
    this.notifService.attendNotification(notif);
  }

  public goToCockpit(): void {
    this.closeDropdown();
    this.router.navigate(['/cockpit']);
  }

  public goToReceiving(): void {
    this.closeDropdown();
    this.router.navigate(['/receiving/scan']);
  }

  // ── Audio Feedback Amigable ──
  public playTestSound(): void {
    this.notifService.playFriendlyArrivalChime();
  }

  public toggleMute(): void {
    this.notifService.toggleSound();
  }

  public simulateArrival(): void {
    this.notifService.simulateIncomingReception();
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
