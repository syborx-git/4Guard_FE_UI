/**
 * @file rbac.directive.ts
 * @description Directiva estructural para controlar visibilidad de elementos
 * del DOM basada en el rol del usuario actual (RBAC).
 *
 * Uso en templates:
 *   <button *fgRbac="[UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER]">Editar</button>
 *   <div *fgRbac="module:'quality'">Acceso a QM</div>
 */

import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit } from '@angular/core';
import { UserRole } from '@4guard/shared-core';
import { AuthState } from '../../core/auth/auth.state';

@Directive({
  selector: '[fgRbac]',
  standalone: true,
})
export class RbacDirective implements OnInit {
  /** Roles permitidos para mostrar el elemento */
  @Input('fgRbac') roles: UserRole[] = [];

  /** Módulo a verificar (alternativa a roles explícitos) */
  @Input('fgRbacModule') module?: string;

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authState = inject(AuthState);

  ngOnInit(): void {
    this.updateView();
  }

  private updateView(): void {
    const canView = this.checkAccess();

    if (canView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  private checkAccess(): boolean {
    // Verificar por módulo
    if (this.module) {
      return this.authState.canAccessModule(this.module);
    }

    // Verificar por roles explícitos
    if (this.roles && this.roles.length > 0) {
      return this.authState.hasRole(...this.roles);
    }

    // Si no se especifica nada, permitir acceso
    return true;
  }
}
