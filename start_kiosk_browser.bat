@echo off
:: Script de Lancement Chrome/Edge en Mode Kiosque Plein Écran
TITLE Lancement Caisse POS - Mode Kiosque
echo ==============================================================
echo  LANCEMENT DU NAVIGATEUR EN MODE KIOSQUE PLEIN ÉCRAN
echo ==============================================================
echo.

set "CHROME_BIN="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not defined CHROME_BIN if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME_BIN if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_BIN (
    echo Lancement de : "%CHROME_BIN%"
    start "" "%CHROME_BIN%" --kiosk http://localhost:5000 --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000
) else (
    echo ⚠️ Aucun navigateur Chrome ou Edge trouvé. Lancement du navigateur par défaut...
    start http://localhost:5000
)
