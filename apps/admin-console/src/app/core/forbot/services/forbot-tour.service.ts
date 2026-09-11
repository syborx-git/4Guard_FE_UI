import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class ForbotTourService {
  private activeDriver: Driver | null = null;

  /**
   * Inicia el Tour Guiado e Interactivo de 4GUARD WMS usando Driver.js
   */
  startInterfaceTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: '#sidebar-nav, .sidebar-container, nav',
        popover: {
          title: '🧭 1. Menú de Navegación 4GUARD',
          description: 'Accede rápidamente a los módulos operativos: Inventarios, Recepción en Andén, Traspasos y Despacho.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '#inventory-search-bar, .search-container, input[type="search"]',
        popover: {
          title: '🔍 2. Búsqueda Multicriterio',
          description: 'Filtra al instante por SKU, Folio consecutivo (#563633), Remisión, Lote o Cliente corporativo.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#inventory-grid, .inventory-table, table',
        popover: {
          title: '📊 3. Grid de Inventario en Tiempo Real',
          description: 'Controla el ciclo de vida del producto con los 8 estados FSM y la semaforización de la Regla de Pablo (<30 días).',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#btn-export-xlsx, .export-btn, button:has(svg)',
        popover: {
          title: '📑 4. Exportación Oficial XLSX',
          description: 'Genera y descarga en tu navegador el reporte oficial de 21 columnas en tiempo real.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '#forbot-widget-container, .forbot-trigger-btn, fg-forbot-trigger-button',
        popover: {
          title: '🤖 5. ForBot AI — Tu Mano Derecha',
          description: 'Consulta dudas de reglas de negocio, recibe alertas preventivas y capacítate en cualquier momento.',
          side: 'top',
          align: 'end'
        }
      }
    ];

    this.activeDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.82)',
      stagePadding: 6,
      stageRadius: 10,
      nextBtnText: 'Siguiente ➔',
      prevBtnText: '⬅ Anterior',
      doneBtnText: '¡Entendido! 🎉',
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
