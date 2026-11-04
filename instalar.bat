@echo off
cd /d "%~dp0"
title Instalador Maestro - Venvidrio Calidad
color 0A

echo =======================================================
echo    INSTALADOR DEL SISTEMA - VENVIDRIO CALIDAD
echo =======================================================
echo.

if not exist "backend" (
    echo [ERROR] No se encontro la carpeta "backend".
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] No se encontro la carpeta "frontend".
    pause
    exit /b 1
)

echo Verificando Python...
python --version
if %errorlevel% neq 0 (
    echo [ERROR CRITICO] Python no esta instalado.
    pause
    exit /b 1
)

echo.
echo [INFO] Python detectado correctamente.

:: Extraer version (ej. 3.8.8)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PY_FULL_VER=%%i

:: Extraer solo los dos primeros numeros (ej. 3.8)
for /f "tokens=1,2 delims=." %%a in ("%PY_FULL_VER%") do set PY_MINOR=%%a.%%b

echo [INFO] Version corta detectada: %PY_MINOR%

set PAQ_DIR=
if "%PY_MINOR%"=="3.8"  set PAQ_DIR=paquetes_offline\3.8
if "%PY_MINOR%"=="3.9"  set PAQ_DIR=paquetes_offline\3.9
if "%PY_MINOR%"=="3.10" set PAQ_DIR=paquetes_offline\3.10
if "%PY_MINOR%"=="3.11" set PAQ_DIR=paquetes_offline\3.11
if "%PY_MINOR%"=="3.12" set PAQ_DIR=paquetes_offline\3.12
if "%PY_MINOR%"=="3.13" set PAQ_DIR=paquetes_offline\3.13

if "%PAQ_DIR%"=="" (
    echo [ERROR] Este instalador no tiene paquetes para Python %PY_MINOR%.
    pause
    exit /b 1
)
echo [OK] Usando paquetes: %PAQ_DIR%
echo.

echo Entrando a la carpeta backend...
cd backend

if not exist "venv" (
    echo Creando entorno virtual...
    python -m venv venv
) else (
    echo El entorno virtual ya existe.
)

echo Activando entorno e instalando librerias...
call venv\Scripts\activate.bat

if not exist "%PAQ_DIR%" (
    echo [ERROR] No existe la carpeta backend\%PAQ_DIR%
    pause
    exit /b 1
)

echo.
echo =======================================================
echo    INSTALANDO PAQUETES (esto puede tardar unos minutos)
echo =======================================================
echo.

pip install --no-index --find-links="./%PAQ_DIR%" -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo la instalacion de las librerias de Python.
    echo Revisa si hay un error en rojo arriba.
    pause
    exit /b 1
)

echo.
echo [OK] Librerias del backend instaladas correctamente.
echo.

cd ..

echo Creando accesos directos...
echo @echo off > Iniciar_Backend.bat
echo cd /d "%%~dp0backend" >> Iniciar_Backend.bat
echo call venv\Scripts\activate.bat >> Iniciar_Backend.bat
echo uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload >> Iniciar_Backend.bat
echo pause >> Iniciar_Backend.bat

echo @echo off > Iniciar_Frontend.bat
echo cd /d "%%~dp0frontend" >> Iniciar_Frontend.bat
echo python -m http.server 5500 >> Iniciar_Frontend.bat
echo pause >> Iniciar_Frontend.bat

echo.
echo =======================================================
echo    INSTALACION COMPLETADA CON EXITO
echo =======================================================
echo.
pause