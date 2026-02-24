@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TARGET_REMOTE=meta"
set "TARGET_REMOTE_FALLBACK_URL=https://github.com/metaintelligence/namespring-web"
set "TARGET_MAIN_BRANCH=main"
set "TARGET_BRANCH=gh-pages"
set "LOCAL_PAGES_BRANCH=__deploy_%TARGET_BRANCH%_%RANDOM%%RANDOM%"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR:~0,-1%") do set "REPO_ROOT=%%~fI"
set "PAGES_DIR=%TEMP%\namespring-gh-pages-%RANDOM%%RANDOM%"

echo [INFO] Repo root: %REPO_ROOT%
echo [INFO] Pages target: %TARGET_REMOTE%/%TARGET_BRANCH%
echo [INFO] Main sync target: %TARGET_REMOTE%/%TARGET_MAIN_BRANCH%

pushd "%REPO_ROOT%" || (
  echo [ERROR] Failed to access repo root.
  exit /b 1
)

call :step "Ensuring target remote %TARGET_REMOTE%"
call :ensureTargetRemote || goto :fail
call :resolveRepoName || goto :fail
set "BUILD_BASE_PATH=/%REPO_NAME%/"
echo [INFO] Repository name for Pages base path: %REPO_NAME%
echo [INFO] GitHub Pages base path: %BUILD_BASE_PATH%

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
set "SOURCE_BRANCH=%ORIGINAL_BRANCH%"

echo [INFO] Source branch: !SOURCE_BRANCH!

call :step "Pushing !SOURCE_BRANCH! -> %TARGET_REMOTE%/%TARGET_MAIN_BRANCH%"
git push "%TARGET_REMOTE%" "HEAD:%TARGET_MAIN_BRANCH%" --force || (
  echo [ERROR] Failed to push !SOURCE_BRANCH! to %TARGET_REMOTE%/%TARGET_MAIN_BRANCH%.
  goto :fail
)

echo [INFO] Using temp local branch !LOCAL_PAGES_BRANCH!

call :step "Building lib/saju-ts"
pushd "lib\saju-ts" || goto :fail
call :ensureNpmDeps tsc || goto :popFail
if exist "node_modules\typescript\bin\tsc" (
  node "node_modules\typescript\bin\tsc" -p tsconfig.build.json || goto :popFail
) else (
  call npm run build || goto :popFail
)
popd

call :step "Building namespring (GitHub Pages base path: %BUILD_BASE_PATH%)"
pushd "namespring" || goto :fail
call :ensureNpmDeps vite || goto :popFail
set "VITE_BASE_PATH=%BUILD_BASE_PATH%"
if exist "node_modules\vite\bin\vite.js" (
  node "node_modules\vite\bin\vite.js" build || goto :popFail
) else (
  call npm run build:pages || goto :popFail
)
set "VITE_BASE_PATH="
popd

call :step "Preparing local %LOCAL_PAGES_BRANCH% branch"
set "PAGES_BASE_REF=!SOURCE_BRANCH!"
git fetch "%TARGET_REMOTE%" "%TARGET_BRANCH%" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Remote %TARGET_REMOTE%/%TARGET_BRANCH% not found. Local branch will start from !SOURCE_BRANCH!.
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
  git commit -m "Deploy from !SOURCE_BRANCH!" || goto :pagesPopFail
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
set "REQUIRED_BIN=%~1"
if exist "node_modules" (
  if defined REQUIRED_BIN (
    if exist "node_modules\.bin\%REQUIRED_BIN%" (
      echo [INFO] Reusing existing node_modules in %cd%
      exit /b 0
    )
    if exist "node_modules\.bin\%REQUIRED_BIN%.cmd" (
      echo [INFO] Reusing existing node_modules in %cd%
      exit /b 0
    )
    if /I "%REQUIRED_BIN%"=="tsc" (
      if exist "node_modules\typescript\bin\tsc" (
        echo [INFO] Reusing existing node_modules in %cd%
        exit /b 0
      )
    )
    if /I "%REQUIRED_BIN%"=="vite" (
      if exist "node_modules\vite\bin\vite.js" (
        echo [INFO] Reusing existing node_modules in %cd%
        exit /b 0
      )
    )
    echo [WARN] node_modules exists, but required binary "%REQUIRED_BIN%" is missing in %cd%. Reinstalling dependencies...
  ) else (
    echo [INFO] Reusing existing node_modules in %cd%
    exit /b 0
  )
)

if exist "node_modules" (
  rd /s /q "node_modules"
  if exist "node_modules" (
    echo [ERROR] Failed to remove broken node_modules in %cd%
    exit /b 1
  )
)

call :step "Installing npm dependencies in %cd%"
call :runNpmWithRetry "npm ci --registry=https://registry.npmjs.org/ --prefer-offline --no-audit --fund=false --no-progress --fetch-retries=1 --fetch-retry-mintimeout=5000 --fetch-retry-maxtimeout=15000 --fetch-timeout=30000"
if not errorlevel 1 exit /b 0

echo [WARN] npm ci online install failed. Trying npm ci --offline fallback...
call :runNpmWithRetry "npm ci --registry=https://registry.npmjs.org/ --offline --no-audit --fund=false --no-progress"
if not errorlevel 1 exit /b 0

echo [WARN] npm ci failed. Trying npm install fallback...
call :runNpmWithRetry "npm install --registry=https://registry.npmjs.org/ --prefer-offline --no-audit --fund=false --no-progress --fetch-retries=1 --fetch-retry-mintimeout=5000 --fetch-retry-maxtimeout=15000 --fetch-timeout=30000"
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

:ensureTargetRemote
git remote get-url "%TARGET_REMOTE%" >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%U in ('git remote get-url "%TARGET_REMOTE%" 2^>nul') do set "TARGET_REMOTE_URL=%%U"
  echo [INFO] Using existing remote %TARGET_REMOTE%: !TARGET_REMOTE_URL!
  exit /b 0
)

echo [WARN] Remote %TARGET_REMOTE% not found. Adding %TARGET_REMOTE_FALLBACK_URL%
git remote add "%TARGET_REMOTE%" "%TARGET_REMOTE_FALLBACK_URL%"
if errorlevel 1 (
  echo [ERROR] Failed to add remote %TARGET_REMOTE%.
  exit /b 1
)
set "TARGET_REMOTE_URL=%TARGET_REMOTE_FALLBACK_URL%"
echo [INFO] Added remote %TARGET_REMOTE%: %TARGET_REMOTE_FALLBACK_URL%
exit /b 0

:resolveRepoName
set "REPO_NAME="
if defined TARGET_REMOTE_URL (
  for /f "usebackq delims=" %%R in (`powershell -NoProfile -Command "$u=$env:TARGET_REMOTE_URL; if($u -match '[:/](?<repo>[^/:]+?)(?:\.git)?$'){ $matches['repo'] }"`) do set "REPO_NAME=%%R"
)
if not defined REPO_NAME (
  for %%I in ("%REPO_ROOT%") do set "REPO_NAME=%%~nxI"
)
if not defined REPO_NAME (
  echo [ERROR] Failed to resolve repository name for GitHub Pages base path.
  exit /b 1
)
exit /b 0
