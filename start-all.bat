@echo off
echo ==========================================
echo Starting Locals Services (Windows)
echo ==========================================

:: Check if bun is installed
where bun >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [Backend] Bun detected. Starting Backend using Bun...
    start "Locals Backend (Bun)" cmd /k "cd backend && bun run dev"
) else (
    echo [Backend] Bun not detected. Starting Backend using Node npx tsx...
    start "Locals Backend (Node)" cmd /k "cd backend && npm run dev:node"
)

echo [Admin] Starting Admin Dashboard (port 3001)...
start "Locals Admin Dashboard" cmd /k "cd admin && npm run dev"

echo [Frontend] Starting Expo Frontend...
start "Locals Expo Frontend" cmd /k "cd frontend && npm start"

echo ==========================================
echo All services have been launched in separate windows!
echo - Backend: http://localhost:3000
echo - Admin: http://localhost:3001
echo - Frontend: Scan the QR code in the Expo window with your phone.
echo ==========================================
pause
