@echo off
setlocal
cd /d "%~dp0"

REM =====================================================================
REM  built_friends.bat  -  FRIEND edition (signed, auto-updating)
REM  Trial gate active: 5-day chapter + 2 grace days, then soft pause;
REM  unlock with a builder pass you generate (tools\generate_pass.ps1).
REM  Produces a SIGNED NSIS installer + latest.json in dist\release\ for
REM  GitHub Releases. Friends install once; future updates arrive in-app.
REM  See UPDATER_SETUP.md for the one-time keypair + per-release checklist.
REM =====================================================================

REM --- Build secret (chapter/pass) -------------------------------------
REM Read the FIRST non-blank line only (the secret); ignore any notes below it.
set "HEARTHMON_PASS_SECRET="
for /f "usebackq delims=" %%S in ("%~dp0..\secret_key.txt") do if not defined HEARTHMON_PASS_SECRET set "HEARTHMON_PASS_SECRET=%%S"
if not defined HEARTHMON_PASS_SECRET (
  echo [built_friends] ERROR: could not read secret from ..\secret_key.txt
  exit /b 1
)

REM --- Updater signing key (REQUIRED: createUpdaterArtifacts is on) -----
REM One-time setup generates ..\hearthmon_updater.key (+ password). Both live one level up,
REM gitignored, like secret_key.txt. Rotating the key invalidates ALL update signatures.
set "UPDATER_KEY=%~dp0..\hearthmon_updater.key"
if not exist "%UPDATER_KEY%" (
  echo [built_friends] ERROR: updater signing key not found at "%UPDATER_KEY%".
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

REM Founder flag OFF  ->  normal trial gate in the binary.
set "HEARTHMON_FOUNDER="

echo [built_friends] Building SIGNED FRIEND edition (trial gate + auto-update)...
call npm run tauri build
if errorlevel 1 ( echo [built_friends] build FAILED & exit /b 1 )

REM --- Assemble the signed release (installer + signature -> latest.json) ---
echo [built_friends] Assembling signed release into dist\release ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\make_release.ps1"
if errorlevel 1 ( echo [built_friends] release assembly FAILED & exit /b 1 )

REM Guides are copied FROM the git-tracked sources every build (edit the SOURCES, never dist):
REM   FRIENDS_GUIDE.md      -> quickstart   |   current_features.md -> full tour
if not exist "dist\release" mkdir "dist\release"
copy /Y "FRIENDS_GUIDE.md" "dist\release\Hearthmon - Read Me First.md" >nul
copy /Y "current_features.md" "dist\release\Hearthmon - Everything to Try.md" >nul

echo [built_friends] Done. dist\release\ holds the installer + latest.json + guides.
echo     Upload the installer AND latest.json to a GitHub Release (tag vX.Y.Z). See UPDATER_SETUP.md.
endlocal
