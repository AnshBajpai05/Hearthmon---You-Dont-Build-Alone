@echo off
setlocal
cd /d "%~dp0"

REM =====================================================================
REM  built_friends.bat  -  FRIEND edition
REM  Trial gate active: 5-day chapter + 2 grace days, then soft pause;
REM  unlock with a builder pass you generate (tools\generate_pass.ps1).
REM  Output: dist\Hearthmon-Friend.exe
REM  NOTE: uses the SAME secret as built_me.bat, so your passes verify here.
REM =====================================================================

REM Load the build secret from the private file (one level up, gitignored).
REM Read the FIRST non-blank line only (the secret); ignore any notes below it.
set "HEARTHMON_PASS_SECRET="
for /f "usebackq delims=" %%S in ("%~dp0..\secret_key.txt") do if not defined HEARTHMON_PASS_SECRET set "HEARTHMON_PASS_SECRET=%%S"
if not defined HEARTHMON_PASS_SECRET (
  echo [built_friends] ERROR: could not read secret from ..\secret_key.txt
  exit /b 1
)

REM Founder flag OFF  ->  normal trial gate in the binary.
set "HEARTHMON_FOUNDER="

echo [built_friends] Building FRIEND edition (trial gate)...
call npm run tauri build
if errorlevel 1 ( echo [built_friends] build FAILED & exit /b 1 )

if not exist "dist" mkdir "dist"

REM The fresh exe (or a running dist copy) can be briefly locked by antivirus, the bundler, or a
REM still-running Hearthmon. Retry a few times, then fail with a clear message.
set "SRC=src-tauri\target\release\hearthmon.exe"
set "DST=dist\Hearthmon-Friend.exe"
set "TRIES=0"
:cp_loop
copy /Y "%SRC%" "%DST%" >nul 2>&1
if not errorlevel 1 goto cp_ok
set /a TRIES+=1
if %TRIES% geq 6 goto cp_fail
echo [built_friends] "%DST%" busy - retry %TRIES%/6 ^(close any running Hearthmon: tray -^> Quit^)...
timeout /t 2 /nobreak >nul
goto cp_loop
:cp_fail
echo [built_friends] FAILED to write %DST% - it's locked by another process.
echo   Quit any running Hearthmon ^(tray icon -^> Quit, or Task Manager^), then re-run.
echo   Or copy by hand:  %SRC%  -^>  %DST%
exit /b 1
:cp_ok
REM `copy` can report success yet leave a TRUNCATED file (AV scan / lock mid-write). Sanity-check.
set "SZ=0"
for %%A in ("%DST%") do set "SZ=%%~zA"
if %SZ% LSS 1000000 (
  echo [built_friends] FAILED: %DST% is only %SZ% bytes - truncated by antivirus or a lock.
  echo   Add a Kaspersky/Defender exclusion for this dist folder, close any running Hearthmon, re-run.
  exit /b 1
)

REM Guides are copied FROM the git-tracked sources every build, so dist is always current even if
REM a sync/backup tool reverts a dist copy. Edit the SOURCES, never dist:
REM   FRIENDS_GUIDE.md      -> quickstart   |   current_features.md -> full tour
copy /Y "FRIENDS_GUIDE.md" "dist\Hearthmon - Read Me First.md" >nul
copy /Y "current_features.md" "dist\Hearthmon - Everything to Try.md" >nul

REM Auto-bundle the three friend files into one send-ready zip (overwrites the old one).
echo [built_friends] Zipping the three friend files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Force -Path 'dist\Hearthmon-Friend.exe','dist\Hearthmon - Read Me First.md','dist\Hearthmon - Everything to Try.md' -DestinationPath 'dist\Hearthmon - Friends.zip'"
if errorlevel 1 echo [built_friends] WARNING: zip step failed - zip the three dist files by hand.

echo [built_friends] Done:
echo     dist\Hearthmon-Friend.exe              (trial gate)
echo     dist\Hearthmon - Read Me First.md      (quickstart)
echo     dist\Hearthmon - Everything to Try.md  (full feature tour)
echo     dist\Hearthmon - Friends.zip           (auto-zipped -- send this one)
endlocal
