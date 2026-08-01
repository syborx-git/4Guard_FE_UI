# Patrón 4: Wizard / Formulario Multi-Paso (Stepper)

> **Ubicación:** `docs/patterns/wizard-multi-step.md`  
> **Aplica a:** Alta de Almacén Completo, Recepción de ASN, Conteo Físico de Inventario, Creación de Embarque.

---

## 📐 Wireframe del Patrón

```
+---------------------------------------------------------------------------------+
| WIZARD STEPPER HEADER                                                           |
| ( [1. Datos Generales] ------ (2. Configuración) ------ [3. Resumen y Confirmar] |
+---------------------------------------------------------------------------------+
| CONTENIDO DEL PASO ACTIVO (Formulario reactivo del paso actual)                |
|                                                                                 |
|  Step 1: Input Nombre, Tipo, RFC                                                |
|  Step 2: Selección de Sucursal, Secciones y Capacidad                          |
|  Step 3: Resumen de Validación antes de enviar a la BD                         |
|                                                                                 |
+---------------------------------------------------------------------------------+
| STICKY FOOTER DE NAVEGACIÓN DE PASOS                                            |
| [ < Cancelar ]                      [ < Anterior ]      [ Siguiente / Enviar > ]|
+---------------------------------------------------------------------------------+
```

---

## 🧱 Estructura Esquelética HTML (`wizard.component.html`)

```html
<div class="wizard-container">

  <!-- 1. STEPPER INDICATOR -->
  <nav class="stepper-header">
    @for (step of steps(); track step.index) {
      <div
        class="step-item"
        [class.step-item--active]="currentStep() === step.index"
        [class.step-item--completed]="currentStep() > step.index"
      >
        <div class="step-item__number">
          @if (currentStep() > step.index) {
            <span class="material-symbols-outlined">check</span>
          } @else {
            {{ step.index }}
          }
        </div>
        <span class="step-item__label">{{ step.label }}</span>
      </div>
    }
  </nav>

  <!-- 2. CONTENIDO DINÁMICO POR PASO -->
  <main class="wizard-body">
    @switch (currentStep()) {
      @case (1) {
        <section class="step-content">
          <h2>Paso 1: Información General</h2>
          <form [formGroup]="step1Form" class="form-grid--2">
            <div class="form-field">
              <label>Nombre Comercial</label>
              <input type="text" formControlName="name" />
            </div>
            <div class="form-field">
              <label>Identificador Tax / RFC</label>
              <input type="text" formControlName="taxId" />
            </div>
          </form>
        </section>
      }
      @case (2) {
        <section class="step-content">
          <h2>Paso 2: Configuración Operativa</h2>
          <form [formGroup]="step2Form" class="form-grid--2">
            <div class="form-field">
              <label>Capacidad Máxima (m³)</label>
              <input type="number" formControlName="capacity" />
            </div>
          </form>
        </section>
      }
      @case (3) {
        <section class="step-content">
          <h2>Paso 3: Confirmación y Resumen</h2>
          <div class="summary-box">
            <p><strong>Nombre:</strong> {{ step1Form.value.name }}</p>
            <p><strong>RFC:</strong> {{ step1Form.value.taxId }}</p>
            <p><strong>Capacidad:</strong> {{ step2Form.value.capacity }} m³</p>
          </div>
        </section>
      }
    }
  </main>

  <!-- 3. FOOTER STICKY DE CONTROL DE PASOS -->
  <footer class="wizard-footer">
    <button class="btn btn--ghost" (click)="cancel()">Cancelar</button>
    <div class="wizard-footer__right">
      <button class="btn btn--secondary" *ngIf="currentStep() > 1" (click)="prevStep()">Anterior</button>
      <button class="btn btn--primary" *ngIf="currentStep() < totalSteps()" (click)="nextStep()" [disabled]="isCurrentStepInvalid()">
        Siguiente
      </button>
      <button class="btn btn--gold" *ngIf="currentStep() === totalSteps()" (click)="submit()" [disabled]="isSubmitting()">
        Confirmar y Guardar
      </button>
    </div>
  </footer>

</div>
```

---

## ⚙️ TypeScript con Signals (`wizard.component.ts`)

```typescript
@Component({
  selector: 'fg-wizard-pattern',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wizard-pattern.component.html',
  styleUrl: './wizard-pattern.component.css'
})
export class WizardPatternComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly currentStep = signal(1);
  readonly totalSteps = signal(3);
  readonly isSubmitting = signal(false);

  readonly steps = signal([
    { index: 1, label: 'Datos Generales' },
    { index: 2, label: 'Configuración' },
    { index: 3, label: 'Resumen' }
  ]);

  step1Form!: FormGroup;
  step2Form!: FormGroup;

  ngOnInit(): void {
    this.step1Form = this.fb.group({
      name: ['', Validators.required],
      taxId: ['', Validators.required]
    });

    this.step2Form = this.fb.group({
      capacity: [1000, [Validators.required, Validators.min(1)]]
    });
  }

  isCurrentStepInvalid(): boolean {
    if (this.currentStep() === 1) return this.step1Form.invalid;
    if (this.currentStep() === 2) return this.step2Form.invalid;
    return false;
  }

  nextStep(): void {
    if (this.isCurrentStepInvalid()) return;
    this.currentStep.update(s => Math.min(s + 1, this.totalSteps()));
  }

  prevStep(): void {
    this.currentStep.update(s => Math.max(s - 1, 1));
  }

  submit(): void {
    this.isSubmitting.set(true);
    // Envío del payload consolidado al Backend
  }
}
```
