@echo off
setlocal
title Backdrop Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install the LTS version from https://nodejs.org and run this again.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing components. This can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Backdrop Studio. Your browser will open shortly.
echo Keep this window open while you work. Close it to quit.
echo.
call npm run dev -- --open
pause
