@echo off
echo NEXUS 개발 모드 시작 (서버 + 웹 동시 실행)
start "NEXUS Server" cmd /k "cd /d %~dp0server && node server.js"
start "NEXUS Web Dev" cmd /k "cd /d %~dp0web && npx vite"
echo.
echo 서버: http://localhost:4000
echo 웹:   http://localhost:5173
