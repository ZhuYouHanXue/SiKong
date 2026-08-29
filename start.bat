@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [sikong] 未检测到 Node.js，请先安装 Node.js 18 或更高版本后重试。
  pause
  exit /b 1
)

node "scripts\start.mjs" %*
if errorlevel 1 pause

endlocal
