@echo off
title Distillery Capital Proposal Generator
echo.
echo  ============================================
echo   Distillery Capital Proposal Generator
echo  ============================================
echo.

:: Check Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download from: https://nodejs.org  (choose the LTS version)
    echo.
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist node_modules (
    echo  Installing dependencies for the first time...
    call npm install
    echo.
)

:: Start server and open browser
echo  Starting server...
start "" http://localhost:3000
node server.js
pause
