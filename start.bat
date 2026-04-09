@echo off
echo ==============================================
echo       STARTING URBAN BLIND PROJECT
echo ==============================================
echo.

echo Starting Backend (FastAPI)...
start "Backend" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend (Next.js)...
start "Frontend" cmd /k "cd frontend && npx next dev -H 0.0.0.0 -p 3000"

echo.
echo Servers are starting in separate windows!
echo Backend:   http://localhost:8000
echo Frontend:  http://localhost:3000
echo.
echo Close the terminal windows to shut them down.
echo ==============================================
pause
