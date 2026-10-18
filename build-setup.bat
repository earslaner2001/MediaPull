@echo off
setlocal EnableExtensions

set "MEDIAPULL_ROOT=%~dp0"
cd /d "%MEDIAPULL_ROOT%"

set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs;%APPDATA%\npm"

set "NODE_OPTIONS="

chcp 65001 >nul 2>&1

echo ============================================
echo  MediaPull - setup build
echo ============================================
echo.
echo Proje: %CD%
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
echo (dist kilitliyse build dist-build-* klasorune yazilir.)
call npm run build
if errorlevel 1 goto fail

echo.
echo Done. Output: "%MEDIAPULL_ROOT%dist" veya dist-build-* (dist kilitliyse)
echo.
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1
