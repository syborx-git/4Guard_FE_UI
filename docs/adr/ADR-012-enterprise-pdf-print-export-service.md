# ADR-012: Arquitectura Unificada de Generación, Descarga e Impresión de Comprobantes Oficiales PDF

- **Estado:** ✅ Aceptado
- **Fecha:** 2026-09-02
- **Autores:** Equipo 4GUARD WMS (Frontend & AI Engineering)
- **Módulos Afectados:** `apps/admin-console/src/app/core/services/print.service.ts`, `apps/admin-console/src/app/features/warehouse-movements`, Catálogos, Calidad y Módulos de Operación WMS.

---

## 1. Contexto y Problema

En las operaciones logísticas y de almacén de **4GUARD WMS**, la emisión de comprobantes oficiales (Hojas de Recepción, Hojas de Cancelación, Traspasos de Almacén, Despachos Outbound, Dictámenes de Calidad) requiere fidelidad documental absoluta.

Los enfoques convencionales basados en `window.print()` directo sobre la SPA provocaban los siguientes problemas críticos:
1. **Fuga de Elementos de la SPA:** El diálogo de impresión capturaba barras de navegación, modales superpuestos, cards de métricas y la línea de tiempo de auditoría de fondo, generando 2 o 3 páginas fantasma innecesarias.
2. **Textos y Metadatos Sobrantes del Navegador:** Los navegadores Chromium/WebKit estampaban automáticamente en las cuatro esquinas del papel la fecha/hora, título interno, URL (`localhost:4200/...`) y paginador (`1/1`).
3. **Falta de Nombres de Archivo Automáticos en Guardado PDF:** Al imprimir hacia la impresora virtual de Windows (*Microsoft Print to PDF*), el cuadro de diálogo de Windows no recibía el nombre sugerido del documento, obligando al usuario a escribir manualmente el folio.
4. **Falta de Responsividad en la Vista Previa:** El modal de vista previa no guardaba proporciones de hoja Carta (Letter), desbordando la pantalla en resolución estándar (100% zoom) y forzando a los supervisores a disminuir el zoom o hacer scroll vertical para ver las firmas.

---

## 2. Opciones Evaluadas

| Opción | Ventajas | Desventajas | Decisión |
|---|---|---|---|
| **A. `window.print()` directo con CSS `@media print` únicamente** | Cero dependencias adicionales. | Imposible controlar nombres de archivo descargados; riesgo continuo de filtración de elementos DOM de la SPA; diálogo dependiente del SO. | ❌ Descartada |
| **B. Generación de PDF en Backend (API / Chromium Headless en Servidor)** | Control total de PDF a nivel binario. | Mayor latencia por llamada HTTP, sobrecarga de memoria en el servidor backend para miles de consultas concurrentes y falta de preview instantáneo interactivo en el cliente. | ❌ Descartada para previews transaccionales |
| **C. Servicio Cliente Híbrido (`PrintService` con `jsPDF` + `html2canvas` + Aislamiento en `iframe`)** | ✅ Descarga directa en 1 clic del PDF con nombre exacto (`${folio}.pdf`), ✅ Impresión física limpia en `iframe` aislado, ✅ Supresión de cabeceras nativas con `@page { margin: 0 }`, ✅ Cero carga en backend. | Añade librerías cliente (`jspdf`, `html2canvas`). | **✅ SELECCIONADA** |

---

## 3. Decisión Tomada

Se aprueba el estándar **Enterprise PDF Print & Export Architecture** implementado a través del servicio singleton [`PrintService`](file:///c:/Users/lenovo/Documents/ProyectosSyborX/4Guard/4Guard_FE_UI/apps/admin-console/src/app/core/services/print.service.ts) y los componentes layout de impresión dedicados.

### Principios Fundamentales del Estándar:

1. **Doble Capacidad: Descarga Directa 1-Clic + Impresión Física:**
   - **`downloadPdf(target, filename)`**: Captura el nodo DOM en alta resolución (2x DPI vía `html2canvas`) y lo empaqueta con `jsPDF` disparando la descarga inmediata del archivo `${folio}.pdf` en la carpeta de descargas sin abrir ventanas del sistema operativo.
   - **`printElement(target, documentTitle)`**: Crea un `<iframe>` invisible temporal, inyecta el HTML limpio junto con estilos exactos (`-webkit-print-color-adjust: exact`) y ejecuta la impresión física sin interferencia de la SPA.

2. **Supresión Absoluta de Cabeceras y Pies de Navegador:**
   - Regla CSS obligatoria:
     ```css
     @page {
       size: letter portrait;
       margin: 0 !important; /* Elimina URL, fecha, título y paginación nativa */
     }
     body {
       padding: 12mm 15mm !important; /* Margen real perimetral del documento */
     }
     ```

3. **Proporción de Hoja Real y Responsividad en Pantalla:**
   - Los modales de vista previa deben limitar su contenedor a `max-w-2xl` (672px) emulando la proporción vertical de una hoja tamaño Carta.
   - La cabecera del modal debe ser fija (*sticky / flex-shrink-0*) con contraste nítido y botones de acción accesibles.
   - El documento debe ser compacto (`text-[10px] - text-[11px]`, espaciados `p-2.5 - p-4`, tablas con padding `py-1 px-2`) para que al **100% de zoom** en cualquier pantalla de laptop o monitor se aprecie el documento completo (incluyendo firmas) sin scroll forzado.

---

## 4. Consecuencias

### Positivas
- **Descarga Inmediata y Automatizada:** Los usuarios obtienen el PDF con el nombre exacto de la entidad (ej. `26510.pdf`, `TR-9942.pdf`) con un solo clic.
- **Documentos Limpios y Profesionales:** 1 sola página exacta, sin páginas en blanco, sin fondos de la SPA y sin URLs o fechas de localhost en los bordes.
- **Visualización Ergonomica:** Supervisores y operadores ven el documento íntegro en pantalla al 100% de zoom.
- **Replicabilidad Total:** Estándar desacoplado listo para aplicarse en cualquier módulo de 4GUARD WMS.

### Compromisos / Restricciones
- Las imágenes y logotipos corporativos deben utilizar rutas absolutas válidas o assets vectoriales SVG embebidos para asegurar el renderizado correcto tanto en pantalla como en el canvas PDF.
