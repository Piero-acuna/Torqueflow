@echo off
cd /d "%~dp0"
if not exist .env.local (
  echo Primero copia .env.example como .env.local y completa las credenciales.
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm run bootstrap:owner
pause
