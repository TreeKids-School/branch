@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo       アイコン一括着せ替えツール
echo ========================================
echo.

set "NEW_ICON="

:: フォルダ内のpngファイルを1つ見つける
for %%F in (*.png) do (
    set "NEW_ICON=%%F"
    goto :found
)

echo 【エラー】画像が見つかりません！
echo この「アイコン着せ替え」フォルダの中に、新しく設定したいアイコン画像（.pngファイル）を入れてから再度ダブルクリックしてください。
echo.
pause
exit /b

:found
echo 「%NEW_ICON%」を新しいアイコンとして全てのフォルダに適用します...
echo.

:: コピー先の設定
set "ROOT_DIR=..\..\octopus2\"
set "REACT_PUBLIC=..\public\"

:: ROOT_DIR 用 (念のため従来版も更新)
copy /Y "%NEW_ICON%" "%ROOT_DIR%apple-touch-icon.png" >nul

:: REACT_PUBLIC 用 (本命)
copy /Y "%NEW_ICON%" "%REACT_PUBLIC%apple-touch-icon.png" >nul

echo ────────────────────────────────────────
echo 【完了】全自動でのアイコン差し替えが成功しました！！
echo ────────────────────────────────────────
echo ※次のデプロイ（deploy.bat の実行）から、新しいアイコンがサーバーに反映されます。
echo ※「%NEW_ICON%」の画像ファイルは、このフォルダにそのまま残しておいて大丈夫です。
echo.
pause
