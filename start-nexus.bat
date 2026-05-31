@echo off
set PM2_CMD=C:\Users\Lenovo\AppData\Roaming\npm\pm2.cmd

REM PM2 nexus 프로세스가 이미 실행 중이면 재시작, 아니면 신규 시작
"%PM2_CMD%" describe nexus >nul 2>&1
if %errorlevel% == 0 (
  "%PM2_CMD%" restart nexus
) else (
  cd /d C:\E-Messenger\server
  "%PM2_CMD%" start server.js --name nexus --restart-delay 3000
)
"%PM2_CMD%" save --force >nul 2>&1
