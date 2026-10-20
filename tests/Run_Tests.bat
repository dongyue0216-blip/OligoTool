@echo off
setlocal
cd /d "%~dp0.."
if not exist ".venv\Scripts\python.exe" (
 echo Run install_dependencies.bat first.
 pause
 exit /b 1
)
if not exist "tests\reports" mkdir "tests\reports"
".venv\Scripts\python.exe" tests\run_all_tests.py > tests\reports\LATEST_TEST_RESULTS.txt 2>&1
set "TEST_EXIT=%errorlevel%"
if "%TEST_EXIT%"=="0" (echo All tests passed.) else (echo Some tests failed.)
echo See tests\reports\LATEST_TEST_RESULTS.txt
pause
exit /b %TEST_EXIT%
