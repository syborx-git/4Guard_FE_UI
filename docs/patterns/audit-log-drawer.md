# Patrón 3: Audit Log & Drawer Lateral (Trazabilidad y Diffs JSON)

> **Ubicación:** `docs/patterns/audit-log-drawer.md`  
> **Aplica a:** Actividad de Usuario (`/user-activity`), Sesiones Activas (`/sessions`), Consola de Auditoría.

---

## 📐 Wireframe del Patrón

```
+---------------------------------------------------------------------------------+
| HERO BAR (Filtros de Rango de Fechas + Búsqueda + Exportar XLSX/PDF)            |
+---------------------------------------------------------------------------------+
| KPI CARDS (Usuarios Activos | Total Eventos | Op. Críticas | Errores / Alertas) |
+---------------------------------------------------------------------------------+
| BARRA DE VISTA: [ TABLA ] [ LÍNEA DE TIEMPO (TIMELINE) ]                        |
+-------------------------------------------------------------+-------------------+
| TABLA CRONOLÓGICA DE AUDITORÍA                              | DRAWER LATERAL    |
| - Fecha / Hora (ISO UTC)                                    | (SLIDE RIGHT)     |
| - Usuario (Avatar + Rol)                                    | - Detalle Evento  |
| - Acción (Badge: LOGIN, CREATE, DELETE, STATUS)             | - Dispositivo / IP|
| - Entidad Afectada & ID                                     | - Diff JSON       |
| - Botón [Ver Detalle] ------------------------------> Opens |   (Antes vs.      |
+-------------------------------------------------------------|    Después)       |
                                                              +-------------------+
```

---

## 🧱 Estructura Esquelética HTML (`audit-log.component.html`)

```html
<div class="audit-page">

  <!-- 1. BARRA DE FILTROS & HERO -->
  <header class="audit-hero">
    <div class="audit-hero__title">
      <span class="material-symbols-outlined">manage_search</span>
      <h1>Bitácora de Auditoría y Trazabilidad</h1>
    </div>

    <div class="audit-filters-bar">
      <input type="date" [value]="dateFrom()" (change)="onDateFromChange($event)" />
      <input type="date" [value]="dateTo()" (change)="onDateToChange($event)" />
      <button class="btn btn--primary" (click)="applyFilters()">Filtrar</button>
      <button class="btn btn--ghost" (click)="export('XLSX')">Exportar Excel</button>
    </div>
  </header>

  <!-- 2. VISTA DE TABLA -->
  <main class="audit-content">
    <table class="fg-table">
      <thead>
        <tr>
          <th>Fecha / Hora</th>
          <th>Usuario</th>
          <th>Acción</th>
          <th>Entidad</th>
          <th>Resultado</th>
          <th>Detalle</th>
        </tr>
      </thead>
      <tbody>
        @for (log of logs(); track log.id) {
          <tr (click)="openDrawer(log)">
            <td>{{ log.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</td>
            <td>{{ log.username }}</td>
            <td><span class="action-badge">{{ log.action }}</span></td>
            <td>{{ log.entityType }} #{{ log.entityId }}</td>
            <td><span class="badge" [class]="'badge--' + log.result.toLowerCase()">{{ log.result }}</span></td>
            <td>
              <button class="icon-btn" (click)="openDrawer(log)">
                <span class="material-symbols-outlined">open_in_new</span>
              </button>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </main>

  <!-- 3. DRAWER LATERAL SLIDE-OVER -->
  @if (selectedLog(); as log) {
    <div class="drawer-backdrop" (click)="closeDrawer()"></div>
    <aside class="drawer-panel">
      <header class="drawer-header">
        <h2>Detalle de Auditoría</h2>
        <button class="icon-btn" (click)="closeDrawer()"><span class="material-symbols-outlined">close</span></button>
      </header>

      <div class="drawer-body">
        <div class="meta-row">
          <span>IP: {{ log.ipAddress }}</span>
          <span>Navegador: {{ log.userAgent }}</span>
        </div>

        <h3>Comparativa de Cambios (Diff JSON)</h3>
        <div class="diff-container">
          <div class="diff-box diff-box--before">
            <h4>Valor Anterior</h4>
            <pre>{{ log.previousValues | json }}</pre>
          </div>
          <div class="diff-box diff-box--after">
            <h4>Valor Nuevo</h4>
            <pre>{{ log.newValues | json }}</pre>
          </div>
        </div>
      </div>
    </aside>
  }
</div>
```

---

## ⚙️ TypeScript con Signals (`audit-log.component.ts`)

```typescript
@Component({
  selector: 'fg-audit-pattern',
  standalone: true,
  imports: [CommonModule, DatePipe, JsonPipe],
  templateUrl: './audit-pattern.component.html',
  styleUrl: './audit-pattern.component.css'
})
export class AuditPatternComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly logs = signal<UserActivityLogResponseDto[]>([]);
  readonly selectedLog = signal<UserActivityLogResponseDto | null>(null);
  readonly isLoading = signal(false);

  readonly dateFrom = signal<string>(new Date().toISOString().slice(0, 10));
  readonly dateTo = signal<string>(new Date().toISOString().slice(0, 10));

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    // Petición HTTP al Backend real (Cero Mocks)
  }

  openDrawer(log: UserActivityLogResponseDto): void {
    this.selectedLog.set(log);
  }

  closeDrawer(): void {
    this.selectedLog.set(null);
  }
}
```
