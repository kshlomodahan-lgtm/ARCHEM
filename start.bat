@echo off
setlocal
set NODE="C:\Program Files\nodejs\node.exe"
set BACKEND=C:\Users\Administrator\ARCHEM\backend
set FRONTEND=C:\Users\Administrator\ARCHEM\frontend
set NG=%FRONTEND%\node_modules\@angular\cli\bin\ng.js

title ARCHEM - Startup

echo [1/2] Backend on :3001...
start "ARCHEM Backend" cmd /k "cd /d %BACKEND% && %NODE% server.js"

timeout /t 3 /nobreak >nul

echo [2/2] Dev server on :4201...
start "ARCHEM Frontend" cmd /k "cd /d %FRONTEND% && %NODE% %NG% serve"

echo.
echo  Done.  http://localhost:4201
echo.
