@echo off
setlocal
cd /d "%~dp0"
if not defined PYTHON_EXE set "PYTHON_EXE=python"
"%PYTHON_EXE%" -c "import sys,struct; assert sys.version_info[:2]==(3,13) and struct.calcsize('P')==8, 'Use Python 3.13 x64'"
if errorlevel 1 goto fail
if not exist ".venv\Scripts\python.exe" "%PYTHON_EXE%" -m venv .venv
if errorlevel 1 goto fail
if /i "%~1"=="offline" goto offline
rem PIP_INDEX_URL and pip configuration are respected; no public mirror is selected here.
".venv\Scripts\python.exe" -m pip install -r requirements-lock.txt
if errorlevel 1 goto fail
goto done
:offline
set "WHEEL_DIR=%~2"
if not defined WHEEL_DIR set "WHEEL_DIR=%~dp0wheelhouse"
".venv\Scripts\python.exe" -m pip install --no-index --find-links "%WHEEL_DIR%" -r requirements-lock.txt
if errorlevel 1 goto fail
:done
echo Installation complete. Run Start_Oligo_Toolkit.bat.
exit /b 0
:fail
echo Installation failed. See INSTALL_CN.md and contact IT.
pause
exit /b 1
