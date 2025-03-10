# シンプルなテスト実行スクリプト
Write-Host "テスト実行を開始します..."
Write-Host "-----------------------------"

# テスト実行ディレクトリの作成
$testReportDir = Join-Path $PSScriptRoot ".." "test-reports"
if (-not (Test-Path $testReportDir)) {
    Write-Host "テスト結果ディレクトリを作成します: $testReportDir"
    New-Item -ItemType Directory -Path $testReportDir | Out-Null
}

# 環境変数の確認
$envFile = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "環境変数ファイル (.env) が見つかりません。テストが失敗する可能性があります。" -ForegroundColor Yellow
}

# 単体テスト実行関数
function Run-UnitTests {
    Write-Host "単体テストを実行中..." -ForegroundColor Cyan
    try {
        $startTime = Get-Date
        $tempFile = [System.IO.Path]::GetTempFileName()
        
        # テストコマンド実行
        Start-Process -FilePath "npx" -ArgumentList "jest", "--testPathPattern=`"^(?!.*e2e).*$`"" -NoNewWindow -Wait -RedirectStandardOutput $tempFile
        $exitCode = $LASTEXITCODE
        
        # 結果取得
        $output = Get-Content -Path $tempFile -Raw -ErrorAction SilentlyContinue
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        # 結果表示
        if ($exitCode -eq 0) {
            Write-Host "単体テスト成功！ (所要時間: $($duration.TotalSeconds)秒)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "単体テスト失敗 (所要時間: $($duration.TotalSeconds)秒)" -ForegroundColor Red
            Write-Host "エラー詳細:" -ForegroundColor Red
            Write-Host $output
            return $false
        }
    } catch {
        Write-Host "単体テスト実行中にエラーが発生しました: $_" -ForegroundColor Red
        return $false
    }
}

# テスト結果を保存
function Save-TestResults {
    param (
        [string]$TestName,
        [bool]$Success,
        [string]$Output = ""
    )
    
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $resultFile = Join-Path $testReportDir "$TestName-$timestamp.json"
    
    $result = @{
        test_name = $TestName
        success = $Success
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        output = $Output
    } | ConvertTo-Json
    
    $result | Out-File -FilePath $resultFile -Encoding utf8
    Write-Host "テスト結果を保存しました: $resultFile" -ForegroundColor Cyan
}

# メイン実行部分
$overallSuccess = $true

# 単体テスト実行
$unitTestSuccess = Run-UnitTests
Save-TestResults -TestName "unit-tests" -Success $unitTestSuccess
if (-not $unitTestSuccess) {
    $overallSuccess = $false
}

# 結果表示
Write-Host "-----------------------------"
if ($overallSuccess) {
    Write-Host "すべてのテストが成功しました！" -ForegroundColor Green
    exit 0
} else {
    Write-Host "テストが失敗しました。詳細は上記を確認してください。" -ForegroundColor Red
    exit 1
} 