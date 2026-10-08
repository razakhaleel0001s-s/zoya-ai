@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ================================================
echo   Zoya AI Voice Assistant - Windows Installer
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js LTS, restart the PC, and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not available.
  echo Reinstall Node.js LTS, restart the PC, and try again.
  pause
  exit /b 1
)

echo [1/4] Cleaning old build folders...
if exist dist rmdir /s /q dist
if exist release rmdir /s /q release

echo.
echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo [3/4] Building the existing Zoya app...
call npm run build
if errorlevel 1 goto :error

echo.
echo [4/4] Creating Windows installer...
call npx electron-builder --win nsis --config electron-builder.yml
if errorlevel 1 goto :error

echo.
echo ================================================
echo   BUILD SUCCESSFUL!
echo ================================================
echo.
echo Installer is inside:
echo %CD%\release
explorer "%CD%\release"
pause
exit /b 0

:error
echo.
echo ================================================
echo   BUILD FAILED
echo ================================================
echo Read the error above and take a screenshot.
pause
exit /b 1
