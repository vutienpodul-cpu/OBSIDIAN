@echo off
chcp 65001 >nul
title OBSIDIAN - Tai Electron qua PowerShell
color 0E
cd /d "%~dp0"

echo ===============================================
echo  Tai Electron binary truc tiep qua PowerShell
echo ===============================================
echo.

REM Tao thu muc dist neu chua co
if not exist "node_modules\electron\dist" mkdir "node_modules\electron\dist"

REM Thu cac mirror khac nhau
echo Dang tai tu mirror Trung Quoc (~120MB)...
echo.
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $urls = @('https://registry.npmmirror.com/-/binary/electron/v31.7.7/electron-v31.7.7-win32-x64.zip', 'https://cdn.npmmirror.com/binaries/electron/31.7.7/electron-v31.7.7-win32-x64.zip', 'https://github.com/electron/electron/releases/download/v31.7.7/electron-v31.7.7-win32-x64.zip'); foreach($u in $urls) { Write-Host ('Thu URL: ' + $u); try { Invoke-WebRequest -Uri $u -OutFile 'electron.zip' -UseBasicParsing -TimeoutSec 300; if((Test-Path 'electron.zip') -and ((Get-Item 'electron.zip').Length -gt 50000000)) { Write-Host 'Tai thanh cong!'; break } } catch { Write-Host ('Loi: ' + $_.Exception.Message) } }"

if not exist "electron.zip" (
    echo.
    echo ===========================================
    echo   KHONG TAI DUOC Electron tu bat ky mirror nao
    echo ===========================================
    echo.
    echo Hay thuc hien thu cong:
    echo  1. Mo Cloudflare WARP - bam "Disconnect" tam thoi
    echo  2. Chay lai file nay
    echo.
    pause
    exit /b 1
)

echo.
echo Tai xong. Dang giai nen...
powershell -NoProfile -Command "Expand-Archive -Path 'electron.zip' -DestinationPath 'node_modules\electron\dist' -Force"
del electron.zip
echo.

if not exist "node_modules\electron\dist\electron.exe" (
    echo Loi giai nen.
    pause
    exit /b 1
)

echo Electron OK. Dang khoi chay OBSIDIAN...
echo Cua so app se mo trong 10-30 giay.
echo KHONG dong cua so nay.
echo.
call npm run dev

echo.
echo App da dong. Nhan phim bat ky de thoat.
pause >nul
