/**
 * @file warehouse-movements-shell.component.ts
 * @description Shell principal del módulo Movimientos de Almacén.
 * Contiene la barra superior de pestañas primarias con la navegación lazy-loaded.
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'fg-warehouse-movements-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './warehouse-movements-shell.component.html',
  styleUrl: './warehouse-movements-shell.component.css',
})
export class WarehouseMovementsShellComponent {}
