/**
 * @file load-verification-submodule.component.ts
 * @description Submódulo 3 de Calidad: Formato Oficial de Verificación de Carga F01-PO-GC-8.6-03 Rev. 03.
 * Incluye formulario directo homologado con Recepción, firmas normativas y modal oficial de impresión/descarga PDF 2x DPI.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityStateService } from '../../services/quality-state.service';
import { LoadVerification, CriterionValue } from '../../models/quality.models';
import { PrintService } from '../../../../core/services/print.service';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';
import { PrintVerificationLayoutComponent } from '../../components/print-layouts/print-verification-layout.component';

@Component({
  selector: 'fg-load-verification-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective, PrintVerificationLayoutComponent],
  templateUrl: './load-verification-submodule.component.html',
  styleUrl: './load-verification-submodule.component.css'
})
export class LoadVerificationSubmoduleComponent {
  protected readonly qualityState = inject(QualityStateService);
  private readonly printService = inject(PrintService);

  // Verificación actualmente seleccionada
  protected readonly selectedVerificationId = signal<string>('ver-001');

  // Copia de trabajo activa en el formulario
  protected readonly activeForm = signal<LoadVerification>(this.getInitialVerificationCopy('ver-001'));

  // Buscador y filtros del directorio lateral
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<string>('ALL');

  // Estado del Modal de Impresión
  protected readonly showPrintModal = signal<boolean>(false);
  protected readonly isGeneratingPdf = signal<boolean>(false);

  // Notificación / Toast tras guardar
  protected readonly saveFeedback = signal<string | null>(null);

  // Directorio filtrado por texto y por estatus
  protected readonly filteredVerifications = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    return this.qualityState.loadVerifications().filter(v => {
      const matchesQuery = !q || (
        v.folio.toLowerCase().includes(q) ||
        v.remisionNumber.toLowerCase().includes(q) ||
        v.clientName.toLowerCase().includes(q) ||
        v.productDescription.toLowerCase().includes(q) ||
        v.ramp.toLowerCase().includes(q)
      );
      const matchesStatus = status === 'ALL' || v.status === status;
      return matchesQuery && matchesStatus;
    });
  });

  // Validaciones reactivas de los instructivos normativos
  protected readonly isDirtyPallet = computed(() => {
    const crit = this.activeForm().productCriteria.find(c => c.id === 'crit-prod-4');
    return crit?.value === 'NO';
  });

  protected readonly isConditioningRequired = computed(() => {
    const it02Crits = ['crit-prod-1', 'crit-prod-2', 'crit-prod-3', 'crit-prod-5'];
    return this.activeForm().productCriteria.some(c => it02Crits.includes(c.id) && c.value === 'NO');
  });

  protected readonly isPestDetected = computed(() => {
    const prodPest = this.activeForm().productCriteria.find(c => c.id === 'crit-prod-8')?.value === 'NO';
    const transPest = this.activeForm().transportCriteria.find(c => c.id === 'crit-trans-4')?.value === 'NO';
    return prodPest || transPest;
  });

  protected selectVerification(v: LoadVerification): void {
    this.selectedVerificationId.set(v.id);
    this.activeForm.set(JSON.parse(JSON.stringify(v)));
    this.saveFeedback.set(null);
  }

  private getInitialVerificationCopy(id: string): LoadVerification {
    const found = this.qualityState.loadVerifications().find(v => v.id === id);
    if (found) {
      return JSON.parse(JSON.stringify(found));
    }
    return this.createNewBlankVerification();
  }

  protected createNewVerification(): void {
    const blank = this.createNewBlankVerification();
    this.selectedVerificationId.set(blank.id);
    this.activeForm.set(blank);
    this.saveFeedback.set(null);
  }

  private createNewBlankVerification(): LoadVerification {
    const dateNow = new Date();
    const formattedDate = dateNow.toISOString().slice(0, 10);
    const formattedTime = dateNow.toTimeString().slice(0, 5);

    return {
      id: `ver-new-${Date.now()}`,
      folio: `VER-2026-${String(this.qualityState.loadVerifications().length + 1).padStart(4, '0')}`,
      controlNumber: 'F01-PO-GC-8.6-03',
      revisionNumber: '03',
      revisionDate: '27/03/2026',
      processName: 'Liberación de carga',
      ownerDepartment: 'Seguridad e Inocuidad / Calidad',
      remisionNumber: `REM-2026-LALA-${Math.floor(1000 + Math.random() * 9000)}`,
      productDescription: 'Leche Lala Entera UHT 1 Litro (Tarima 80 Cajas)',
      clientName: 'Lala S.A. de C.V.',
      date: formattedDate,
      time: formattedTime,
      ramp: 'Rampa 04 (Andén Refrigerado)',
      status: 'EN_PROCESO',
      productCriteria: this.qualityState.getDefaultProductCriteria('SI'),
      transportCriteria: this.qualityState.getDefaultTransportCriteria('SI'),
      elaboratedBy: { name: 'Carlos Mendoza', position: 'Montacarguista / Andén', isSigned: true, signedAt: `${formattedDate} ${formattedTime}` },
      reviewedBy: { name: 'Laura Valdés', position: 'Auditora QM', isSigned: false },
      approvedBy: { name: 'Ing. Fernando Treviño', position: 'Superintendente QM', isSigned: false },
      cleaningResponsible: { name: '', isSigned: false },
      releaseResponsible: { name: 'Laura Valdés', isSigned: false },
      generalObservations: '',
      evidencePhotos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  protected setProductCriterionValue(critId: string, val: CriterionValue): void {
    this.activeForm.update(form => {
      const updatedList = form.productCriteria.map(c =>
        c.id === critId ? { ...c, value: val } : c
      );
      return { ...form, productCriteria: updatedList };
    });
    this.recalculateStatus();
  }

  protected setTransportCriterionValue(critId: string, val: CriterionValue): void {
    this.activeForm.update(form => {
      const updatedList = form.transportCriteria.map(c =>
        c.id === critId ? { ...c, value: val } : c
      );
      return { ...form, transportCriteria: updatedList };
    });
    this.recalculateStatus();
  }

  private recalculateStatus(): void {
    let newStatus: LoadVerification['status'] = 'APROBADO';

    if (this.isPestDetected()) {
      newStatus = 'RECHAZADO';
    } else if (this.isConditioningRequired()) {
      newStatus = 'ACONDICIONAMIENTO_PENDIENTE';
    } else if (this.isDirtyPallet() && !this.activeForm().cleaningResponsible.isSigned) {
      newStatus = 'LIMPIEZA_PENDIENTE';
    }

    this.activeForm.update(f => ({ ...f, status: newStatus }));
  }

  protected signCleaning(): void {
    if (!this.activeForm().cleaningResponsible.name.trim()) {
      alert('Debe ingresar el nombre de quien realizó la limpieza física bajo IT01-PO-GC-8.6-01.');
      return;
    }
    this.activeForm.update(f => ({
      ...f,
      cleaningResponsible: {
        ...f.cleaningResponsible,
        isSigned: true,
        signedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      }
    }));
    this.recalculateStatus();
  }

  protected signRelease(): void {
    if (this.isPestDetected()) {
      alert('No se puede liberar la carga. Se ha detectado PLAGA en la verificación.');
      return;
    }
    if (this.isDirtyPallet() && !this.activeForm().cleaningResponsible.isSigned) {
      alert('No se puede liberar la carga. Se requiere la firma de limpieza bajo IT01-PO-GC-8.6-01.');
      return;
    }
    if (this.isConditioningRequired() && this.activeForm().status === 'ACONDICIONAMIENTO_PENDIENTE') {
      if (!confirm('La carga tiene acondicionamiento pendiente (IT02). ¿Confirma que ya fue corregida para proceder con la liberación?')) {
        return;
      }
    }

    this.activeForm.update(f => ({
      ...f,
      status: 'APROBADO',
      releaseResponsible: {
        name: f.releaseResponsible.name || 'Laura Valdés (Auditora QM)',
        isSigned: true,
        signedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      },
      approvedBy: {
        ...f.approvedBy,
        name: f.approvedBy.name || 'Ing. Fernando Treviño',
        isSigned: true,
        signedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      }
    }));
  }

  protected saveVerification(): void {
    const current = this.activeForm();
    const existing = this.qualityState.loadVerifications().find(v => v.id === current.id);

    if (existing) {
      this.qualityState.updateLoadVerification(current);
      this.saveFeedback.set(`¡Verificación ${current.folio} guardada exitosamente!`);
    } else {
      this.qualityState.createLoadVerification(current);
      this.saveFeedback.set(`¡Verificación ${current.folio} registrada en el sistema!`);
    }

    setTimeout(() => {
      this.saveFeedback.set(null);
    }, 4000);
  }

  // ── CONTROL DEL MODAL OFICIAL DE IMPRESIÓN Y DESCARGA ──
  protected openPrintModal(): void {
    this.showPrintModal.set(true);
  }

  protected closePrintModal(): void {
    this.showPrintModal.set(false);
  }

  protected async downloadDirectPdf(): Promise<void> {
    this.isGeneratingPdf.set(true);
    try {
      const folio = this.activeForm().folio || 'F01-VERIFICACION';
      await this.printService.downloadPdf('#official-f01-print-sheet', `${folio}_F01-PO-GC-8.6-03.pdf`);
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  protected triggerBrowserPrint(): void {
    const folio = this.activeForm().folio || 'F01-VERIFICACION';
    this.printService.printElement('#official-f01-print-sheet', `${folio} - Verificación de Carga`);
  }

  protected getInitials(name: string): string {
    if (!name) return '4G';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
