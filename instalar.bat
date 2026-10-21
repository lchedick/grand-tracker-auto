@echo off
title Instalar Grand Tracker Auto
echo.
echo  === GTA - Grand Tracker Auto - instalacao ===
echo.

rem 1) copia o painel para a pasta de extensoes do Premiere
set "DEST=%APPDATA%\Adobe\CEP\extensions\GrandTrackerAuto"
if exist "%DEST%" rmdir /S /Q "%DEST%"
xcopy /E /I /Y /Q "%~dp0GrandTrackerAuto" "%DEST%" >nul
if errorlevel 1 goto erro_copia
echo  [ok] Painel copiado para %DEST%

rem 2) libera paineis nao assinados (necessario para extensoes proprias)
for %%v in (9 10 11 12 13 14 15) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>nul
echo  [ok] Premiere configurado para carregar o painel

rem 3) Python + bibliotecas
set "PY=py -3"
%PY% --version >nul 2>nul
if errorlevel 1 set "PY=python"
%PY% --version >nul 2>nul
if errorlevel 1 goto sem_python
echo  [ok] Python encontrado
%PY% -m pip install --upgrade -r "%DEST%\engine\requirements.txt"
if errorlevel 1 goto erro_pip
echo  [ok] Bibliotecas instaladas

echo.
echo  Pronto! Feche e abra o Premiere e va em:
echo  Window ^> Extensions ^> GTA - Grand Tracker Auto V1
echo.
pause
exit /b 0

:sem_python
echo.
echo  Python nao encontrado.
echo  Instale em https://www.python.org/downloads/ (marque "Add python.exe to PATH")
echo  e rode este instalar.bat de novo.
pause
exit /b 1

:erro_copia
echo  Nao consegui copiar os arquivos. Feche o Premiere e tente de novo.
pause
exit /b 1

:erro_pip
echo  Falha ao instalar as bibliotecas (verifique a internet) e rode de novo.
pause
exit /b 1
