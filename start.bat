@echo off
echo NEXUS 메신저 서버 시작 중...
cd /d %~dp0server
node server.js
