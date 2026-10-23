# 4GUARD WMS — Estrategia de Testing

---

## Niveles de Testing

| Nivel | Herramienta | Cobertura objetivo |
|---|---|---|
| Unit Tests | Jasmine + Karma | Servicios, Guards, Pipes |
| Component Tests | Angular Testing Library | Componentes UI |
| E2E Tests | Playwright / Cypress | Flujos críticos |

---

## Flujos críticos (E2E)

1. **Login → Dashboard** — Autenticación completa
2. **Crear Transportista** — Formulario completo + validaciones
3. **Cambiar estado de Ubicación** — FSM transitions
4. **RBAC:** Usuario sin permiso no puede acceder a módulo protegido
5. **Dark/Light mode toggle** — Persistencia del tema

---

## Convenciones de Tests

```typescript
describe('CarrierManagementComponent', () => {
  it('should show KPI cards when carriers are loaded', () => {
    // arrange
    // act
    // assert
  });

  it('should filter carriers by status', () => {});
  it('should open detail panel on carrier selection', () => {});
  it('should validate RFC format', () => {});
  it('should show empty state when no results', () => {});
});
```

---

## IDs únicos para testing (accesibilidad)

Todos los elementos interactivos deben tener `id` descriptivos:

```html
<input id="carrier-search-input" />
<button id="carrier-create-btn">Nuevo</button>
<button id="carrier-save-btn">Guardar</button>
<select id="carrier-status-filter">...</select>
```

---

## Guards Testing

```typescript
describe('rbacGuard', () => {
  it('should allow ADMIN to access carriers module', () => {});
  it('should redirect OPERATOR to dashboard on admin module', () => {});
  it('should redirect unauthenticated user to login', () => {});
});
```
