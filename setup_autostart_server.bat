@echo off
:: Script d'installation du Serveur POS au démarrage de Windows (Sans session ouverte)
TITLE Installation Serveur POS - Démarrage Automatique
echo ==============================================================
echo  CONFIGURING SERVEUR POS - DEMARRAGE AUTOMATIQUE WINDOWS
echo ==============================================================
echo.

set "POS_DIR=%~dp0"
:: Supprimer le dernier anti-slash s'il existe
if "%POS_DIR:~-1%"=="\" set "POS_DIR=%POS_DIR:~0,-1%"

echo Dossier du POS : %POS_DIR%
echo.

:: 1. Création de la tâche planifiée pour démarrer au Boot du PC (Compte SYSTEM)
schtasks /Create /TN "POS_Backend_Service" /TR "node.exe \"%POS_DIR%\server.js\"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Tâche planifiée créée avec succès ! Le serveur démarrera automatiquement dès l'allumage du PC (même sans ouvrir de session).
    echo.
    echo Démarrage immédiat du serveur...
    schtasks /Run /TN "POS_Backend_Service"
) else (
    echo.
    echo ⚠️ Veuillez exécuter ce fichier en Clic Droit -> "Exécuter en tant qu'administrateur".
)

echo.
pause
