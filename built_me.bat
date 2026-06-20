@echo off
setlocal
cd /d "%~dp0"

REM =====================================================================
REM  built_me.bat  -  FOUNDER edition (Ansh)
REM  Full access: no trial, no pause, no builder pass needed.
REM  Output: dist\Hearthmon.exe
REM =====================================================================

REM Load the build secret from the private file (one level up, gitignored).
REM Read the FIRST non-blank line only (the secret); ignore any notes below it.
set "HEARTHMON_PASS_SECRET="
for /f "usebackq delims=" %%S in ("%~dp0..\secret_key.txt") do if not defined HEARTHMON_PASS_SECRET set "HEARTHMON_PASS_SECRET=%%S"
if not defined HEARTHMON_PASS_SECRET (
  echo [built_me] ERROR: could not read secret from ..\secret_key.txt
  exit /b 1
)

REM --- Updater signing key (REQUIRED: createUpdaterArtifacts is on for both editions) ---
REM Founder builds the portable exe below, but `tauri build` still signs update artifacts, so
REM the key must be present. Same key as built_friends. See UPDATER_SETUP.md to generate it once.
set "UPDATER_KEY=%~dp0..\hearthmon_updater.key"
if not exist "%UPDATER_KEY%" (
  echo [built_me] ERROR: updater signing key not found at "%UPDATER_KEY%".
  echo   Generate it once:  npm run tauri signer generate -- -w ..\hearthmon_updater.key
  echo   Then paste the printed PUBLIC key into src-tauri\tauri.conf.json (plugins.updater.pubkey).
  echo   Full checklist: UPDATER_SETUP.md
  exit /b 1
)
set "TAURI_SIGNING_PRIVATE_KEY=%UPDATER_KEY%"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="
if exist "%~dp0..\updater_key_password.txt" (
  for /f "usebackq delims=" %%P in ("%~dp0..\updater_key_password.txt") do if not defined TAURI_SIGNING_PRIVATE_KEY_PASSWORD set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=%%P"
)

REM Founder flag ON  ->  gate disabled in the binary.
set "HEARTHMON_FOUNDER=1"

echo [built_me] Building FOUNDER edition (full access)...
call npm run tauri build
if errorlevel 1 ( echo [built_me] build FAILED & exit /b 1 )

if not exist "dist" mkdir "dist"

REM The fresh exe (or a running dist copy) can be briefly locked by antivirus, the bundler, or a
REM still-running Hearthmon. Retry a few times, then fail with a clear message.
set "SRC=src-tauri\target\release\hearthmon.exe"
set "DST=dist\Hearthmon.exe"
set "TRIES=0"
:cp_loop
copy /Y "%SRC%" "%DST%" >nul 2>&1
if not errorlevel 1 goto cp_ok
set /a TRIES+=1
if %TRIES% geq 6 goto cp_fail
echo [built_me] "%DST%" busy - retry %TRIES%/6 ^(close any running Hearthmon: tray -^> Quit^)...
timeout /t 2 /nobreak >nul
goto cp_loop
:cp_fail
echo [built_me] FAILED to write %DST% - it's locked by another process.
echo   Quit any running Hearthmon ^(tray icon -^> Quit, or Task Manager^), then re-run.
echo   Or copy by hand:  %SRC%  -^>  %DST%
exit /b 1
:cp_ok
REM `copy` can report success yet leave a TRUNCATED file (AV scan / lock mid-write). Sanity-check.
set "SZ=0"
for %%A in ("%DST%") do set "SZ=%%~zA"
if %SZ% LSS 1000000 (
  echo [built_me] FAILED: %DST% is only %SZ% bytes - truncated by antivirus or a lock.
  echo   Add a Kaspersky/Defender exclusion for this dist folder, close any running Hearthmon, re-run.
  exit /b 1
)

echo [built_me] Done. dist\Hearthmon.exe is ready (founder / full access, %SZ% bytes).
endlocal
