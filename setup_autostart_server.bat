@echo off
:: Script d'installation du Serveur POS au démarrage de Windows (Sans session ouverte)
TITLE Installation Serveur POS - Démarrage Automatique
echo ==============================================================
echo  CONFIGURING SERVEUR POS - DEMARRAGE AUTOMATIQUE WINDOWS
echo ==============================================================
echo.

:: Chemin fixe du dossier POS (dans Documents du client)
set "POS_DIR=C:\Users\SMAB GROUP\Documents\POS"

:: Vérification que le dossier existe
if not exist "%POS_DIR%\server.js" (
    echo ❌ ERREUR : Le fichier server.js est introuvable dans : %POS_DIR%
    echo    Vérifiez que le dossier POS est bien dans Documents.
    pause
    exit /b 1
)

echo Dossier du POS : %POS_DIR%
echo.

:: Trouver node.exe dans le PATH
where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERREUR : node.exe introuvable. Veuillez installer Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('where node.exe') do set "NODE_BIN=%%i"
echo Node.js trouvé : %NODE_BIN%
echo.

:: Commande complète avec répertoire de travail défini via cmd.exe
set "TASK_CMD=cmd.exe /c \"cd /d \"%POS_DIR%\" && \"%NODE_BIN%\" server.js > \"%POS_DIR%\server.log\" 2>&1\""

:: Création de la tâche planifiée (Compte SYSTEM, démarrage au Boot)
schtasks /Create /TN "POS_Backend_Service" /TR "%TASK_CMD%" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Tâche planifiée créée avec succès !
    echo    Le serveur démarrera automatiquement dès l'allumage du PC.
    echo    (Même sans ouvrir de session Windows)
    echo.
    echo Démarrage immédiat du serveur...
    schtasks /Run /TN "POS_Backend_Service"
    echo.
    echo ✅ Serveur lancé ! Attendez 5 secondes puis testez : http://localhost:5000
) else (
    echo.
    echo ⚠️  ERREUR : Veuillez faire Clic Droit -> "Exécuter en tant qu'administrateur".
)

echo.
pause
