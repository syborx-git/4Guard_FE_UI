/**
 * @file app.component.ts
 * @description Componente raíz de la Consola Administrativa 4GUARD.
 * Actúa como host del router outlet y del diseño global.
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'fg-admin-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = '4GUARD WMS — Consola Administrativa';
}
