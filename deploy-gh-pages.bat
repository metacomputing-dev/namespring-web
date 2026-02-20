@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TARGET_REMOTE=meta"
set "TARGET_BRANCH=gh-pages"
set "LOCAL_PAGES_BRANCH=__deploy_%TARGET_BRANCH%_%RANDOM%%RANDOM%"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR:~0,-1%") do set "REPO_ROOT=%%~fI"
for %%I in ("%REPO_ROOT%") do set "REPO_NAME=%%~nxI"
set "BUILD_BASE_PATH=/%REPO_NAME%/"
set "PAGES_DIR=%TEMP%\namespring-gh-pages-%RANDOM%%RANDOM%"

echo [INFO] Repo root: %REPO_ROOT%
echo [INFO] Pages target: %TARGET_REMOTE%/%TARGET_BRANCH%

pushd "%REPO_ROOT%" || (
  echo [ERROR] Failed to access repo root.
  exit /b 1
)

call :step "Checking clean git state"
git diff --quiet
if errorlevel 1 (
  echo [ERROR] Unstaged changes detected. Commit or stash first.
  goto :fail
)
git diff --cached --quiet
if errorlevel 1 (
  echo [ERROR] Staged but uncommitted changes detected. Commit first.
  goto :fail
)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "ORIGINAL_BRANCH=%%B"
if not defined ORIGINAL_BRANCH (
  echo [ERROR] Failed to detect current branch.
  goto :fail
)

call :step "Checking out main"
git checkout main || goto :fail

echo [INFO] Using temp local branch !LOCAL_PAGES_BRANCH!

call :step "Building lib/saju-ts"
pushd "lib\saju-ts" || goto :fail
call :ensureNpmDeps || goto :popFail
call npm run build || goto :popFail
popd

call :step "Building namespring (GitHub Pages base path: %BUILD_BASE_PATH%)"
pushd "namespring" || goto :fail
call :ensureNpmDeps || goto :popFail
set "VITE_BASE_PATH=%BUILD_BASE_PATH%"
call npm run build:pages || goto :popFail
set "VITE_BASE_PATH="
popd

call :step "Preparing local %LOCAL_PAGES_BRANCH% branch"
set "PAGES_BASE_REF=main"
git fetch "%TARGET_REMOTE%" "%TARGET_BRANCH%" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Remote %TARGET_REMOTE%/%TARGET_BRANCH% not found. Local branch will start from main.
) else (
  set "FETCH_HEAD_SHA="
  for /f "delims=" %%H in ('git rev-parse FETCH_HEAD 2^>nul') do set "FETCH_HEAD_SHA=%%H"
  if not defined FETCH_HEAD_SHA (
    echo [ERROR] Failed to resolve fetched head for %TARGET_REMOTE%/%TARGET_BRANCH%.
    goto :fail
  )
  set "PAGES_BASE_REF=!FETCH_HEAD_SHA!"
)
git branch -D "%LOCAL_PAGES_BRANCH%" >nul 2>&1
git branch "%LOCAL_PAGES_BRANCH%" "%PAGES_BASE_REF%" || goto :fail

call :step "Creating worktree for %LOCAL_PAGES_BRANCH%"
git worktree add --force "%PAGES_DIR%" "%LOCAL_PAGES_BRANCH%" || goto :fail

call :step "Copying namespring/dist -> %TARGET_BRANCH%"
call :clearDir "%PAGES_DIR%" || goto :worktreeFail
robocopy "%REPO_ROOT%\namespring\dist" "%PAGES_DIR%" /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NC /NS >nul
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  echo [ERROR] robocopy failed with exit code %ROBOCOPY_EXIT%.
  goto :worktreeFail
)
type nul > "%PAGES_DIR%\.nojekyll"

pushd "%PAGES_DIR%" || goto :worktreeFail
call :step "Committing deploy artifacts"
git add -A || goto :pagesPopFail
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Deploy from main" || goto :pagesPopFail
) else (
  echo [INFO] No changes in deploy artifacts. Skip commit.
)

call :step "Pushing to %TARGET_REMOTE%/%TARGET_BRANCH% with --force"
git push "%TARGET_REMOTE%" "HEAD:%TARGET_BRANCH%" --force || goto :pagesPopFail
popd

call :step "Cleaning up"
git worktree remove "%PAGES_DIR%" --force >nul 2>&1
if exist "%PAGES_DIR%" rd /s /q "%PAGES_DIR%"
git branch -D "%LOCAL_PAGES_BRANCH%" >nul 2>&1

if /I not "%ORIGINAL_BRANCH%"=="main" (
  call :step "Returning to %ORIGINAL_BRANCH%"
  git checkout "%ORIGINAL_BRANCH%" >nul 2>&1
)

echo.
echo [DONE] Build + deploy completed successfully.
popd
exit /b 0

:clearDir
set "TARGET_DIR=%~1"
if not exist "%TARGET_DIR%" exit /b 1
pushd "%TARGET_DIR%" || exit /b 1
for /f "delims=" %%F in ('dir /a /b') do (
  if /I not "%%F"==".git" (
    if exist "%%F\" (
      rd /s /q "%%F"
    ) else (
      del /f /q "%%F"
    )
  )
)
popd
exit /b 0

:ensure_npm_deps
call :ensureNpmDeps
exit /b %ERRORLEVEL%

:ensureNpmDeps
if exist "node_modules" (
  echo [INFO] Reusing existing node_modules in %cd%
  exit /b 0
)

call :step "Installing npm dependencies in %cd%"
call :runNpmWithRetry "npm ci --prefer-offline --no-audit --fund=false"
if not errorlevel 1 exit /b 0

echo [WARN] npm ci failed. Trying npm install fallback...
call :runNpmWithRetry "npm install --prefer-offline --no-audit --fund=false"
if not errorlevel 1 exit /b 0

echo [ERROR] Failed to install npm dependencies in %cd%
exit /b 1

:runNpmWithRetry
set "NPM_CMD=%~1"
set "MAX_RETRIES=3"
set /a ATTEMPT=1

:runNpmWithRetryLoop
echo [INFO] Attempt !ATTEMPT!/!MAX_RETRIES!: !NPM_CMD!
cmd /c "!NPM_CMD!"
if not errorlevel 1 exit /b 0

if !ATTEMPT! GEQ !MAX_RETRIES! exit /b 1
echo [WARN] Command failed. Retrying in 5 seconds...
timeout /t 5 >nul
set /a ATTEMPT+=1
goto :runNpmWithRetryLoop

:pagesPopFail
popd
:worktreeFail
git worktree remove "%PAGES_DIR%" --force >nul 2>&1
if exist "%PAGES_DIR%" rd /s /q "%PAGES_DIR%"
git branch -D "%LOCAL_PAGES_BRANCH%" >nul 2>&1
goto :fail

:popFail
popd
:fail
if defined ORIGINAL_BRANCH (
  git checkout "%ORIGINAL_BRANCH%" >nul 2>&1
)
popd
echo.
echo [FAIL] Deployment aborted.
exit /b 1

:step
echo.
echo [STEP] %~1
exit /b 0
