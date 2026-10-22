@echo off
rem Double-click to run Nexus on Windows (first run installs what it needs).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\start.ps1"
if errorlevel 1 pause
