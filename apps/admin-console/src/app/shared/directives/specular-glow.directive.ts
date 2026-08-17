/**
 * @file specular-glow.directive.ts
 * @description Directiva Angular standalone que aplica el efecto interactivo Specular Border / Radial Mask Glow.
 * Utiliza NgZone.runOutsideAngular para rastrear el puntero del ratón a 60 FPS sin disparar ciclos de Change Detection.
 */

import { Directive, ElementRef, inject, NgZone, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[fgSpecularGlow]',
  standalone: true,
})
export class SpecularGlowDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly ngZone = inject(NgZone);

  private unlistenMove?: () => void;
  private unlistenLeave?: () => void;

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      const target = this.el.nativeElement as HTMLElement;
      target.classList.add('specular-card');

      const onMove = (e: MouseEvent) => {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        target.style.setProperty('--mouse-x', `${x}px`);
        target.style.setProperty('--mouse-y', `${y}px`);
      };

      const onLeave = () => {
        target.style.setProperty('--mouse-x', `-999px`);
        target.style.setProperty('--mouse-y', `-999px`);
      };

      target.addEventListener('mousemove', onMove, { passive: true });
      target.addEventListener('mouseleave', onLeave, { passive: true });

      this.unlistenMove = () => target.removeEventListener('mousemove', onMove);
      this.unlistenLeave = () => target.removeEventListener('mouseleave', onLeave);
    });
  }

  ngOnDestroy(): void {
    if (this.unlistenMove) this.unlistenMove();
    if (this.unlistenLeave) this.unlistenLeave();
  }
}
