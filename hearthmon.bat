@echo off
setlocal EnableExtensions
title Hearthmon
cd /d "%~dp0"

set "EXE=src-tauri\target\release\hearthmon.exe"

echo(
echo   Hearthmon
echo   ---------
if exist "%EXE%" (
  echo   Waking your companion...
  start "" "%EXE%"
) else (
  echo   No release build found.
  echo   Building once ^(this takes a while^), then launching...
  echo   ^(tip: run "npm run tauri build" yourself for a faster start next time^)
  start "Hearthmon dev" cmd /c "npm run tauri dev"
)

echo(
echo   It's running now. You can close your editor — it stays with you.
echo   Type  close  here whenever you want it to rest.
echo(

:loop
set "cmd="
set /p "cmd=hearthmon>  "
if /i "%cmd%"=="close" goto confirm
if /i "%cmd%"=="exit"  goto confirm
if /i "%cmd%"=="quit"  goto confirm
goto loop

:confirm
set "yn="
set /p "yn=  Send Hearthmon to sleep? (y/n)  "
if /i not "%yn%"=="y" (
  echo   ...staying, then.
  echo(
  goto loop
)

taskkill /im hearthmon.exe /f >nul 2>&1
echo(
echo   It was a pleasure building alongside you today.
echo   Rest well - I'll be here when you're back.  ^<3
echo(
timeout /t 3 >nul
endlocal
