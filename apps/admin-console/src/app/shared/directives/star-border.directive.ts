/**
 * @file star-border.directive.ts
 * @description Directiva Angular standalone que aplica la animación "StarBorder" de React Bits.
 * Genera un resplandor de luz dorada (Luxury Gold #D4AF37) que recorre dinámicamente el borde de modales y tarjetas,
 * acelerando e intensificándose con elegancia al pasar el cursor (hover).
 */

import { Directive, ElementRef, inject, Input, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[fgStarBorder]',
  standalone: true,
})
export class StarBorderDirective implements OnInit {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  @Input() color: string = 'radial-gradient(circle, #f5e0a0 0%, #d4af37 35%, #997312 70%, transparent 95%)';
  @Input() speed: string = '5s';
  @Input() glowIntensity: number = 0.85;

  ngOnInit(): void {
    const target = this.el.nativeElement as HTMLElement;
    this.renderer.addClass(target, 'star-border-container');
  }
}
