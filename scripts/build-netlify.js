const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Detectar aplicación a compilar
// Por defecto: admin (para no afectar el sitio actual en producción/develop)
// Si APP_TARGET=rf o el nombre del sitio contiene 'rf' o 'tablet', compila la tablet
const envTarget = (process.env.APP_TARGET || '').toLowerCase();
const siteName = (process.env.SITE_NAME || '').toLowerCase();

const isRf = envTarget === 'rf' || envTarget === 'tablet' || siteName.includes('rf') || siteName.includes('tablet');
const target = isRf ? 'rf' : 'admin';

console.log(`=======================================================`);
console.log(`🚀 [Netlify Build] App seleccionada: ${target === 'rf' ? 'RF TERMINAL (TABLET)' : 'ADMIN CONSOLE (WEB)'}`);
console.log(`=======================================================`);

const command = target === 'rf' ? 'npm run build:rf:dev' : 'npm run build:admin:dev';
const sourceDir = path.resolve(__dirname, '..', target === 'rf' ? 'dist/rf-terminal/browser' : 'dist/admin-console/browser');
const targetDir = path.resolve(__dirname, '..', 'dist/publish');

console.log(`▶ Ejecutando comando de compilación: ${command}`);
execSync(command, { stdio: 'inherit' });

console.log(`📦 Copiando bundle desde: ${sourceDir}`);
console.log(`📂 Hacia directorio de publicación Netlify: ${targetDir}`);

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`✅ [Netlify Build] Compilación y empaquetado finalizados con éxito.`);
