@echo off
chcp 65001 >nul
title OBSIDIAN - Khoi chay
color 0E
cd /d "%~dp0"

echo Kiem tra Electron binary...
if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron chua co binary - dang tai...
    call npm install electron --force --no-audit --no-fund
)

echo.
echo Khoi chay OBSIDIAN...
echo Cua so app se mo trong 10-30 giay.
echo KHONG dong cua so nay - dong se tat app.
echo.
call npm run dev

echo.
echo App da dong. Nhan phim bat ky de thoat.
pause >nul
