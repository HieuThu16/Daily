@echo off
chcp 65001 >nul
cd /d "d:\Desktop\Daily"

set LOG_DIR=d:\Desktop\Daily\scheduler\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set LOG_FILE=%LOG_DIR%\crawl_%date:~6,4%%date:~3,2%%date:~0,2%.log

echo ============================================= >> "%LOG_FILE%"
echo [%date% %time%] BAT DO CRAWL >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"

echo [%time%] Chay Ngon Tinh crawler... >> "%LOG_FILE%"
node crawl_ngontinh.js >> "%LOG_FILE%" 2>&1
echo [%time%] Ngon Tinh xong. >> "%LOG_FILE%"

echo [%time%] Chay BL crawler... >> "%LOG_FILE%"
node crawl_all_bl.js >> "%LOG_FILE%" 2>&1
echo [%time%] BL xong. >> "%LOG_FILE%"

echo [%time%] Chay Teamsany crawler... >> "%LOG_FILE%"
node crawl_teamsany.js >> "%LOG_FILE%" 2>&1
echo [%time%] Teamsany xong. >> "%LOG_FILE%"

echo [%time%] HOAN TAT CRAWL! >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
