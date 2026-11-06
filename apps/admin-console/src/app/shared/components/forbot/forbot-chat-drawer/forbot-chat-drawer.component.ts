/**
 * @file forbot-chat-drawer.component.ts
 * @description Drawer Conversacional Flotante con alta legibilidad tipográfica y estética Glassmorphism para ForBot (4GUARD AI),
 * con selector de modo Operativo/Tutor, tour interactivo y control de scroll inteligente.
 */

import { Component, inject, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ForbotEngineService } from '../../../../core/forbot/services/forbot-engine.service';
import { AuthState } from '../../../../core/auth/auth.state';
import { ForbotVoiceService } from '@4guard/shared-core';
import { ForbotAvatarComponent } from '../forbot-avatar/forbot-avatar.component';





@Component({
  selector: 'fg-forbot-chat-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, ForbotAvatarComponent],
  templateUrl: './forbot-chat-drawer.component.html',
  styleUrl: './forbot-chat-drawer.component.css'
})
export class ForbotChatDrawerComponent {
  protected readonly forbotEngine = inject(ForbotEngineService);
  protected readonly authState = inject(AuthState);
  protected readonly voiceService = inject(ForbotVoiceService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);


  @ViewChild('chatFeedContainer') private chatFeedContainer!: ElementRef;

  protected userQueryText = signal<string>('');

  /** Píldoras de Sugerencia Rápida para Modo Operativo General */
  private readonly operativePills = [
    { label: '💡 Mermas <30 días', query: '¿Qué productos caducan en menos de 30 días?' },
    { label: '🚛 Estado de Rampas', query: '¿Cuál es el estado de las rampas en andén?' },
    { label: '📦 Espacio en Bodegas', query: '¿Cómo está la ocupación en las bodegas A y APC?' },
    { label: '🚜 Montacarguistas', query: '¿Cuántos montacarguistas tienen certificación DC-3?' },
    { label: '🔬 NOM-251 Calidad', query: '¿Hay lotes bloqueados por NOM-251?' }
  ];

  /** Píldoras operativas para Caseta de Seguridad */
  private readonly securityOperativePills = [
    { label: '📱 Pases QR & Choferes', query: '¿Cómo validar pases QR y registrar choferes sin cita?' },
    { label: '📋 Inspección F01', query: '¿Cuál es el checklist oficial de inspección física F01?' },
    { label: '🚛 Rampa vs Patio', query: '¿Cuándo enviar un transporte a rampa o a patio de espera?' },
    { label: '🚪 Salida Check-Out', query: '¿Cómo realizar el check-out de salida de un camión?' },
    { label: '📄 Bitácora F02', query: '¿Cómo exportar la bitácora oficial de caseta F02 en Excel?' }
  ];

  /** Píldoras operativas para Gerente de Operaciones */
  private readonly operationsManagerOperativePills = [
    { label: '📈 Throughput Andenes', query: '¿Cómo interpretar el throughput y cuellos de botella en andenes?' },
    { label: '🍽️ Horario Comida & Pausa', query: '¿Cómo funciona el horario de comida y cuántos minutos antes pausar actividades con uñas a piso?' },
    { label: '🗺️ Saturación Bodegas', query: '¿Cómo está la ocupación en las bodegas A y APC?' },
    { label: '🚜 Montacarguistas DC-3', query: '¿Cuántos montacarguistas tienen certificación DC-3?' },
    { label: '💡 Mermas <30 días', query: '¿Qué productos caducan en menos de 30 días?' }
  ];

  /** Píldoras operativas para Mesa de Control */
  private readonly controlDeskOperativePills = [
    { label: '⏳ Vida Útil ≥ 365 días', query: '¿Cómo aplicar la regla de vida útil mínima de 365 días en recepción?' },
    { label: '⚡ Misiones a RF', query: '¿Cómo asignar misiones a montacarguistas y marcar prioridad urgente?' },
    { label: '📦 Despachos FEFO', query: '¿Cómo funciona el criterio FEFO en órdenes de salida?' },
    { label: '🚛 Estado de Rampas', query: '¿Cuál es el estado de las rampas en andén?' },
    { label: '💡 Mermas <30 días', query: '¿Qué productos caducan en menos de 30 días?' }
  ];

  /** Píldoras operativas para Dirección General */
  private readonly generalDirectorOperativePills = [
    { label: '📊 SLAs & OTIF Global', query: '¿Cómo evaluar el cumplimiento de SLAs de clientes y throughput global?' },
    { label: '🏢 Capacidad 18K & Buffer', query: '¿Cuál es la capacidad contratada de 13.5K vs el buffer de sobrecupo de 18K?' },
    { label: '⚙️ Gobernanza & PIN', query: '¿Cómo supervisar la administración de turnos y seguridad PIN?' },
    { label: '💰 Riesgo de Mermas', query: '¿Cuál es el costo y riesgo de mermas bajo la Regla de Pablo y NOM-251?' },
    { label: '🚜 Montacarguistas', query: '¿Cuántos montacarguistas tienen certificación DC-3?' }
  ];

  /** Píldoras especializadas para Roles de Calidad (QM) o ruta /quality */
  private readonly qualityPills = [
    { label: '🔬 Regla Diurex en PT', query: '¿Se permite usar cinta Diurex para sellar producto terminado?' },
    { label: '📐 Inclinación Tarima (5°)', query: '¿Cuál es la tolerancia máxima de inclinación de un pallet?' },
    { label: '☕ Muestreo Café Verde', query: '¿Cómo es el procedimiento de muestreo para café verde?' },
    { label: '💧 Límite Humedad (65% HR)', query: '¿Cuál es el límite máximo de humedad relativa en almacén?' },
    { label: '🪵 Reparación vs Traspaleo', query: '¿Cuántas tablas rotas en una tarima obligan a traspaleo?' }
  ];

  /** Píldoras de Tutor para Guardia de Caseta de Seguridad */
  private readonly securityTutorPills = [
    { label: '🚀 Tour Caseta & Patio (4 Etapas)', query: 'Iniciar tour guiado de la interfaz' },
    { label: '📱 Pases QR & Choferes', query: '¿Cómo validar pases QR y registrar choferes sin cita?' },
    { label: '📋 Inspección F01', query: '¿Cuál es el checklist oficial de inspección física F01?' },
    { label: '🚛 Rampa vs Patio', query: '¿Cuándo enviar un transporte a rampa o a patio de espera?' },
    { label: '🚪 Salida Check-Out', query: '¿Cómo realizar el check-out de salida de un camión?' },
    { label: '📄 Exportar Bitácora F02', query: '¿Cómo exportar la bitácora oficial de caseta F02 en Excel?' }
  ];

  /** Píldoras de Tutor para Gerente de Operaciones */
  private readonly operationsManagerTutorPills = [
    { label: '🚀 Tour Multi-Módulo (6 Módulos)', query: 'Iniciar tour guiado de la interfaz' },
    { label: '📈 Throughput & Andenes', query: '¿Cómo interpretar el throughput y cuellos de botella en andenes?' },
    { label: '🍽️ Horario Comida & Pausa', query: '¿Cómo funciona el horario de comida y cuántos minutos antes pausar actividades con uñas a piso?' },
    { label: '🗺️ Topología 2D', query: '¿Cómo supervisar la topología 2D y saturación de bodegas?' },
    { label: '⏱️ Horas Trabajadas', query: '¿Cómo auditar las horas trabajadas de montacarguistas por turno?' },
    { label: '⏳ Regla de Pablo', query: '¿Cómo funciona la Regla Crítica de Pablo y la semaforización?' }
  ];

  /** Píldoras de Tutor para Mesa de Control */
  private readonly controlDeskTutorPills = [
    { label: '🚀 Tour Multi-Módulo (4 Módulos)', query: 'Iniciar tour guiado de la interfaz' },
    { label: '⏳ Vida Útil ≥ 365 días', query: '¿Cómo aplicar la regla de vida útil mínima de 365 días en recepción?' },
    { label: '⚡ Asignar Misiones a RF', query: '¿Cómo asignar misiones a montacarguistas y marcar prioridad urgente?' },
    { label: '📦 Despachos FEFO', query: '¿Cómo funciona el criterio FEFO en órdenes de salida?' },
    { label: '📘 Inducción FSM (8 Estados)', query: 'Explícame el ciclo de vida del producto en los 8 estados del FSM' }
  ];

  /** Píldoras de Tutor para Dirección General */
  private readonly generalDirectorTutorPills = [
    { label: '🚀 Tour Ejecutivo (8 Módulos)', query: 'Iniciar tour guiado de la interfaz' },
    { label: '📊 Throughput & SLAs', query: '¿Cómo evaluar el cumplimiento de SLAs de clientes y throughput global?' },
    { label: '🏢 Capacidad 18K & Buffer', query: '¿Cuál es la capacidad contratada de 13.5K vs el buffer de sobrecupo de 18K?' },
    { label: '⚙️ Gobernanza de Turnos & PIN', query: '¿Cómo supervisar la administración de turnos y seguridad PIN?' },
    { label: '💰 Mermas & NOM-251', query: '¿Cuál es el costo y riesgo de mermas bajo la Regla de Pablo y NOM-251?' },
    { label: '📈 Rendimiento de Planta', query: '¿Cómo auditar la productividad y horas trabajadas de cuadrillas?' }
  ];

  /** Píldoras de Sugerencia Rápida para Modo Tutor General (Default) */
  private readonly defaultTutorPills = [
    { label: '🚀 Iniciar Tour', query: 'Iniciar tour guiado de la interfaz' },
    { label: '📘 Inducción FSM (8 Estados)', query: 'Explícame el ciclo de vida del producto en los 8 estados del FSM' },
    { label: '⏳ Regla de Pablo', query: '¿Cómo funciona la Regla Crítica de Pablo y la semaforización?' },
    { label: '🚚 Protocolo de Andén', query: '¿Cuál es el protocolo de recepción en andén F01?' }
  ];

  /** Píldoras reactivas según el modo actual y contexto de ruta / rol */
  protected readonly activePills = computed(() => {
    const rawRole = this.authState.role() || '';
    const role = rawRole.replace(/^ROLE_/, '').toUpperCase();

    if (this.forbotEngine.currentMode() === 'tutor') {
      if (role === 'SECURITY_GUARD' || role === 'GUARD' || role === 'CASETA' || role === 'VIGILANCIA') return this.securityTutorPills;
      if (role === 'OPERATIONS_MANAGER' || role === 'WAREHOUSE_MANAGER' || role === 'OPERATIONS_COORDINATOR' || role === 'OPERATIONS_SUPERVISOR') return this.operationsManagerTutorPills;
      if (role === 'CONTROL_DESK' || role === 'MESA_DE_CONTROL' || role === 'MESA') return this.controlDeskTutorPills;
      if (role === 'ADMIN' || role === 'CEO' || role === 'DIRECTOR_GENERAL' || role === 'GENERAL_DIRECTOR' || role === 'SUPER_ADMIN' || role === 'DIRECTOR') return this.generalDirectorTutorPills;
      return this.defaultTutorPills;
    }

    // Modo Operativo
    const currentUrl = this.router.url;
    const isQualityContext = currentUrl.includes('/quality') ||
      ['QM_INSPECTOR', 'ROLE_QM_INSPECTOR', 'AUDITOR', 'ROLE_AUDITOR'].includes(role);
    if (isQualityContext) return this.qualityPills;

    if (role === 'SECURITY_GUARD' || role === 'GUARD' || role === 'CASETA' || role === 'VIGILANCIA') return this.securityOperativePills;
    if (role === 'OPERATIONS_MANAGER' || role === 'WAREHOUSE_MANAGER' || role === 'OPERATIONS_COORDINATOR' || role === 'OPERATIONS_SUPERVISOR') return this.operationsManagerOperativePills;
    if (role === 'CONTROL_DESK' || role === 'MESA_DE_CONTROL' || role === 'MESA') return this.controlDeskOperativePills;
    if (role === 'ADMIN' || role === 'CEO' || role === 'DIRECTOR_GENERAL' || role === 'GENERAL_DIRECTOR' || role === 'SUPER_ADMIN' || role === 'DIRECTOR') return this.generalDirectorOperativePills;

    return this.operativePills;
  });

  constructor() {
    // Scroll inteligente: Solo baja cuando se agrega un mensaje nuevo o se abre el chat
    effect(() => {
      const messages = this.forbotEngine.chatHistory();
      const isOpen = this.forbotEngine.isDrawerOpen();
      if (isOpen && messages.length > 0) {
        setTimeout(() => {
          this.scrollToBottom();
          this.forbotEngine.checkTheme();
        }, 60);
      }
    });
  }

  /**
   * Parsea texto con markdown (**negrita**, saltos de línea) inyectando estilos directos
   * para garantizar contraste máximo sin depender de clases heredadas.
   */
  protected formatMessage(text: string): SafeHtml {
    if (!text) return '';
    const isDark = this.forbotEngine.isDarkMode();
    const strongColor = isDark ? '#ffffff' : '#000000';
    const textColor = isDark ? '#f8fafc' : '#0f172a';

    let parsed = text
      .replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${strongColor} !important; font-weight: 800 !important; font-size: inherit;">$1</strong>`)
      .replace(/\n/g, '<br/>');

    const wrapped = `<div style="color: ${textColor} !important; line-height: 1.6; font-size: 12.5px;">${parsed}</div>`;
    return this.sanitizer.bypassSecurityTrustHtml(wrapped);
  }

  protected setMode(mode: 'operativo' | 'tutor'): void {
    this.forbotEngine.setMode(mode);
  }

  protected onSendMessage(): void {
    const query = this.userQueryText().trim();
    if (!query) return;

    this.forbotEngine.sendUserMessage(query);
    this.userQueryText.set('');
  }

  protected onPillClick(pill: any): void {
    if (pill.query === 'Iniciar tour guiado de la interfaz') {
      this.forbotEngine.startDriverTour();
      return;
    }
    this.forbotEngine.sendUserMessage(pill.query);
  }

  protected toggleVoice(): void {
    this.voiceService.toggleListening((finalText: string) => {
      this.userQueryText.set(finalText);
      this.onSendMessage();
    });
  }

  protected startTour(): void {

    this.forbotEngine.startDriverTour();
  }

  protected onCloseDrawer(): void {
    this.forbotEngine.closeDrawer();
  }

  protected navigateToRoute(route?: string): void {
    if (route) {
      this.forbotEngine.closeDrawer();
      this.router.navigate([route]);
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatFeedContainer) {
        this.chatFeedContainer.nativeElement.scrollTop = this.chatFeedContainer.nativeElement.scrollHeight;
      }
    } catch {
      // Ignorar scroll errors
    }
  }
}
