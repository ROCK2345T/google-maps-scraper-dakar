@echo off
title Google Maps Scraper Pro
echo ===================================================
echo     Google Maps Scraper Pro (Sans cle API)
echo ===================================================
echo.

REM Verifier si uv est disponible
where uv >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Demarrage de l'interface avec uv...
    uv run streamlit run app.py
) else (
    REM Fallback avec python ou venv
    if exist .venv\Scripts\python.exe (
        echo Demarrage via l'environnement virtuel .venv...
        .venv\Scripts\python.exe -m streamlit run app.py
    ) else (
        echo Demarrage via Python systeme...
        python -m streamlit run app.py
    )
)

pause
