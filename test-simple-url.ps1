# 簡易URL処理テスト用PowerShellスクリプト

# ビルド
Write-Host "TypeScriptをコンパイルしています..." -ForegroundColor Cyan
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "コンパイルに失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "コンパイル完了" -ForegroundColor Green

# テスト用URL
$url = $args[0]
if (-not $url) {
    $url = Read-Host "処理するURLを入力してください"
}

# URL処理の実行
Write-Host "URL処理を実行しています: '$url'" -ForegroundColor Cyan

try {
    # URL処理を実行
    node dist/test-simple-url.js "$url"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "URL処理の実行中にエラーが発生しました" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "URL処理が完了しました" -ForegroundColor Green
} catch {
    Write-Host "エラーが発生しました" -ForegroundColor Red
    exit 1
} 