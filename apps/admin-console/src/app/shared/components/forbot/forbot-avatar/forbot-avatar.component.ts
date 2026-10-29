/**
 * @file forbot-avatar.component.ts
 * @description Avatar animado SVG/CSS para ForBot (4GUARD AI) con el número "4" neón resplandeciente e indicador en vivo.
 */

import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'fg-forbot-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forbot-avatar.component.html',
  styleUrl: './forbot-avatar.component.css'
})
export class ForbotAvatarComponent {
  /** Tamaño del avatar en píxeles (ej: 32, 36, 42, 48) */
  @Input() size: number = 38;

  /** Alterna entre la animación del "4" Neón y la imagen oficial del Logo 4GUARD */
  @Input() useLogoImage: boolean = false;

  @HostBinding('style.width.px')
  @HostBinding('style.min-width.px')
  @HostBinding('style.max-width.px')
  @HostBinding('style.height.px')
  @HostBinding('style.min-height.px')
  @HostBinding('style.max-height.px')
  get hostSize(): number {
    return this.size;
  }

  @HostBinding('style.display') readonly display = 'inline-flex';
  @HostBinding('style.flex-shrink') readonly shrink = '0';
}

