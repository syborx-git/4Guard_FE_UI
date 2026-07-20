import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[fgRestrictChars]',
  standalone: true
})
export class RestrictSpecialCharsDirective {
  @Input('fgRestrictChars') mode: 'standard' | 'code' | 'email' | 'description' | 'strict' | '' = 'standard';

  constructor(private el: ElementRef) {}

  @HostListener('keypress', ['$event'])
  onKeyPress(event: KeyboardEvent) {
    // Permitir teclas de control especiales
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length > 1) {
      return;
    }

    const currentMode = this.mode || 'standard';
    let regex: RegExp;

    switch (currentMode) {
      case 'strict':
        // Solo alfanuméricos, sin espacios
        regex = /^[a-zA-Z0-9]+$/;
        break;
      case 'code':
        // Alfanuméricos, guiones y guiones bajos
        regex = /^[a-zA-Z0-9\-_]+$/;
        break;
      case 'email':
        regex = /^[a-zA-Z0-9@.\-_]+$/;
        break;
      case 'description':
        // Alfanuméricos, espacios, puntuación básica
        regex = /^[a-zA-Z0-9 ñÑáéíóúÁÉÍÓÚ.,\-_()!¡¿?\n\r]+$/;
        break;
      case 'standard':
      default:
        // Alfanuméricos, espacios, guiones
        regex = /^[a-zA-Z0-9 ñÑáéíóúÁÉÍÓÚ\-_]+$/;
        break;
    }

    if (!regex.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    const clipboardData = event.clipboardData;
    if (clipboardData) {
      const pastedText = clipboardData.getData('text');
      const currentMode = this.mode || 'standard';
      let regex: RegExp;

      switch (currentMode) {
        case 'strict':
          regex = /^[a-zA-Z0-9]+$/;
          break;
        case 'code':
          regex = /^[a-zA-Z0-9\-_]+$/;
          break;
        case 'email':
          regex = /^[a-zA-Z0-9@.\-_]+$/;
          break;
        case 'description':
          regex = /^[a-zA-Z0-9 ñÑáéíóúÁÉÍÓÚ.,\-_()!¡¿?\n\r]+$/;
          break;
        case 'standard':
        default:
          regex = /^[a-zA-Z0-9 ñÑáéíóúÁÉÍÓÚ\-_]+$/;
          break;
      }
      
      const isValid = pastedText.split('').every(char => regex.test(char));
      if (!isValid) {
        event.preventDefault();
      }
    }
  }
}
