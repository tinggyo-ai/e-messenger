@echo off
schtasks /create /tn "NEXUS-Messenger-Autostart" /tr "C:\E-Messenger\start-nexus.bat" /sc ONLOGON /rl HIGHEST /f
echo Exit code: %errorlevel%
