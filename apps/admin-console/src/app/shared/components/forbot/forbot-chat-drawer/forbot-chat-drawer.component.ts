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
import { ForbotAvatarComponent } from '../forbot-avatar/forbot-avatar.component';
import { AuthState } from '../../../../core/auth/auth.state';

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
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('chatFeedContainer') private chatFeedContainer!: ElementRef;

  protected userQueryText = signal<string>('');

  /** Píldoras de Sugerencia Rápida para Modo Operativo */
  private readonly operativePills = [
    { label: '💡 Mermas <30 días', query: '¿Qué productos caducan en menos de 30 días?' },
    { label: '🚛 Estado de Rampas', query: '¿Cuál es el estado de las rampas en andén?' },
    { label: '📦 Espacio en Bodegas', query: '¿Cómo está la ocupación en las bodegas A y APC?' },
    { label: '🚜 Montacarguistas', query: '¿Cuántos montacarguistas tienen certificación DC-3?' },
    { label: '🔬 NOM-251 Calidad', query: '¿Hay lotes bloqueados por NOM-251?' }
  ];

  /** Píldoras de Sugerencia Rápida para Modo Tutor (Limpio y enfocado a aprendizaje) */
  private readonly tutorPills = [
    { label: '🚀 Iniciar Tour', query: 'Iniciar tour guiado de la interfaz' },
    { label: '📘 Inducción FSM (8 Estados)', query: 'Explícame el ciclo de vida del producto en los 8 estados del FSM' },
    { label: '⏳ Regla de Pablo', query: '¿Cómo funciona la Regla Crítica de Pablo y la semaforización?' },
    { label: '🚚 Protocolo de Andén', query: '¿Cuál es el protocolo de recepción en andén F01?' }
  ];

  /** Píldoras reactivas según el modo actual */
  protected readonly activePills = computed(() => {
    return this.forbotEngine.currentMode() === 'operativo'
      ? this.operativePills
      : this.tutorPills;
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
