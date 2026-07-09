/**
 * @file rf-shell.component.ts
 * @description Shell layout del RF Terminal.
 * Actúa como contenedor raíz para todas las rutas operativas protegidas.
 * Incluye navbar inferior con acceso rápido a funciones principales.
 */

import { Component, signal } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'fg-rf-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './rf-shell.component.html',
  styleUrl: './rf-shell.component.css',
})
export class RfShellComponent {
  protected readonly navItems: NavItem[] = [
    { path: '/menu',      icon: '🏠', label: 'Inicio'     },
    { path: '/receiving', icon: '📥', label: 'Recepción'  },
    { path: '/putaway',   icon: '📦', label: 'Ubicación'  },
    { path: '/picking',   icon: '🛒', label: 'Picking'    },
    { path: '/counting',  icon: '🔢', label: 'Conteo'     },
    { path: '/quality',   icon: '🔍', label: 'Calidad'    },
  ];
}
