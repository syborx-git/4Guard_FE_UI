/**
 * @file forbot-trigger-button.component.ts
 * @description Botón flotante Speed-Dial de 4GUARD: despliega acceso a ForBot AI y Mensajería Interna con notificaciones.
 */

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForbotEngineService } from '../../../../core/forbot/services/forbot-engine.service';
import { ChatService } from '../../../../features/chat/chat.service';
import { ForbotAvatarComponent } from '../forbot-avatar/forbot-avatar.component';

@Component({
  selector: 'fg-forbot-trigger-button',
  standalone: true,
  imports: [CommonModule, ForbotAvatarComponent],
  templateUrl: './forbot-trigger-button.component.html',
  styleUrl: './forbot-trigger-button.component.css',
})
export class ForbotTriggerButtonComponent implements OnInit {
  protected readonly forbotEngine = inject(ForbotEngineService);
  protected readonly chatService = inject(ChatService);

  protected readonly isSpeedDialOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.chatService.startPolling();
  }

  protected onToggleSpeedDial(): void {
    this.isSpeedDialOpen.update((v) => !v);
  }

  protected onOpenForbot(): void {
    this.isSpeedDialOpen.set(false);
    this.forbotEngine.toggleDrawer();
  }

  protected onOpenChat(): void {
    this.isSpeedDialOpen.set(false);
    this.chatService.openDrawer();
  }
}
