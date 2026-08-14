/**
 * @file forbot-chat-drawer.component.ts
 * @description Drawer Conversacional Flotante con estética Glassmorphism para ForBot (4GUARD AI).
 */

import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ForbotEngineService } from '../../../../core/forbot/services/forbot-engine.service';
import { ForbotAvatarComponent } from '../forbot-avatar/forbot-avatar.component';
import { ForbotChatMessage } from '../../../../core/forbot/models/forbot.models';

@Component({
  selector: 'fg-forbot-chat-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, ForbotAvatarComponent],
  templateUrl: './forbot-chat-drawer.component.html',
  styleUrl: './forbot-chat-drawer.component.css'
})
export class ForbotChatDrawerComponent implements AfterViewChecked {
  protected readonly forbotEngine = inject(ForbotEngineService);
  private readonly router = inject(Router);

  @ViewChild('chatFeedContainer') private chatFeedContainer!: ElementRef;

  protected userQueryText = signal<string>('');

  /** Píldoras de Sugerencia Rápida (Quick Action Pills) */
  protected readonly quickPills = [
    { label: '💡 Mermas <30 días', query: '¿Qué productos caducan en menos de 30 días?' },
    { label: '🚛 Estado de Rampas', query: '¿Cuál es el estado de las rampas en andén?' },
    { label: '📦 Espacio en Bodegas', query: '¿Cómo está la ocupación en las bodegas A y APC?' },
    { label: '🏆 Montacarguistas', query: '¿Cuántos montacarguistas tienen certificación DC-3?' },
    { label: '🛡️ NOM-251 Calidad', query: '¿Hay lotes bloqueados por NOM-251?' }
  ];

  ngAfterViewChecked(): void {
    this.forbotEngine.checkTheme();
    this.scrollToBottom();
  }

  protected onSendMessage(): void {
    const query = this.userQueryText().trim();
    if (!query) return;

    this.forbotEngine.sendUserMessage(query);
    this.userQueryText.set('');
  }

  protected onPillClick(query: string): void {
    this.forbotEngine.sendUserMessage(query);
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
