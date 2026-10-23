/**
 * @file forbot-trigger-button.component.ts
 * @description Botón disparador de ForBot en la barra superior derecha con atajo Ctrl + K.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForbotEngineService } from '../../../../core/forbot/services/forbot-engine.service';
import { ForbotAvatarComponent } from '../forbot-avatar/forbot-avatar.component';

@Component({
  selector: 'fg-forbot-trigger-button',
  standalone: true,
  imports: [CommonModule, ForbotAvatarComponent],
  templateUrl: './forbot-trigger-button.component.html',
  styleUrl: './forbot-trigger-button.component.css'
})
export class ForbotTriggerButtonComponent {
  protected readonly forbotEngine = inject(ForbotEngineService);

  protected onToggleForbot(): void {
    this.forbotEngine.toggleDrawer();
  }
}
