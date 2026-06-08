@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs;%APPDATA%\npm"
set "NODE_OPTIONS="

chcp 65001 >nul 2>&1

echo ============================================
echo  MediaPull - GELISTIRICI MODU (hot reload)
echo ============================================
echo.
echo Herhangi bir .js / .html / .css degisince
echo uygulama otomatik yeniden baslar.
echo Durdurmak icin bu pencerede Ctrl+C
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo HATA: npm bulunamadi. Node.js LTS kurulu olmali.
  goto fail
)

if not exist "node_modules\" (
  echo node_modules yok, npm install calistiriliyor...
  call npm install
  if errorlevel 1 goto fail
  echo.
)

call npm run dev
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
echo Calistirma basarisiz.
pause
exit /b 1
