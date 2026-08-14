/**
 * @file inventory-query-shell.component.ts
 * @description Contenedor Shell principal del módulo de Consulta de Inventarios WMS.
 * Mantiene el estilo ejecutivo Light "Blanquito" con header corporativo 4GUARD.
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryQueryGridComponent } from '../../components/inventory-query-grid/inventory-query-grid.component';

@Component({
  selector: 'fg-inventory-query-shell',
  standalone: true,
  imports: [CommonModule, InventoryQueryGridComponent],
  templateUrl: './inventory-query-shell.component.html',
  styleUrl: './inventory-query-shell.component.css'
})
export class InventoryQueryShellComponent {}
