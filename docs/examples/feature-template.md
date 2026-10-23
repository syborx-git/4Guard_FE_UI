# 4GUARD WMS — Template para Nueva Feature (SDD)

> Copia este template cuando vayas a implementar una nueva pantalla de gestión.
> Borra las secciones que no apliquen.

---

## Spec: [Nombre de la Feature]

**Historia de Usuario:** HU-XXX  
**Módulo:** `feature-name`  
**Ruta:** `/feature-route`  
**RBAC:** `module: 'feature-name'`

---

## Propósito

> Una oración describiendo qué hace esta pantalla y quién la usa.

---

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: [Descripción del header]                        │
├──────────────────────────────────────────────────────────┤
│  KPI CARDS (N columnas)                                   │
│  [KPI 1] [KPI 2] [KPI 3] [KPI 4]                        │
├──────────────┬───────────────────────────────────────────┤
│  [Panel Izq] │  [Panel Der]                              │
│  (XXXpx fix) │  (flex: 1)                                │
└──────────────┴───────────────────────────────────────────┘
```

---

## Entidades / Modelos

```typescript
interface FeatureEntity {
  id: number;
  // ... campos
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}
```

---

## API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/feature` | Listar todos |
| POST | `/api/feature` | Crear nuevo |
| PUT | `/api/feature/{id}` | Actualizar |
| PATCH | `/api/feature/{id}/status` | Cambiar estado FSM |
| DELETE | `/api/feature/{id}` | Eliminar |

---

## KPI Cards

| KPI | Ícono | Color |
|---|---|---|
| Total | `inventory` | Navy |
| Activos | `check_circle` | Success |
| [Estado 3] | `[icon]` | Warning |
| [Estado 4] | `[icon]` | Danger |

---

## Estados FSM

| Estado | Label | Color |
|---|---|---|
| `active` | Activo | Success |
| `inactive` | Inactivo | Muted |
| `[estado]` | [Label] | [Color] |

---

## Formulario — Campos

### Sección 1: [Nombre]
- Campo 1: texto, requerido
- Campo 2: select, requerido
- Campo 3: text-area, opcional

### Sección 2: [Nombre]
- Campo 4: número
- Campo 5: date

---

## Reglas de Validación

- Campo X: requerido, máximo 100 caracteres
- RFC: formato `[A-Z]{3,4}[0-9]{6}[A-Z0-9]{3}`
- Email: formato estándar

---

## Comportamiento

- [ ] Buscar en tiempo real (debounce 300ms)
- [ ] Filtrar por estado
- [ ] Selección abre detalle en panel derecho
- [ ] Formulario valida antes de guardar
- [ ] Confirmación antes de eliminar
- [ ] Toast de éxito/error después de operaciones
- [ ] Skeleton durante carga inicial

---

## Checklist de Implementación

```markdown
- [ ] Componente standalone creado
- [ ] Variables locales en :host
- [ ] Dark mode en :host-context(.theme-dark)
- [ ] Header con icon + eyebrow + title + subtitle
- [ ] KPI cards (4 columnas, con skeleton)
- [ ] Split view: lista + formulario
- [ ] Search input con debounce
- [ ] Filters (selects de estado, tipo)
- [ ] Lista con item pattern (avatar + name + meta + badge)
- [ ] Empty state lista
- [ ] Empty state detalle
- [ ] Skeleton en lista
- [ ] Form sections con legend en gold
- [ ] Inputs con focus gold + error state
- [ ] Status badges semánticos
- [ ] Dialog de confirmación para eliminación
- [ ] Sticky form header y footer
- [ ] Form actions: [Status Change] + [Cancel] + [Save]
- [ ] Toast de éxito y error
- [ ] Dark mode inputs adaptados
- [ ] Responsive: 1200px, 1050px, 720px
- [ ] Ruta con rbacGuard y lazy loading
- [ ] Route title: '4GUARD WMS — [Nombre]'
- [ ] Servicio HTTP para todos los endpoints
- [ ] Modelo TypeScript de la entidad
```

---

## Notas de Diseño

> Espacio para notas específicas de esta feature que no caen en los patrones generales.
