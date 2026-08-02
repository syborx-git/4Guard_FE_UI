# 4GUARD WMS — Glosario de Negocio

---

## Entidades del Dominio

| Término | Descripción |
|---|---|
| **Almacén (Warehouse)** | Instalación física gestionada por el WMS |
| **Organización** | Empresa cliente del WMS (multi-tenant) |
| **Sucursal (Branch)** | Ubicación física de una organización |
| **Ubicación (Location)** | Posición específica dentro del almacén (ej: A-01-01-01) |
| **SKU** | Stock Keeping Unit — identificador único de producto |
| **Transportista (Carrier)** | Empresa o persona que realiza transporte de mercancía |
| **Proveedor (Supplier)** | Empresa que suministra mercancía al almacén |
| **Cliente (Client)** | Empresa destinataria de la mercancía almacenada |
| **Sección (Section)** | Área lógica del almacén (ej: Refrigeración, Seco, Peligrosos) |

---

## Jerarquía de Ubicaciones

```
Almacén
└── Zona (Zone)          ← Ej: "ZONA A", "REFRIGERACIÓN"
    └── Pasillo (Aisle)  ← Ej: "A01", "B02"
        └── Bay          ← Ej: "01", "02"
            └── Ubicación ← Ej: "A-01-01-01" (Topología Cromática)
```

---

## Estados FSM de Ubicaciones

| Código | Estado | Color UI |
|---|---|---|
| `active` | Disponible para almacenaje | Verde |
| `occupied` | Contiene mercancía | Azul |
| `blocked` | Bloqueada (no usar) | Rojo |
| `maintenance` | En mantenimiento | Naranja |
| `inactive` | Dada de baja | Gris |

---

## Estados FSM de Transportistas

| Estado | Descripción |
|---|---|
| `active` | Operando normalmente |
| `suspended` | Suspendido temporalmente |
| `inactive` | Dado de baja del sistema |

---

## Tipos de Transportista

| Tipo | Descripción |
|---|---|
| `external` | Empresa de logística externa |
| `client` | Transportista propio del cliente |
| `own` | Flota propia del almacén |
| `3pl` | Proveedor logístico tercero (Third Party Logistics) |
| `parcel` | Mensajería/paquetería |

---

## Historial de Usuarios (HU = Historia de Usuario)

| HU | Módulo | Descripción |
|---|---|---|
| HU-010 | Auth | Lockout por intentos fallidos |
| HU-011 | Admin | Sesiones activas y cierre remoto |
| HU-125 | Admin | Catálogo de Proveedores |
| HU-127 | Layout | Gestión de Ubicaciones Físicas |
| HU-128 | Carriers | Gestión de Transportistas |
| HU-131 | Business Rules | Motor de Reglas de Negocio |
| HU-134 | Alerts | Configuración de Alertas |
| HU-138 | Performance | Monitoreo de Rendimiento |
| HU-139 | License | Licencias del WMS |
| HU-140 | Shifts | Turnos y Horarios |
| HU-146 | Activity | Actividad por Usuario |
| HU-148 | Currency | Divisas y Tipos de Cambio |

---

## Epics

| Epic | Descripción |
|---|---|
| **Epic 1** | Configuración inicial (usuarios, roles, org, sucursales) |
| **Epic 2** | Recepción y Control de Calidad |
| **Epic 3** | Inventario y Almacenaje |
| **Epic 4** | Despacho y Transporte |
| **Epic 5** | Administración y Monitoreo |
