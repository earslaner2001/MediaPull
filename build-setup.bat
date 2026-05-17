@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Node bazen Explorer'dan calistirilinca PATH'te olmaz; bilinen dizinler eklenir
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs;%APPDATA%\npm"

chcp 65001 >nul 2>&1

echo ============================================
echo  MediaPull - setup build
echo ============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Install Node.js LTS and retry.
  goto fail
)

echo [1/2] npm install ...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/2] electron-builder ...
call npm run build
if errorlevel 1 goto fail

echo.
echo Done. Output folder: "%~dp0dist"
echo.
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1
