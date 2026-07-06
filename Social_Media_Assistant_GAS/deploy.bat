@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Nina Agent - GAS Auto Deploy
color 0A

echo.
echo =====================================================
echo   Nina Agent - Social Media Assistant GAS Deployer
echo =====================================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org
    echo.
    echo After installation, close this window and run this script again.
    pause
    exit /b 1
)

echo [OK] Node.js installed:
node --version
echo.

:: Check if Clasp is installed
where clasp >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Clasp is not installed. Installing now...
    echo.
    call npm install -g @google/clasp
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install Clasp.
        echo.
        echo Please install manually by running:
        echo   npm install -g @google/clasp
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Clasp installed successfully!
    echo.
) else (
    echo [OK] Clasp is already installed.
    echo.
)

:: Login to Google
echo =====================================================
echo   STEP 1: LOGIN TO GOOGLE
echo =====================================================
echo.
echo Your browser will open for Google authentication.
echo Please sign in with your Google account.
echo.
echo Press any key to continue...
pause >nul

clasp login
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Login failed. Please try again.
    echo.
    echo If you see "clasp is not recognized", please:
    echo   1. Close this window
    echo   2. Open a NEW command prompt
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)
echo.
echo [OK] Logged in successfully!
echo.

:: Create or use existing project
echo =====================================================
echo   STEP 2: CREATE GAS PROJECT
echo =====================================================
echo.

if exist ".clasp.json" (
    echo Found existing .clasp.json file.
    echo.
    set /p USE_EXISTING="Use existing project? (Y/N): "
    if /i "!USE_EXISTING!"=="Y" (
        echo.
        echo Using existing project.
        goto :PUSH_FILES
    ) else (
        del .clasp.json
        echo Deleted old .clasp.json
        echo.
    )
)

set /p PROJECT_NAME="Enter project name [Social Media Assistant]: "
if "!PROJECT_NAME!"=="" set PROJECT_NAME=Social Media Assistant

echo.
echo Creating project: !PROJECT_NAME!
echo.

:: Try to create project
clasp create --type standalone --title "!PROJECT_NAME!"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to create project.
    echo.
    echo This might happen if:
    echo   - Apps Script API is not enabled
    echo   - You need to enable it at: https://script.google.com/home/usersettings
    echo.
    echo Please enable "Google Apps Script API" and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Project created successfully!
echo.

:PUSH_FILES
echo =====================================================
echo   STEP 3: PUSH FILES TO GAS
echo =====================================================
echo.
echo Pushing all files to Google Apps Script...
echo This may take 1-2 minutes...
echo.

clasp push --force
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to push files.
    echo.
    echo Common issues:
    echo   - Check your internet connection
    echo   - Make sure you're logged in (clasp login)
    echo   - Try running: clasp push --force
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] All files pushed successfully!
echo.

:: Deploy as web app
echo =====================================================
echo   STEP 4: DEPLOY AS WEB APP
echo =====================================================
echo.
echo Deploying version 1...
echo.

clasp deploy --description "v1 - Initial deployment" --deploymentId ""
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Auto-deploy might have failed.
    echo.
    echo No worries! You can deploy manually:
    echo   1. Run: clasp open
    echo   2. Click Deploy ^> New deployment
    echo   3. Select "Web app"
    echo   4. Set "Execute as" = Me
    echo   5. Set "Who has access" = Anyone
    echo   6. Click Deploy
    echo.
    echo Opening Apps Script editor now...
    clasp open
    pause
    exit /b 0
)

echo.
echo =====================================================
echo   🎉 DEPLOYMENT COMPLETE! 🎉
echo =====================================================
echo.
echo Your Social Media Assistant is now LIVE!
echo.
echo Next steps:
echo   1. Open the deployed URL from the message above
echo   2. Set your Google Sheet ID in Code.gs (line 4)
echo   3. Create tabs "Brands" and "ContentHistory" in your Sheet
echo.
echo Opening Apps Script editor...
clasp open

echo.
echo =====================================================
echo Press any key to exit...
pause >nul
