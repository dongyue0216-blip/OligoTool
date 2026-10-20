@echo off
setlocal
cd /d "%~dp0"
if not defined PYTHON_EXE set "PYTHON_EXE=python"
"%PYTHON_EXE%" -m pip download --only-binary=:all: --platform win_amd64 --python-version 313 --implementation cp --abi cp313 --dest wheelhouse -r requirements-lock.txt
if errorlevel 1 exit /b 1
echo Transfer the complete wheelhouse with this package to the target VM.
