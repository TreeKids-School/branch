@echo off
cd /d "%~dp0"

:: ── 今日の日付を YY.MM.DD 形式で取得 ──────────────────────────────────
for /f "tokens=2 delims==" %%I in ('wmic os get LocalDateTime /value') do set DT=%%I
set YY=%DT:~2,2%
set MM=%DT:~4,2%
set DD=%DT:~6,2%
set TODAY=%YY%.%MM%.%DD%

:: ── constants.js のバージョン番号を更新 ───────────────────────────
echo バージョンを更新しています...
call node update_version.mjs
if %errorlevel% neq 0 (
    echo バージョン更新に失敗しました
    pause
    exit /b 1
)

:: ── ビルド ───────────────────────────────────────────────────────────
if exist dist rmdir /s /q dist
echo ビルド中...
call npm run build
if %errorlevel% neq 0 (
    echo ビルドに失敗しました
    pause
    exit /b 1
)

:: ── デプロイ ─────────────────────────────────────────────────────────
echo デプロイ中...
call firebase deploy --only hosting
echo.
echo 完了！ v%NEW_VERSION%
pause
