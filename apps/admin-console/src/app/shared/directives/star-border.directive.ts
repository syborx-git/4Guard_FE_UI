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

    // Elemento gradiente inferior (bottom)
    const bottomGrad = this.renderer.createElement('div');
    this.renderer.addClass(bottomGrad, 'border-gradient-bottom');
    if (this.color.includes('gradient')) {
      this.renderer.setStyle(bottomGrad, 'background', this.color);
    } else {
      this.renderer.setStyle(bottomGrad, 'background', `radial-gradient(circle, ${this.color}, transparent 12%)`);
    }
    this.renderer.setStyle(bottomGrad, 'animationDuration', this.speed);
    this.renderer.setStyle(bottomGrad, 'opacity', `${this.glowIntensity}`);

    // Elemento gradiente superior (top)
    const topGrad = this.renderer.createElement('div');
    this.renderer.addClass(topGrad, 'border-gradient-top');
    if (this.color.includes('gradient')) {
      this.renderer.setStyle(topGrad, 'background', this.color);
    } else {
      this.renderer.setStyle(topGrad, 'background', `radial-gradient(circle, ${this.color}, transparent 12%)`);
    }
    this.renderer.setStyle(topGrad, 'animationDuration', this.speed);
    this.renderer.setStyle(topGrad, 'opacity', `${this.glowIntensity}`);

    // Insertar capas animadas al inicio del contenedor
    this.renderer.insertBefore(target, bottomGrad, target.firstChild);
    this.renderer.insertBefore(target, topGrad, target.firstChild);
  }
}
