@echo off
chcp 65001 >nul
title 4GUARD WMS - Lanzador del Sistema Completo
color 0B
echo ==============================================================================
echo              🚀 INICIANDO ECOSISTEMA 4GUARD WMS (PC + TABLET + CELULAR)
echo ==============================================================================
echo.
cd /d "c:\Users\Christian Duran\Desktop\4GUARD\Workspace\4Guard_FE_UI"

echo [1/3] Iniciando Consola Administrativa / Caseta (Puerto 4200)...
start "4GUARD - Admin Console (4200)" cmd /k "npm run start:admin:dev"

echo [2/3] Iniciando Terminal RF Montacarguista / Tablet (Puerto 4201 SSL)...
start "4GUARD - Terminal RF Tablet (4201)" cmd /k "npm run start:rf:dev:ssl"

echo [3/3] Iniciando Tunel Ngrok Oficial para Tablet y QR Caseta...
start "4GUARD - Tunel Ngrok (faster-treadmill-oppose)" cmd /k "ngrok http --domain=faster-treadmill-oppose.ngrok-free.dev https://localhost:4201"

echo.
echo ==============================================================================
echo    ✅ VENTANAS LANZADAS CORRECTAMENTE
echo.
echo    🖥️  En tu PC abre Chrome:
echo       -> http://localhost:4200/warehouse-movements/receiving
echo       -> http://localhost:4200/security
echo.
echo    📱 En la Tablet:
echo       -> https://faster-treadmill-oppose.ngrok-free.dev/receiving
echo.
echo    📲 En el Celular (Chofer):
echo       -> Escanear el QR de la Caseta (abre directo el registro)
echo.
echo    ⚠️  IMPORTANTE: No cierres las 3 ventanas negras mientras estés probando.
echo ==============================================================================
echo.
pause

