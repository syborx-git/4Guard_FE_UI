# 4GUARD WMS — Sistema de Notificaciones

> Servicio: `ToastService` — `apps/admin-console/src/app/core/services/toast.service.ts`

---

## Resumen

El sistema de notificaciones usa `ToastService` con Angular Signals.  
Ya está configurado globalmente — el `ToastContainerComponent` se renderiza desde `AppComponent`.

---

## Cómo usar el ToastService

```typescript
// En cualquier componente
private toast = inject(ToastService);

// Éxito (verde) — 3000ms por defecto
this.toast.success('Transportista creado con éxito');

// Error (rojo)
this.toast.error('No se pudo eliminar. Tiene inventario activo.');

// Advertencia (amarillo)
this.toast.warning('El RFC ya está registrado para otro transportista.');

// Informativo (azul)
this.toast.info('Cargando datos del servidor...');

// Duración personalizada
this.toast.success('Guardado', 5000); // 5 segundos
```

---

## Cuándo usar cada tipo

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| `success` | POST/PUT/DELETE exitosos | "Sucursal creada con éxito" |
| `error` | Error HTTP 400/403/500, fallo de operación | "Error al guardar los datos" |
| `warning` | Conflicto, RFC duplicado, FSM bloqueado | "Este código ya existe" |
| `info` | Operaciones en progreso, info contextual | "Procesando..." |

---

## Mensajes estándar por operación

Usar exactamente estos textos para consistencia en toda la app:

```typescript
// CREATE
toast.success('${Entidad} creado con éxito');
toast.success('${Entidad} creada con éxito');   // femenino

// UPDATE
toast.success('${Entidad} actualizado con éxito');

// DELETE
toast.success('${Entidad} eliminado con éxito');

// STATUS CHANGE
toast.success(`Estado cambiado a ${newStatus} correctamente`);

// ERROR GENÉRICO
toast.error(err.error?.message ?? 'Error al procesar la solicitud');

// VALIDATION (409 conflict)
toast.warning(err.error?.message ?? 'El registro ya existe');
```

---

## Interfaz Toast

```typescript
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;      // auto-generado: 'toast-{timestamp}-{random}'
  type: ToastType;
  message: string;
  duration: number; // ms antes del auto-dismiss
}
```

---

## Duración recomendada

| Tipo | Duración default | Recomendación para mensajes largos |
|---|---|---|
| `success` | 3000ms | 3000ms |
| `error` | 3000ms | 4000-5000ms para errores complejos |
| `warning` | 3000ms | 4000ms |
| `info` | 3000ms | 3000ms |

---

## NO usar

```typescript
// ❌ Nunca usar alert() nativo del navegador
alert('Error al guardar');

// ❌ Nunca usar console.log para mensajes al usuario
console.log('Guardado correctamente');

// ❌ No crear notificaciones ni banners de éxito/error ad-hoc en los templates HTML
<div *ngIf="saveError">{{ saveError }}</div>
<div class="banner-success"><span class="material-symbols-outlined">check_circle</span> Turno actualizado</div>
// ← Toda confirmación de escritura o error debe transmitirse EXCLUSIVAMENTE mediante ToastService
```

---

## Convención: Toast vs Error Signal

| Situación | Usar |
|---|---|
| Operación de escritura completada (éxito o fallo) | `ToastService` |
| Error al cargar la lista inicial | `this.error.set(message)` → mostrar en pantalla vacía |
| Error al cargar el detalle de un item | `this.error.set(message)` + toast.error() |
| Error 401 (sesión expirada) | Automático por interceptor |
