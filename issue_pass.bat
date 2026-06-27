@echo off
setlocal
cd /d "%~dp0"

REM =====================================================================
REM  issue_pass.bat  -  generate a builder pass for a friend's request code
REM
REM  Usage:
REM    issue_pass.bat "HM-3F8A1C7E"                 -> 30-day pass (default)
REM    issue_pass.bat "HM-3F8A1C7E" 30              -> 30-day pass
REM    issue_pass.bat "HM-3F8A1C7E" forever         -> permanent pass
REM    issue_pass.bat "HM-3F8A1C7E" 30 friendhandle -> + log them in builders.json
REM
REM  The pass is bound to THAT friend's machine (from the code they sent) and
REM  is signed with the secret in ..\secret_key.txt -- the SAME secret their
REM  Hearthmon-Friend.exe was built with, so it verifies. It also lands on
REM  your clipboard, ready to send.
REM =====================================================================

set "REQ=%~1"
if "%REQ%"=="" (
  echo Usage: issue_pass.bat "HM-XXXXXXXX" [days^|forever] [github-handle]
  echo   e.g. issue_pass.bat "HM-3F8A1C7E" 14 friendhandle
  exit /b 1
)

REM Load the build secret = FIRST non-blank line of the file (ignore notes below it).
set "HEARTHMON_PASS_SECRET="
for /f "usebackq delims=" %%S in ("%~dp0..\secret_key.txt") do if not defined HEARTHMON_PASS_SECRET set "HEARTHMON_PASS_SECRET=%%S"
if not defined HEARTHMON_PASS_SECRET (
  echo ERROR: could not read secret from ..\secret_key.txt
  exit /b 1
)

REM Duration: number of days, or "forever". Default 30.
set "DUR=%~2"
if "%DUR%"=="" set "DUR=30"

REM Optional GitHub handle -> recorded in builders.json (your CRM / README count).
set "GHARG="
if not "%~3"=="" set "GHARG=-Github %~3"

echo [issue_pass] code=%REQ%  duration=%DUR%
if /i "%DUR%"=="forever" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\generate_pass.ps1" -RequestCode "%REQ%" -Forever %GHARG%
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\generate_pass.ps1" -RequestCode "%REQ%" -Days %DUR% %GHARG%
)
if errorlevel 1 ( echo [issue_pass] FAILED & exit /b 1 )

echo [issue_pass] ^^^ pass above (also copied to clipboard) -- send it to your friend.
endlocal
