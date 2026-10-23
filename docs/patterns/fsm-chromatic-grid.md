# Patrón 5: Topología Cromática FSM (Matriz Visual de Estados)

> **Ubicación:** `docs/patterns/fsm-chromatic-grid.md`  
> **Aplica a:** Ubicaciones Físicas (`/layout`), Topología de Racks, Monitoreo de Andenes de Carga (Docking).

---

## 📐 Wireframe del Patrón

```
+---------------------------------------------------------------------------------+
| FILTROS DE ZONA & LEYENDA CROMÁTICA DE ESTADOS (FSM)                            |
| Leyenda: [Verde: Disponible] [Amarillo: Ocupado] [Rojo: Bloqueado] [Gris: Inactivo]|
+---------------------------------------------------------------------------------+
| GRID TRIDIMENSIONAL / RACK TOPO MAP                                            |
| Pasillo A1:                                                                     |
| [Pos 01-01-01 (Verde)]  [Pos 01-01-02 (Amarillo)]  [Pos 01-01-03 (Rojo)]       |
| Pasillo A2:                                                                     |
| [Pos 02-01-01 (Verde)]  [Pos 02-01-02 (Verde)]     [Pos 02-01-03 (Gris)]       |
+---------------------------------------------------------------------------------+
| MODAL DE CAMBIO DE ESTADO FSM (PATCH /status)                                   |
| - Estado actual vs Estado nuevo                                                 |
| - Input obligatorio: Motivo del cambio (Reason)                                 |
+---------------------------------------------------------------------------------+
```

---

## 🧱 Estructura Esquelética HTML (`fsm-grid.component.html`)

```html
<div class="fsm-topo-page">

  <!-- 1. LEYENDA CROMÁTICA DE ESTADOS FSM -->
  <header class="fsm-legend">
    <div class="fsm-legend__item fsm-legend__item--available">
      <span class="fsm-dot"></span>
      <span>Disponible</span>
    </div>
    <div class="fsm-legend__item fsm-legend__item--occupied">
      <span class="fsm-dot"></span>
      <span>Ocupado</span>
    </div>
    <div class="fsm-legend__item fsm-legend__item--blocked">
      <span class="fsm-dot"></span>
      <span>Bloqueado</span>
    </div>
    <div class="fsm-legend__item fsm-legend__item--quarantine">
      <span class="fsm-dot"></span>
      <span>Cuarentena</span>
    </div>
  </header>

  <!-- 2. GRID DE POSICIONES CROMÁTICAS -->
  <main class="fsm-grid-container">
    @for (location of locations(); track location.id) {
      <div
        class="fsm-tile"
        [class]="'fsm-tile--' + getFsmColorClass(location)"
        (click)="openStatusModal(location)"
      >
        <span class="fsm-tile__code">{{ location.code }}</span>
        <span class="fsm-tile__type">{{ location.type }}</span>
        <span class="fsm-tile__status">{{ location.isBlocked ? 'BLOQUEADA' : 'ACTIVA' }}</span>
      </div>
    }
  </main>

  <!-- 3. MODAL DE CAMBIO DE ESTADO FSM -->
  @if (selectedLocation(); as loc) {
    <div class="modal-backdrop" (click)="closeStatusModal()"></div>
    <div class="modal-panel">
      <h2>Transición de Estado FSM — {{ loc.code }}</h2>
      <p>Cambiar estado de bloqueo para la ubicación seleccionada.</p>

      <div class="form-field">
        <label>Motivo Obligatorio del Cambio (Reason)</label>
        <textarea [(ngModel)]="statusReason" placeholder="Indica la razón del cambio de estado..."></textarea>
      </div>

      <div class="modal-actions">
        <button class="btn btn--ghost" (click)="closeStatusModal()">Cancelar</button>
        <button class="btn btn--danger" [disabled]="!statusReason.trim()" (click)="confirmStatusChange()">
          Confirmar Transición FSM
        </button>
      </div>
    </div>
  }
</div>
```

---

## ⚙️ TypeScript con Signals (`fsm-grid.component.ts`)

```typescript
@Component({
  selector: 'fg-fsm-grid-pattern',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fsm-grid-pattern.component.html',
  styleUrl: './fsm-grid-pattern.component.css'
})
export class FsmGridPatternComponent implements OnInit {
  private readonly locationService = inject(LocationService);
  private readonly toast = inject(ToastService);

  readonly locations = signal<LocationDto[]>([]);
  readonly selectedLocation = signal<LocationDto | null>(null);
  statusReason = '';

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.locationService.getAll().subscribe(data => this.locations.set(data));
  }

  getFsmColorClass(loc: LocationDto): string {
    if (loc.isBlocked) return 'blocked';
    if (loc.isOccupied) return 'occupied';
    return 'available';
  }

  openStatusModal(loc: LocationDto): void {
    this.statusReason = '';
    this.selectedLocation.set(loc);
  }

  closeStatusModal(): void {
    this.selectedLocation.set(null);
  }

  confirmStatusChange(): void {
    const loc = this.selectedLocation();
    if (!loc || !this.statusReason.trim()) return;

    // Petición PATCH /api/v1/locations/{id}/status con reason obligatorio
    this.locationService.patchStatus(loc.id, !loc.isBlocked, this.statusReason).subscribe({
      next: () => {
        this.toast.success('Estado FSM actualizado correctamente');
        this.closeStatusModal();
        this.loadLocations();
      },
      error: (err) => this.toast.error(err.error?.message ?? 'Error al cambiar estado')
    });
  }
}
```
