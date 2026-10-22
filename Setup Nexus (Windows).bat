@echo off
rem Double-click to (re)run the one-time Nexus setup on Windows.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\setup.ps1"
pause
