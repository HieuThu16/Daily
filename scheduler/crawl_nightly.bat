@echo off
setlocal EnableExtensions
pushd "%~dp0.." || exit /b 1
set "PROJECT_DIR=%CD%"

set "LOG_DIR=%PROJECT_DIR%\scheduler\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

rem Use an invariant date format; %%DATE%% changes with the Windows locale.
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set "TODAY=%%I"
set FLAG_FILE=%LOG_DIR%\done_%TODAY%.flag
set LOG_FILE=%LOG_DIR%\crawl_%TODAY%.log

echo ============================================= >> "%LOG_FILE%"
echo [%date% %time%] BAT DAU CRAWL >> "%LOG_FILE%"
echo Thu muc du an: %PROJECT_DIR% >> "%LOG_FILE%"
where node >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [%time%] LOI: Khong tim thay Node.js trong PATH. >> "%LOG_FILE%"
    exit /b 1
)

rem Skip only after a fully successful run.
if exist "%FLAG_FILE%" (
    echo [%date% %time%] Da cao hom nay roi, bo qua. >> "%LOG_FILE%"
    exit /b 0
)

rem Run each crawler. A failure leaves no flag so the next run retries it.
echo [%time%] [1/4] Chay Ngon Tinh crawler... >> "%LOG_FILE%"
node crawl_ngontinh.js >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :failed
echo [%time%] [1/4] Ngon Tinh xong. >> "%LOG_FILE%"

echo [%time%] [2/4] Chay BL crawler... >> "%LOG_FILE%"
node crawl_all_bl.js >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :failed
echo [%time%] [2/4] BL xong. >> "%LOG_FILE%"

echo [%time%] [3/4] Chay Teamsany crawler... >> "%LOG_FILE%"
node crawl_teamsany.js >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :failed
echo [%time%] [3/4] Teamsany xong. >> "%LOG_FILE%"

echo [%time%] [4/4] Chay Truyen H crawler... >> "%LOG_FILE%"
node crawl_truyenh.mjs >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto :failed
echo [%time%] [4/4] Truyen H xong. >> "%LOG_FILE%"

rem Mark the run complete only after every crawler exits successfully.
echo %date% %time% > "%FLAG_FILE%"

echo [%time%] HOAN TAT CRAWL! >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
exit /b 0

:failed
echo [%time%] CRAWL THAT BAI (ma loi %errorlevel%). Se thu lai o lan chay sau. >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
exit /b 1
