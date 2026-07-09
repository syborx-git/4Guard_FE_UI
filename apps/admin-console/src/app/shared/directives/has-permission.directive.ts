/**
 * @file has-permission.directive.ts
 * @description Directiva estructural para renderizar condicionalmente elementos del DOM basados en permisos del usuario.
 *
 * Uso en templates:
 *   <button *hasPermission="'USERS_CREATE'">Nuevo Usuario</button>
 */

import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private permission: string = '';
  private hasView: boolean = false;

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  @Input()
  set hasPermission(val: string) {
    this.permission = val;
    this.updateView();
  }

  ngOnInit(): void {
    this.updateView();
  }

  private updateView(): void {
    const hasAccess = this.authService.hasPermission(this.permission);

    if (hasAccess && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAccess && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
