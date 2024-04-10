@echo off

echo Installing dependencies...
call npm install --silent

echo.
echo Running application...
node index.js
pause