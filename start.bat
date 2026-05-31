@echo off
echo Starting E-Messenger server...
cd /d %~dp0server
node server.js
