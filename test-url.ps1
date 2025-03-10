# URL処理テスト用PowerShellスクリプト

# 環境変数の読み込み
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value)
        }
    }
    Write-Host "環境変数を読み込みました" -ForegroundColor Green
} else {
    Write-Host ".envファイルが見つかりません。.env.sampleをコピーして設定してください。" -ForegroundColor Red
    exit 1
}

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

# モデル名（オプション）
$modelName = $args[1]

# URL処理の実行
Write-Host "URL処理を実行しています: '$url'" -ForegroundColor Cyan
if ($modelName) {
    Write-Host "モデル: $modelName" -ForegroundColor Cyan
} else {
    Write-Host "モデル: デフォルト" -ForegroundColor Cyan
}

try {
    # URL処理を実行
    if ($modelName) {
        node dist/test-url.js "$url" $modelName
    } else {
        node dist/test-url.js "$url"
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "URL処理の実行中にエラーが発生しました" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "URL処理が完了しました" -ForegroundColor Green
} catch {
    Write-Host "エラーが発生しました: $_" -ForegroundColor Red
    exit 1
} 
