# 設定ファイルテスト用PowerShellスクリプト

# ビルド
Write-Host "TypeScriptをコンパイルしています..." -ForegroundColor Cyan
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "コンパイルに失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "コンパイル完了" -ForegroundColor Green

# 設定ファイルテストの実行
Write-Host "設定ファイルテストを実行しています..." -ForegroundColor Cyan

try {
    # 設定ファイルテストを実行
    node dist/test-config.js
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "設定ファイルテストの実行中にエラーが発生しました" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "設定ファイルテストが完了しました" -ForegroundColor Green
} catch {
    Write-Host "エラーが発生しました" -ForegroundColor Red
    exit 1
} 