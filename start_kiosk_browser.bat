@echo off
:: Script de Lancement Chrome/Edge en Mode Kiosque Plein Écran
:: S'ajouter dans le Démarrage Windows : shell:startup
TITLE Lancement Caisse POS - Mode Kiosque

:: Attendre que le serveur soit bien démarré (5 secondes)
timeout /t 5 /nobreak >nul

set "CHROME_BIN="

:: Chercher Chrome
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

:: Chercher Edge si Chrome absent
if not defined CHROME_BIN if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME_BIN if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_BIN (
    start "" "%CHROME_BIN%" --kiosk http://localhost:5000 --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 --no-first-run --disable-restore-session-state
) else (
    :: Navigateur par défaut en plein écran (fallback)
    start http://localhost:5000
)
