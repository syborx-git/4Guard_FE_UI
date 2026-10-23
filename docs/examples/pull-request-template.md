# 🛡️ Pull Request — 4GUARD WMS

> **Modulo / Feature:** `[Ej. HU-146 Reporte de Actividad por Usuario]`  
> **Tipo de Cambio:** `[ Feature | Fix | Refactor | Docs ]`

---

## 📝 Descripción del Cambio

[Describa brevemente qué resuelve este Pull Request, qué endpoints consume del Backend y qué experiencia visual otorga al usuario.]

---

## 🛠️ Checklist Obligatoria SDD (AI Reviewer Compliant)

Marque con `[x]` para confirmar que el código cumple con los estándares del proyecto antes de solicitar revisión:

- [ ] **1. Cero Mocks en BD (ADR-007):** El servicio HTTP consume la API real sin arreglos `MOCK_*` estáticos.
- [ ] **2. Componente Standalone (ADR-002):** El componente declara `standalone: true` sin NgModules legacy.
- [ ] **3. Angular Signals (ADR-006):** El estado local y derivado se administra mediante `signal()` y `computed()`.
- [ ] **4. Soporte Dark Mode (ADR-003):** El archivo `.css` implementa el bloque `:host-context(.theme-dark)`.
- [ ] **5. Encapsulamiento CSS (ADR-005):** Estilos encapsulados con variables `:host` y paleta Gold/Navy.
- [ ] **6. Toast Notifications:** Los errores HTTP invocan `ToastService.error()` con fallback limpio.
- [ ] **7. Guardia RBAC (ADR-004):** La ruta incluye `canActivate: [rbacGuard]` y `data: { module: '...' }`.
- [ ] **8. Contrato API DTO (ADR-008):** Tipado estricto con interfaces DTO (cero `any`) e ISO-8601 UTC.
- [ ] **9. Matriz SDD (module-status.md):** El módulo fue actualizado a `✅ Completo` en la documentación.
- [ ] **10. Script Linter Local:** Se ejecutó `npm run sdd:review` obteniendo **0 errores críticos**.

---

## 📸 Evidencia Visual (Screenshots / Grabación)

| Modo Claro (Theme Light) | Modo Oscuro (Theme Dark) |
|---|---|
| *(Pega aquí la captura)* | *(Pega aquí la captura)* |
