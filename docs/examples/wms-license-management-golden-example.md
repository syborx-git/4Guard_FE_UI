# 🌟 Golden Example — Módulo de Licencias y Capacidades WMS

Este documento documenta el **Patrón de Arquitectura de Referencia (Golden Example)** para el diseño de módulos de administración en 4GUARD WMS, basado en la implementación del módulo de Licencias y Capacidades (`license-management`).

---

## 🏛️ Patrones Arquitectónicos Clave

### 1. Desacoplado de Modales Emergentes (Prevención de Refresco HTML)
Para evitar que un modal emergente dentro de una pantalla ejecute un envío por defecto del formulario nativo (`submit`), los modales de confirmación deben usar contenedores `div` y controlar el evento explícitamente:

```typescript
// Component TS
confirmAction(event?: Event): void {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  // Ejecutar petición HTTP sin refresco de ruta
}
```

```html
<!-- Component HTML -->
<div class="carriers-dialog-overlay" (click)="closeActionModal()">
  <div class="carriers-dialog" (click)="$event.stopPropagation()">
    <header class="carriers-dialog__header">
      <div class="carriers-dialog__icon carriers-dialog__icon--danger">
        <span class="material-symbols-outlined">block</span>
      </div>
      <h2 class="carriers-dialog__title">Revocar licencia</h2>
    </header>

    <!-- Usar <div> en lugar de <form> para evitar submit nativo del navegador -->
    <div class="carriers-dialog__form">
      <div class="fg-field">
        <label class="fg-label fg-label--required">Motivo</label>
        <textarea class="fg-textarea" formControlName="reason"></textarea>
      </div>
      <div class="carriers-dialog__actions">
        <button type="button" class="carriers-btn carriers-btn--ghost" (click)="closeActionModal()">Cancelar</button>
        <button type="button" class="carriers-btn carriers-btn--danger" (click)="confirmAction($event)">Confirmar</button>
      </div>
    </div>
  </div>
</div>
```

---

### 2. Deshabilitación Selectiva por Secciones (`[disabled]="isRevokedReadOnly()"`)
Al consultar un registro en estado final o inalterable (`REVOKED` / `CLOSED`), el formulario debe proteger sus campos sin bloquear la barra inferior de acciones:

```html
<!-- Secciones de campos deshabilitadas en bloque mediante <fieldset disabled> -->
<fieldset class="carriers-form-section" formGroupName="identification" [disabled]="isRevokedReadOnly()">
  <!-- Inputs, Selects y Textareas deshabilitados automáticamente para lectura -->
</fieldset>

<!-- Barra de acciones libre en la raíz del formulario -->
<div class="carriers-form-actions">
  <div class="carriers-form-actions__status-group">
    @if (selectedLicense()?.adminStatus === 'REVOKED') {
      <!-- El botón verde Activar permanece 100% habilitado y cliqueable -->
      <button type="button" class="carriers-btn carriers-btn--success" (click)="openActionModal('REACTIVATE')">
        <span class="material-symbols-outlined">check_circle</span>
        Activar
      </button>
    }
  </div>
</div>
```

---

### 3. Timeline de Auditoría Integrado (`.carriers-timeline-preview`)
Línea de tiempo con nodos circulares coloreados, línea vertical conectora y timestamps de cambios:

```html
<div class="carriers-timeline-preview">
  <div class="carriers-timeline-preview__header">
    <span class="material-symbols-outlined">timeline</span>
    <span>Historial de cambios</span>
  </div>

  <div class="carriers-timeline-preview__nodes">
    @for (entry of auditEntries(); track entry.id; let last = $last) {
      <div class="carriers-tl-node carriers-tl-node--update">
        <div class="carriers-tl-node__dot">
          <span class="material-symbols-outlined">info</span>
        </div>
        <div class="carriers-tl-node__line" [class.carriers-tl-node__line--last]="last"></div>
        <div class="carriers-tl-node__content">
          <span class="carriers-tl-node__action">{{ entry.action }} — {{ entry.reason }}</span>
          <span class="carriers-tl-node__meta">Por {{ entry.performedBy }} · {{ entry.performedAt | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      </div>
    }
  </div>
</div>
```

---

## 🛠️ Archivos de Referencia

- **Component TS:** [`apps/admin-console/src/app/features/license-management/license-management/license-management.component.ts`](file:///c:/Users/kike2/OneDrive/Escritorio/IronShark/4ward/workspace/4Guard_FE_UI/apps/admin-console/src/app/features/license-management/license-management/license-management.component.ts)
- **Template HTML:** [`apps/admin-console/src/app/features/license-management/license-management/license-management.component.html`](file:///c:/Users/kike2/OneDrive/Escritorio/IronShark/4ward/workspace/4Guard_FE_UI/apps/admin-console/src/app/features/license-management/license-management/license-management.component.html)
- **Estilos CSS:** [`apps/admin-console/src/app/features/license-management/license-management/license-management.component.css`](file:///c:/Users/kike2/OneDrive/Escritorio/IronShark/4ward/workspace/4Guard_FE_UI/apps/admin-console/src/app/features/license-management/license-management/license-management.component.css)
- **Modelos:** [`apps/admin-console/src/app/features/license-management/license-management.models.ts`](file:///c:/Users/kike2/OneDrive/Escritorio/IronShark/4ward/workspace/4Guard_FE_UI/apps/admin-console/src/app/features/license-management/license-management.models.ts)
