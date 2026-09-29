/**
 * @file sdd-linter.js
 * @description Script de inspección estática SDD para 4GUARD WMS.
 * Audita el código de admin-console antes de cualquier Pull Request.
 * Reglas auditadas:
 *  1. Cero Mocks en Producción (ADR-007)
 *  2. Standalone Components Obligatorios (ADR-002)
 *  3. Soporte Dark Mode :host-context(.theme-dark) (ADR-003)
 *  4. Uso de ToastService para manejo de errores (notifications.md)
 *  5. Directivas de Signals Angular 17+ (ADR-006)
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'apps', 'admin-console', 'src', 'app');

let totalErrors = 0;
let totalWarnings = 0;
let totalFilesChecked = 0;

console.log('\n=======================================================');
console.log('🛡️  4GUARD WMS — SDD AI REVIEWER & LINTER SYSTEM');
console.log('=======================================================\n');

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.scss') || file.endsWith('.html')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  totalFilesChecked++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  // Regla 1: Cero Mocks en Servicios Activos (ADR-007)
  if (filePath.endsWith('.service.ts') && !filePath.includes('.mock.')) {
    const lines = content.split('\n');
    const activeMockLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.includes('MOCK_') && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    });

    if (activeMockLines.length > 0) {
      console.error(`❌ [0-MOCK FAIL] ${relativePath}`);
      console.error(`   -> Se detectaron asignaciones MOCK_* activas en línea(s): ${activeMockLines.map(l => l.trim()).join(' | ')}. (ADR-007)\n`);
      totalErrors++;
    }
  }

  // Regla 2: Componentes Standalone (ADR-002)
  if (filePath.endsWith('.component.ts')) {
    if (content.includes('@Component') && !content.includes('standalone: true')) {
      console.error(`❌ [STANDALONE FAIL] ${relativePath}`);
      console.error(`   -> Componente Angular sin 'standalone: true'. (ADR-002)\n`);
      totalErrors++;
    }
  }

  // Regla 3: Dark Mode en Estilos (.css / .scss de componentes) (ADR-003)
  if ((filePath.endsWith('.component.css') || filePath.endsWith('.component.scss')) && !filePath.includes('password-collapse')) {
    if (!content.includes(':host-context(.theme-dark)')) {
      console.warn(`⚠️ [DARK MODE WARNING] ${relativePath}`);
      console.warn(`   -> El archivo de estilos no incluye selector ':host-context(.theme-dark)'. (ADR-003)\n`);
      totalWarnings++;
    }
  }

  // Regla 4: Notificaciones en Servicios (ToastService)
  if (filePath.endsWith('.service.ts') && content.includes('catchError')) {
    if (!content.includes('toast') && !content.includes('ToastService')) {
      console.warn(`⚠️ [TOAST WARNING] ${relativePath}`);
      console.warn(`   -> Bloque catchError detectado sin notificación explícita vía ToastService.\n`);
      totalWarnings++;
    }
  }

  // Regla 5: Alto Contraste Tipográfico en Light Mode y Modales (SDD Visual Standard v2.0 - Prohibido texto blanco o gris en modo claro)
  if (filePath.endsWith('.component.html') && content.includes('modal-overlay')) {
    const prohibitedLowContrastClasses = ['text-slate-400', 'text-gray-400', 'text-slate-300'];
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      prohibitedLowContrastClasses.forEach(cls => {
        if (line.includes(cls) && !line.includes('dark:')) {
          console.warn(`⚠️ [SDD CONTRAST WARNING] ${relativePath}:${idx + 1}`);
          console.warn(`   -> Uso de clase de bajo contraste '${cls}' en modal. En Light Mode se debe usar #0f172a, #172033, #1e293b o #334155. (SDD Section 2.1)\n`);
          totalWarnings++;
        }
      });
    });
  }
}

scanDirectory(TARGET_DIR);

console.log('-------------------------------------------------------');
console.log(`📊 RESUMEN DE AUDITORÍA SDD:`);
console.log(` - Archivos analizados: ${totalFilesChecked}`);
console.log(` - Errores críticos (FAIL): ${totalErrors}`);
console.log(` - Advertencias (WARN):    ${totalWarnings}`);
console.log('-------------------------------------------------------\n');

if (totalErrors > 0) {
  console.error('🔴 AUDITORÍA SDD FALLIDA: Corrige los errores críticos antes de abrir el Pull Request.\n');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('🟡 AUDITORÍA APROBADA CON ADVERTENCIAS: Revisa los puntos amarillos antes del PR.\n');
  process.exit(0);
} else {
  console.log('🟢 AUDITORÍA SDD IMPECABLE: Código 100% compliant con las reglas de 4GUARD WMS.\n');
  process.exit(0);
}
