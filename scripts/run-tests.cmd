@echo off
echo テスト実行を開始します...
echo -----------------------------

rem テスト実行ディレクトリの作成
if not exist "..\test-reports" mkdir "..\test-reports"

rem 単体テスト実行
echo 単体テストを実行中...
npx jest --testPathPattern="^(?!.*e2e).*$" > ..\test-reports\unit-test-results.txt 2>&1
if %ERRORLEVEL% == 0 (
    echo 単体テスト：成功
) else (
    echo 単体テスト：失敗
    echo エラーの詳細は ..\test-reports\unit-test-results.txt を確認してください
    set overall_success=false
)

echo -----------------------------
if not defined overall_success (
    echo すべてのテストが成功しました！
    exit /b 0
) else (
    echo テストが失敗しました。詳細は上記とログファイルを確認してください。
    exit /b 1
) 