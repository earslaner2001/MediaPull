@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs;%APPDATA%\npm"

chcp 65001 >nul 2>&1

echo ============================================
echo  MediaPull - lansman sitesi
echo ============================================
echo.
echo Tarayici: http://localhost:3000
echo Durdurmak icin bu pencerede Ctrl+C
echo.

where npx >nul 2>&1
if errorlevel 1 (
  echo npx bulunamadi. Python ile deneniyor...
  where python >nul 2>&1
  if errorlevel 1 (
    echo HATA: Node.js veya Python gerekli.
    pause
    exit /b 1
  )
  start "" "http://localhost:8000"
  python -m http.server 8000
  exit /b 0
)

start "" "http://localhost:3000"
npx --yes serve . -l 3000
