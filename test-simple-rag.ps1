# 簡易RAG機能テスト用PowerShellスクリプト

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

# テスト用クエリ
$query = $args[0]
if (-not $query) {
    $query = Read-Host "検索クエリを入力してください"
}

# RAG処理の実行
Write-Host "簡易RAG処理を実行しています: '$query'" -ForegroundColor Cyan

# RAG処理を実行
node dist/test-simple-rag.js "$query"

if ($LASTEXITCODE -ne 0) {
    Write-Host "RAG処理の実行中にエラーが発生しました" -ForegroundColor Red
    exit 1
}

Write-Host "RAG処理が完了しました" -ForegroundColor Green 