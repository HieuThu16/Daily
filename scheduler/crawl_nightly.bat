@echo off
chcp 65001 >nul
cd /d "d:\Desktop\Daily"

set LOG_DIR=d:\Desktop\Daily\scheduler\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Tạo tên file flag và log theo ngày hôm nay
set TODAY=%date:~6,4%%date:~3,2%%date:~0,2%
set FLAG_FILE=%LOG_DIR%\done_%TODAY%.flag
set LOG_FILE=%LOG_DIR%\crawl_%TODAY%.log

:: ─── Kiểm tra đã cào hôm nay chưa ───────────────────────────────────
if exist "%FLAG_FILE%" (
    echo [%date% %time%] Da cao hom nay roi, bo qua. >> "%LOG_FILE%"
    exit /b 0
)

:: ─── Bắt đầu cào ─────────────────────────────────────────────────────
echo ============================================= >> "%LOG_FILE%"
echo [%date% %time%] BAT DAU CRAWL >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"

echo [%time%] [1/3] Chay Ngon Tinh crawler... >> "%LOG_FILE%"
node crawl_ngontinh.js >> "%LOG_FILE%" 2>&1
echo [%time%] [1/3] Ngon Tinh xong. >> "%LOG_FILE%"

echo [%time%] [2/3] Chay BL crawler... >> "%LOG_FILE%"
node crawl_all_bl.js >> "%LOG_FILE%" 2>&1
echo [%time%] [2/3] BL xong. >> "%LOG_FILE%"

echo [%time%] [3/3] Chay Teamsany crawler... >> "%LOG_FILE%"
node crawl_teamsany.js >> "%LOG_FILE%" 2>&1
echo [%time%] [3/3] Teamsany xong. >> "%LOG_FILE%"

:: ─── Ghi flag "đã chạy hôm nay" ─────────────────────────────────────
echo %date% %time% > "%FLAG_FILE%"

echo [%time%] HOAN TAT CRAWL! >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
