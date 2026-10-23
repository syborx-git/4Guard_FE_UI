# ADR-015: Motor Documental para Generación de Boletas de Recepción, Traspasos, Despachos Outbound, Check List F01 y Códigos Industriales (PDF & ZPL)

- **Estado:** Aceptado / Homologado
- **Fecha:** 2026-09-12 (Actualizado: 2026-09-17)
- **Autores:** Equipo 4GUARD WMS (Frontend, Backend & Calidad Documental)
- **Módulos Afectados:** `apps/admin-console`, `apps/rf-terminal`, `4guard_be`, `libs/shared-core`
- **ADRs Relacionados:** [ADR-018 (Check-Out Caseta y Formato F01)](./ADR-018-security-gate-checkout-and-f01-transport-checklist-homologation.md)

---

## 1. Contexto y Problema

Las operaciones logísticas y de auditoría patrimonial de 4GUARD WMS requieren emitir formatos oficiales estandarizados que cumplan rigurosamente con los lineamientos corporativos institucionales:
1. **Unificación y Homologación Visual Transversal:**
   - Boleta Oficial de Recepción de Mercancía (`PrintReceptionLayoutComponent`).
   - Boleta Oficial de Salida / Despacho de Mercancía (`PrintDispatchLayoutComponent`).
   - Comprobante Oficial de Cambio de Almacén / Traspaso (`PrintTransferLayoutComponent`).
   - Formato F01 de Inspección y Check List de Transporte (`PrintTransportChecklistLayoutComponent`).
2. **Requerimientos de Diseño Corporativo Físico (F01 / Pauta Institucional):**
   - **Dirección Oficial Institucional:** `Calle. Industria Automotriz sin número, Colonia el Coecillo, municipio de Toluca, Estado de México, C.P 50246.`
   - **Estandarización Tipográfica:** Todas las etiquetas, encabezados y valores en **MAYÚSCULAS** sostenidas.
   - **Títulos Limpios:** Eliminación de prefijos innecesarios ("Pauta de"), quedando: `RECEPCIÓN DE MERCANCÍA`, `SALIDA DE MERCANCÍA`, `COMPROBANTE DE CAMBIO DE ALMACÉN` y `FORMATO CHECK LIST DE TRANSPORTE`.
   - **Fechas y Horas Estándar:** Fechas en formato exacto `DD/MM/YYYY` y horas homologadas a 2 dígitos de segundos `HH:mm:ss`.
   - **Detalle de Tarimas Enriquecido:** Cada fila/UA en las tablas incluye su número de remisión/documento inicial (`NO. REMISIÓN` / `DOC. INICIAL`) y fecha de caducidad individual (`CADUCIDAD`).
   - **Garantía de Impresión en 1 Sola Hoja (Single Page Print):** Estructura CSS optimizada con márgenes compactos, paddings micrométricos y `page-break-inside: avoid` para que el documento encaje al 100% en 1 sola hoja Carta/A4.
   - **Firmas Institucionales:** Bloque de `ELABORÓ / CAPTURÓ` con el nombre dinámico del usuario en sesión activa, junto con la línea oficial de `FIRMA DE CONFORMIDAD / RECIBE`.

---

## 2. Decisión Tomada

Se adopta una **Arquitectura Híbrida de Generación y Emisión Documental Homologada**:

### 2.1 Generación de Documentos PDF y Vistas Imprimibles en Frontend (`apps/admin-console`, `PrintService`)
* **Tecnología:** Renderizado DOM nativo de alta resolución mediante `PrintService` (`window.print()` / `html2canvas` / `jsPDF`).
* **Estándar Visual Corporativo Homologado:**
  - **Encabezado Institucional:** Logotipo SVG `4GUARD`, nombre corporativo `4-GUARD WMS`, dirección fiscal unificada y fecha de emisión `DD/MM/YYYY`.
  - **Bloque de Metadatos:** Cuadrícula de 2 columnas con bordes nítidos de 1px/2px, etiquetas en negrita a la izquierda y valores en tipografía monoespaciada a la derecha.
  - **Tabla de UAs/Tarimas:** Desglose con `N. TARIMA`, `CÓDIGO TARIMA (UA)`, `NO. REMISIÓN`, `SKU`, `DESCRIPCIÓN`, `PROVEEDOR / CLIENTE`, `TIPO TARIMA`, `CADUCIDAD`, `CANT X TARIMA` y `OBSERVACIONES`.
  - **Fila de Totales:** Resumen en una sola línea con `TOTAL TARIMAS`, `TOTAL PIEZAS` y `SKUS DISTINTOS`.
  - **Bloque de Firmas y Auditoría:** Doble columna para responsable emisor (`CAPTURÓ: [USUARIO]`) y receptor (`FIRMA DE CONFORMIDAD`).

### 2.2 Impresión Industrial ZPL por Socket TCP Backend (`4guard_be`)
* **Tecnología:** Emisión directa desde el backend a través de **Sockets TCP Raw (Puerto 9100)** hacia las direcciones IP asignadas a las impresoras Zebra de andén.
* **Formato ZPL:** Plantillas estandarizadas a 203/300 dpi con códigos de barras Code 128 y QR bidimensional.

---

## 3. Consecuencias

### Positivas
- **Homogeneidad Total en Planta:** Todos los documentos emitidos (Recepción, Salida, Traspaso y Caseta) guardan una misma identidad corporativa y estructura visual.
- **Cero Desperdicio de Papel:** La optimización de espaciado garantiza que las boletas operativas se impriman en exactamente una página.
- **Trazabilidad a Nivel Tarima:** La inclusión de la remisión y caducidad por UA permite auditar la procedencia de cada pallet individualmente.

### Compromisos
- Se deben mantener las funciones de formateo `formatDateDMY` y `formatTimeString` activas en todos los componentes de impresión para evitar discrepancias de milisegundos o formatos ISO.

