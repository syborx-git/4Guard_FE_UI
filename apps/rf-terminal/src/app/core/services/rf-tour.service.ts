import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class RfTourService {
  private activeDriver: Driver | null = null;

  private resolveElement(selector: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const el = document.querySelector(selector);
    return el ? selector : undefined;
  }

  /**
   * Inicia el Tour Táctico de Inducción para Montacarguistas en la Terminal RF.
   * Diseñado con alta legibilidad para tablets industriales en andén o mástil.
   */
  startForkliftCockpitTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('.cockpit-topbar') || this.resolveElement('.rf-header'),
        popover: {
          title: '🚜 1. Cockpit Táctico del Montacargas',
          description: 'Bienvenido al panel unificado de maniobras. Aquí recibes tus misiones de descarga, almacenamiento (Putaway) y carga de salida en tiempo real.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('.telemetry-chip.lease-chip') || this.resolveElement('.topbar-right'),
        popover: {
          title: '👤 2. Operador & Telemetría WMS',
          description: 'Identifica tu operador activo y el estado de enlace con la base de datos central. Si se pierde la conexión Wi-Fi, la terminal continúa operando en modo Offline.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('.fifo-telemetry-bar'),
        popover: {
          title: '⏱️ 3. Cola Secuencial Continua (FIFO)',
          description: 'Las misiones se ordenan automáticamente según su hora de llegada para evitar cuellos de botella en andén y respetar los tiempos pactados con transportistas.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('.filter-pills-bar'),
        popover: {
          title: '🎯 4. Filtros de Misiones & Urgencias',
          description: 'Filtra tus tareas por tipo: Descargas Inbound, Reubicaciones en Rack (Putaway) o Cargas de Salida. Las misiones marcadas como "Urgente" tienen prioridad máxima.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('.forbot-rf-header-btn'),
        popover: {
          title: '🤖 5. ForBot AI — Copiloto por Voz en Andén',
          description: 'Toca aquí o usa el micrófono para consultar rampas asignadas, reglas de estiba NOM-251 o reportar anomalías físicas en tarimas sin soltar el volante.',
          side: 'bottom',
          align: 'end'
        }
      }
    ];

    this.destroyTour();

    this.activeDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.88)',
      stagePadding: 8,
      stageRadius: 12,
      nextBtnText: 'Siguiente ➔',
      prevBtnText: '⬅ Anterior',
      doneBtnText: '¡Listo para Operar! 🚜',
      progressText: 'Paso {{current}} de {{total}}',
      steps: steps,
      onDestroyed: () => {
        if (onComplete) {
          onComplete();
        }
      }
    });

    this.activeDriver.drive();
  }

  destroyTour(): void {
    if (this.activeDriver) {
      this.activeDriver.destroy();
      this.activeDriver = null;
    }
  }
}

