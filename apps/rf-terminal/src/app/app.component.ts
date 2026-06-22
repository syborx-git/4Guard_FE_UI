/**
 * @file app.component.ts
 * @description Componente raíz de la aplicación RF Terminal.
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'fg-rf-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = '4GUARD RF Terminal';
}
