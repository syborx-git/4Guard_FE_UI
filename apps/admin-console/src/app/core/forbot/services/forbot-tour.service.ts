import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class ForbotTourService {
  private activeDriver: Driver | null = null;

  /**
   * Inicia el Tour Guiado e Interactivo de 4GUARD WMS usando Driver.js.
   * Utiliza selectores garantizados presentes en el Shell general para funcionar
   * sin importar en qué pantalla o módulo se encuentre el usuario.
   */
  startInterfaceTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: '.sidebar__nav',
        popover: {
          title: '🧭 1. Menú Principal de Navegación',
          description: 'Accede rápidamente a todos los módulos operativos: Caseta de Seguridad, Recepción en Andén, Calidad QM, Topología de Almacén y Consulta de Inventario.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.shell__branch-selector',
        popover: {
          title: '🏢 2. Centro de Distribución & Sucursal',
          description: 'Identifica la sucursal activa (Toluca BR-TOL-01). Todas las transacciones, andenes y existencias se filtran según esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.shell__live-clock',
        popover: {
          title: '⏱️ 3. Sincronización en Tiempo Real',
          description: 'Reloj operacional sincronizado al segundo. Marca el tiempo oficial de entrada a caseta, estadía en rampa y corte de turnos.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#waffle-menu-btn',
        popover: {
          title: '📦 4. Ecosistema 4GUARD & Google Suite',
          description: 'Acceso directo a herramientas complementarias: Gmail, Google Drive, WhatsApp de transportistas, reglas de negocio y manuales operativos.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '#theme-toggle-btn',
        popover: {
          title: '🌓 5. Modo Día / Modo Noche',
          description: 'Alterna al instante entre la interfaz de alto contraste para exteriores de andén y el modo nocturno para reducción de fatiga visual.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '.sidebar__user',
        popover: {
          title: '👤 6. Perfil, Turno & Bloqueo por PIN',
          description: 'Consulta tu rol asignado, pausa o bloquea tu estación de trabajo y realiza cambio rápido de operador de montacargas por PIN de 4 dígitos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: 'fg-forbot-trigger-button',
        popover: {
          title: '🤖 7. ForBot AI — Copiloto WMS (Ctrl + K)',
          description: 'Tu asistente inteligente en vivo. Presiona Ctrl + K en cualquier momento para consultar mermas, caducidades FEFO, normas NOM-251 y dictámenes de calidad.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.activeDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.82)',
      stagePadding: 8,
      stageRadius: 12,
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

