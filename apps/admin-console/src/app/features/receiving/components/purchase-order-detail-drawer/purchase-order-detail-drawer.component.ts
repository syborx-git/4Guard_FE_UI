/**
 * @file purchase-order-detail-drawer.component.ts
 * @description Drawer Enterprise para Consulta y Análisis Documental de Orden de Compra (PO) [HU-029 Evolución V2].
 * Soporta Carga, Drag & Drop, Previsualización, Versionado (v1, v2...), RBAC por Capacidades y Visor Integrado.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReceptionAppointment } from '../../models/reception-appointment.models';
import {
  PurchaseOrder,
  POValidationResult,
  POAuditEntry,
  POStatus,
  PODocumentRecord,
  PODocumentVersion,
  DocumentCapability,
  PO_VALIDATION_STATUS_LABELS,
  PO_VALIDATION_STATUS_CLASSES,
  DISCREPANCY_LABELS,
} from '../../models/purchase-order.models';
import { PurchaseOrderValidationService } from '../../services/purchase-order-validation.service';
import { PurchaseOrderDocumentService, FileUploadPayload } from '../../services/purchase-order-document.service';
import { AuthState } from '../../../../core/auth/auth.state';

export type PODrawerTab = 'SUMMARY' | 'DOCUMENT' | 'COMPARISON' | 'AUDIT';
export type PODocSubMode = 'VIEW' | 'PREVIEW_CONFIRM' | 'HISTORY_VIEW';

export const PO_STATUS_TRANSLATIONS: Record<POStatus, string> = {
  RELEASED: 'Liberada',
  PARTIAL: 'Parcialmente recibida',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export const PO_STATUS_CLASSES: Record<POStatus, string> = {
  RELEASED: 'po-chip--released',
  PARTIAL: 'po-chip--partial',
  CLOSED: 'po-chip--closed',
  CANCELLED: 'po-chip--cancelled',
  EXPIRED: 'po-chip--expired',
};

@Component({
  selector: 'app-purchase-order-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-order-detail-drawer.component.html',
  styleUrl: './purchase-order-detail-drawer.component.css',
})
export class PurchaseOrderDetailDrawerComponent implements OnChanges, OnDestroy {
  private readonly poValidationService = inject(PurchaseOrderValidationService);
  private readonly poDocService = inject(PurchaseOrderDocumentService);
  private readonly authState = inject(AuthState);

  @Input() appointment: ReceptionAppointment | null = null;
  @Input() isOpen = false;

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() openPOValidation = new EventEmitter<ReceptionAppointment>();

  // Signals de Navegación y Modo
  readonly activeTab = signal<PODrawerTab>('SUMMARY');
  readonly docSubMode = signal<PODocSubMode>('VIEW');

  // Drag & Drop / Previsualización
  readonly isDragging = signal(false);
  readonly stagedPayload = signal<FileUploadPayload | null>(null);
  readonly replacementReason = signal('');
  readonly isReplacement = signal(false);

  // Mensajes de Alerta
  readonly docErrorMessage = signal<string | null>(null);
  readonly docSuccessMessage = signal<string | null>(null);

  // Modal Fullscreen
  readonly isFullscreenViewerOpen = signal(false);

  // Rol del Usuario
  readonly userRole = computed(() => (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase());
  readonly userName = computed(() => {
    const u = this.authState.currentUser();
    return u?.fullName || u?.username || 'OPERATIONS_MANAGER';
  });

  // Capacidades Documentales RBAC (Desacopladas de nombres de puestos string - Ajuste EVOLUCIÓN V2)
  readonly canViewDocument = computed(() => this.poDocService.hasCapability('DOCUMENT_VIEW', this.userRole()));
  readonly canUploadDocument = computed(() => this.poDocService.hasCapability('DOCUMENT_UPLOAD', this.userRole()));
  readonly canDownloadDocument = computed(() => this.poDocService.hasCapability('DOCUMENT_DOWNLOAD', this.userRole()));
  readonly canReplaceDocument = computed(() => this.poDocService.hasCapability('DOCUMENT_REPLACE', this.userRole()));
  readonly canViewHistory = computed(() => this.poDocService.hasCapability('DOCUMENT_VERSION_HISTORY', this.userRole()));

  readonly canViewCommercialAmounts = computed(() => {
    const role = this.userRole();
    return role === 'OPERATIONS_MANAGER' || role === 'ADMIN';
  });

  readonly canViewAudit = computed(() => {
    const role = this.userRole();
    return role !== 'MANEUVER_OPERATOR' && role !== 'WAREHOUSE_OPERATOR';
  });

  readonly canViewComparison = computed(() => {
    const role = this.userRole();
    return role !== 'MANEUVER_OPERATOR';
  });

  // Expediente Documental Activo (Consultado desde servicio)
  readonly activeDocumentRecord = computed<PODocumentRecord | undefined>(() => {
    const appt = this.appointment;
    if (!appt || !appt.poNumber) return undefined;
    return this.poDocService.documentsMap()[appt.poNumber.trim().toUpperCase()];
  });

  // Orden de Compra y Validación
  readonly purchaseOrder = computed<PurchaseOrder | undefined>(() => {
    const appt = this.appointment;
    if (!appt || !appt.poNumber) return undefined;
    return this.poValidationService.getPOByNumber(appt.poNumber);
  });

  readonly validationResult = computed<POValidationResult | undefined>(() => {
    const appt = this.appointment;
    if (!appt) return undefined;

    const existing = this.poValidationService.validationsMap()[appt.id];
    if (existing) return existing;

    if (appt.poNumber) {
      const po = this.poValidationService.getPOByNumber(appt.poNumber);
      if (po) {
        return this.poValidationService.validateAppointmentAgainstPO(appt);
      }
    }
    return undefined;
  });

  readonly auditEntries = computed<POAuditEntry[]>(() => {
    const appt = this.appointment;
    if (!appt) return [];
    return this.poValidationService.getAuditByAppointment(appt.id, appt.poNumber);
  });

  // Labels & Helpers
  readonly poStatusTranslations = PO_STATUS_TRANSLATIONS;
  readonly poStatusClasses = PO_STATUS_CLASSES;
  readonly poValidationStatusLabels = PO_VALIDATION_STATUS_LABELS;
  readonly poValidationStatusClasses = PO_VALIDATION_STATUS_CLASSES;
  readonly discrepancyLabels = DISCREPANCY_LABELS;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.activeTab.set('SUMMARY');
        this.docSubMode.set('VIEW');
        this.docErrorMessage.set(null);
        this.docSuccessMessage.set(null);
        this._lockScroll();
      } else {
        this._unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this._unlockScroll();
  }

  @HostListener('window:keydown.escape', ['$event'])
  handleEscape(event: KeyboardEvent): void {
    if (this.isFullscreenViewerOpen()) {
      event.preventDefault();
      this.isFullscreenViewerOpen.set(false);
      return;
    }
    if (this.isOpen) {
      event.preventDefault();
      this.onClose();
    }
  }

  onClose(): void {
    this._unlockScroll();
    this.closeDrawer.emit();
  }

  onGoToPOValidation(): void {
    if (this.appointment) {
      this.openPOValidation.emit(this.appointment);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // EVENTOS DE CARGA DRAG & DROP Y SELECCIÓN DE ARCHIVOS
  // ══════════════════════════════════════════════════════════════════════

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this._processSelectedFile(files[0], 'MANUAL_UPLOAD');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this._processSelectedFile(input.files[0], 'MANUAL_UPLOAD');
    }
  }

  onCameraCaptureMock(): void {
    // Simulación de captura fotográfica desde dispositivo
    const mockFilePayload: FileUploadPayload = {
      fileName: `FOTO_OC_${this.appointment?.poNumber || 'CAPTURE'}_${Date.now().toString().slice(-4)}.jpg`,
      fileSizeFormatted: '1.8 MB',
      fileType: 'IMAGE',
      mimeType: 'image/jpeg',
      fileUrl: '', // URL sintética de vista previa
      source: 'CAMERA_CAPTURE',
    };

    this.stagedPayload.set(mockFilePayload);
    this.docSubMode.set('PREVIEW_CONFIRM');
    this.docErrorMessage.set(null);
  }

  private _processSelectedFile(file: File, source: 'MANUAL_UPLOAD' | 'CAMERA_CAPTURE'): void {
    this.docErrorMessage.set(null);

    // Validación de peso (Máximo 10 MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.docErrorMessage.set('El archivo excede el tamaño máximo permitido de 10 MB.');
      return;
    }

    // Validación de formato (PDF, JPG, JPEG, PNG)
    const validMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!validMimes.includes(file.type) && (!ext || !validExts.includes(ext))) {
      this.docErrorMessage.set('Formato no soportado. Solo se permiten archivos PDF, JPG, JPEG y PNG.');
      return;
    }

    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeFormatted = file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${sizeMb} MB`;

    // Generar URL blob de vista previa segura
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      objectUrl = '';
    }

    const payload: FileUploadPayload = {
      fileName: file.name,
      fileSizeFormatted: sizeFormatted,
      fileType: isPdf ? 'PDF' : 'IMAGE',
      mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      fileUrl: objectUrl,
      source,
    };

    this.stagedPayload.set(payload);
    this.docSubMode.set('PREVIEW_CONFIRM');
  }

  confirmAssociation(): void {
    const payload = this.stagedPayload();
    const appt = this.appointment;
    if (!payload || !appt || !appt.poNumber) return;

    try {
      this.docErrorMessage.set(null);

      if (this.isReplacement()) {
        const reason = this.replacementReason();
        if (!reason || reason.trim().length < 10) {
          this.docErrorMessage.set('El motivo del reemplazo de versión es obligatorio (mínimo 10 caracteres).');
          return;
        }

        this.poDocService.replaceDocumentVersion(appt.poNumber, appt.id, reason, payload);
        this.docSuccessMessage.set(`Nueva versión del documento asociada correctamente.`);
      } else {
        this.poDocService.uploadInitialDocument(appt.poNumber, appt.id, appt.branchId, payload);
        this.docSuccessMessage.set(`Documento v1 de la Orden de Compra asociado correctamente.`);
      }

      this.stagedPayload.set(null);
      this.replacementReason.set('');
      this.isReplacement.set(false);
      this.docSubMode.set('VIEW');
    } catch (e: any) {
      this.docErrorMessage.set(e?.message || 'Error al guardar el documento.');
    }
  }

  cancelStaging(): void {
    this.stagedPayload.set(null);
    this.replacementReason.set('');
    this.isReplacement.set(false);
    this.docErrorMessage.set(null);
    this.docSubMode.set('VIEW');
  }

  startReplacement(): void {
    if (!this.canReplaceDocument()) {
      this.docErrorMessage.set('No cuentas con la capacidad requerida para reemplazar el documento.');
      return;
    }
    this.isReplacement.set(true);
    this.replacementReason.set('');
    this.docErrorMessage.set(null);

    // Disparar click en input de archivo
    const fileInput = document.getElementById('po-doc-replace-input') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  downloadDocument(): void {
    const record = this.activeDocumentRecord();
    const appt = this.appointment;
    if (!record || !appt) return;

    try {
      this.poDocService.logDocumentDownloaded(record.poNumber, appt.id, record.activeVersion.fileName);
      this.docSuccessMessage.set(`Descarga de ${record.activeVersion.fileName} iniciada exitosamente.`);

      if (record.activeVersion.fileUrl && record.activeVersion.fileUrl.startsWith('blob:')) {
        // Descargar archivo blob cargado por el usuario
        const a = document.createElement('a');
        a.href = record.activeVersion.fileUrl;
        a.download = record.activeVersion.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Generar descarga de archivo PDF formateado del expediente original
        this._generateAndDownloadPdfDocument(record, appt);
      }
    } catch (e: any) {
      this.docErrorMessage.set(e?.message || 'Error al descargar el documento.');
    }
  }

  private _generateAndDownloadPdfDocument(record: PODocumentRecord, appt: ReceptionAppointment): void {
    const po = this.purchaseOrder();
    const company = po?.clientName || 'CONFECCIONES TELY, S.A.';
    const supplier = po?.supplierName || 'TIENDAS MIL, S.A.';
    const issueDate = this.formatDate(po?.issueDate || '2026-07-25');
    const expDate = this.formatDate(po?.expirationDate || '2026-08-28');

    let rowsHtml = '';
    let grandTotal = 0;

    appt.lines.forEach((line, idx) => {
      const unitPrice = 45.0;
      const total = line.expectedQty * unitPrice;
      grandTotal += total;

      rowsHtml += `
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px;"><strong>${line.sku}</strong> — ${line.description}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 6px;">${line.expectedQty.toLocaleString()} ${line.unit}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 6px;">$${unitPrice.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 6px;">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${record.activeVersion.fileName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 20px; background: #fff; }
          .po-box { border: 2px solid #000; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; position: relative; }
          .company { font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; }
          .ruc { font-size: 12px; font-weight: normal; margin-top: 4px; display: block; }
          .title-pill { display: inline-block; border: 2px solid #000; border-radius: 12px; padding: 4px 16px; font-weight: bold; font-size: 14px; margin-top: 10px; }
          .po-no { display: inline-block; font-size: 14px; font-weight: bold; margin-left: 10px; }
          .meta-rows { margin-bottom: 15px; font-size: 13px; line-height: 1.6; }
          .lbl { font-weight: bold; }
          .val-line { border-bottom: 1px dotted #000; display: inline-block; min-width: 250px; padding-left: 5px; }
          .intro { font-size: 13px; font-style: italic; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { border: 1px solid #000; background: #f0f0f0; padding: 8px; font-weight: bold; text-align: center; }
          .total-row td { font-weight: bold; border: 1px solid #000; padding: 8px; text-align: right; }
          .sigs { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; text-align: center; }
          .sig-box { width: 30%; }
          .sig-line { border-top: 1px solid #000; margin-bottom: 4px; }
          .footer-note { font-size: 10px; color: #555; text-align: center; margin-top: 25px; border-top: 1px dashed #aaa; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="po-box">
          <div class="header">
            <h1 class="company">${company}</h1>
            <span class="ruc">Ruc. 129391-9283</span>
            <div style="margin-top: 10px;">
              <span class="title-pill">ORDEN DE COMPRA</span>
              <span class="po-no">No: ${record.poNumber}</span>
            </div>
          </div>

          <div class="meta-rows">
            <div><span class="lbl">Proveedor:</span> <span class="val-line">${supplier}</span></div>
            <div style="display: flex; justify-content: space-between; margin-top: 6px;">
              <div><span class="lbl">Fecha del pedido:</span> <span class="val-line" style="min-width: 140px;">${issueDate}</span></div>
              <div><span class="lbl">Fecha de pago:</span> <span class="val-line" style="min-width: 140px;">${expDate}</span></div>
            </div>
            <div style="margin-top: 6px;"><span class="lbl">Términos de entrega:</span> <span class="val-line" style="min-width: 350px;">En las instalaciones de la fábrica (Planta ${appt.branchName})</span></div>
          </div>

          <p class="intro">Sírvanse por este medio suministrarnos los siguientes artículos:</p>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No.</th>
                <th>ARTÍCULO</th>
                <th style="width: 90px;">CANTIDAD</th>
                <th style="width: 100px;">PRECIO UNITARIO</th>
                <th style="width: 110px;">PRECIO TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4">COSTO TOTAL</td>
                <td>$${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>

          <div class="sigs">
            <div class="sig-box"><div class="sig-line"></div>Elaborado Por:</div>
            <div class="sig-box"><div class="sig-line"></div>Autorizado Por:</div>
            <div class="sig-box"><div class="sig-line"></div>Recibido Por:</div>
          </div>

          <div class="footer-note">
            Imprenta San Sebastián, Managua - Nicaragua Tel: 289 3849 Fax: 289 7364<br>
            <strong>✔ EXPEDIENTE DIGITAL INALTERABLE 4GUARD WMS · VERSIÓN ${record.activeVersion.versionLabel}</strong>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generar Blob descargable de documento PDF u HTML ejecutable
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Crear elemento de descarga directa
    const a = document.createElement('a');
    a.href = url;
    a.download = record.activeVersion.fileName.endsWith('.pdf') 
      ? record.activeVersion.fileName 
      : `${record.activeVersion.fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }


  openFullscreenViewer(): void {
    const record = this.activeDocumentRecord();
    const appt = this.appointment;
    if (record && appt) {
      this.poDocService.logDocumentViewed(record.poNumber, appt.id);
    }
    this.isFullscreenViewerOpen.set(true);
  }

  restoreHistoricalVersion(versionNumber: number): void {
    const record = this.activeDocumentRecord();
    const appt = this.appointment;
    if (!record || !appt) return;

    try {
      this.poDocService.restoreDocumentVersion(record.poNumber, appt.id, versionNumber);
      this.docSuccessMessage.set(`Vista previa restaurada a la versión v${versionNumber}.`);
      this.docSubMode.set('VIEW');
    } catch (e: any) {
      this.docErrorMessage.set(e?.message || 'Error al cambiar de versión.');
    }
  }

  // Formatting Helpers
  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  formatDateTime(dateTimeStr?: string): string {
    if (!dateTimeStr) return 'N/A';
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs`;
    } catch {
      return dateTimeStr;
    }
  }

  private _lockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private _unlockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }
}
