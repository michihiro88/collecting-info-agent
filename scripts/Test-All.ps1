# すべてのテストを実行するためのメインスクリプト
param (
    [Parameter(Mandatory = $false)]
    [switch]$SaveResults,
    
    [Parameter(Mandatory = $false)]
    [switch]$GenerateReport,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipRagTest,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipModelTest,
    
    [Parameter(Mandatory = $false)]
    [switch]$OpenReport
)

# スクリプトディレクトリの取得
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# ユーティリティモジュールのインポート
Import-Module (Join-Path $ScriptDir "TestUtility.psm1") -Force

# スクリプト開始
$startTime = Get-Date

# ヘッダー表示
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "        テストスイート実行開始          " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog ""

# 環境変数の読み込み
$envLoaded = Import-EnvFile (Join-Path $RootDir ".env")
if (-not $envLoaded) {
    Write-TestLog ".envファイルが見つかりません。.env.sampleをコピーして設定してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# 依存関係の確認
$dependenciesOk = Test-Dependencies -RequiredCommands @('node', 'npx', 'jest')
if (-not $dependenciesOk) {
    Write-TestLog "必要な依存パッケージが見つかりません。インストールを確認してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# TypeScriptコンパイル
$compileSuccess = Invoke-TypeScriptCompile
if (-not $compileSuccess) {
    Write-TestLog "TypeScriptのコンパイルに失敗しました。エラーを修正してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# テスト結果追跡
$allTestsPass = $true
$totalTests = 0
$passedTests = 0
$failedTests = 0
$skippedTests = 0

# 単体テスト実行
Write-TestLog "単体テストを実行中..." -Color $COLORS.INFO
try {
    $testStartTime = Get-Date
    
    # 標準エラー出力を標準出力にリダイレクト
    $output = npx jest --testPathPattern="^(?!.*e2e).*$" 2>$null
    $exitCode = $LASTEXITCODE
    
    $testEndTime = Get-Date
    $duration = $testEndTime - $testStartTime
    $durationMs = [math]::Round($duration.TotalMilliseconds)
    
    if ($exitCode -eq 0) {
        Write-TestLog "単体テストが成功しました（所要時間: $($duration.TotalSeconds)秒）" -Color $COLORS.SUCCESS
        $passedTests++
    } else {
        Write-TestLog "単体テストが失敗しました（所要時間: $($duration.TotalSeconds)秒）" -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
    }
    
    if ($SaveResults) {
        $testResult = [PSCustomObject]@{
            test_name = "単体テスト"
            success = ($exitCode -eq 0)
            exit_code = $exitCode
            duration_ms = $durationMs
            stdout = $output
        }
        
        Save-TestResult -TestName "unit-tests" -Result $testResult
    }
    
    $totalTests++
} catch {
    Write-TestLog "単体テスト実行中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
    $allTestsPass = $false
    $failedTests++
    $totalTests++
    
    if ($SaveResults) {
        $testResult = [PSCustomObject]@{
            test_name = "単体テスト"
            success = $false
            error = $_.ToString()
            duration_ms = 0
        }
        
        Save-TestResult -TestName "unit-tests" -Result $testResult
    }
}

Write-TestLog ""

# RAGテスト実行（オプション）
if (-not $SkipRagTest) {
    Write-TestLog "RAG機能テストを実行中..." -Color $COLORS.INFO
    
    try {
        $testStartTime = Get-Date
        $ragParams = @{
            SaveResults = $SaveResults
        }
        
        & (Join-Path $ScriptDir "Test-Rag.ps1") @ragParams
        $exitCode = $LASTEXITCODE
        $testEndTime = Get-Date
        $duration = $testEndTime - $testStartTime
        
        if ($exitCode -eq 0) {
            Write-TestLog "RAG機能テストが成功しました（所要時間: $($duration.TotalSeconds)秒）" -Color $COLORS.SUCCESS
            $passedTests++
        } else {
            Write-TestLog "RAG機能テストが失敗しました（所要時間: $($duration.TotalSeconds)秒）" -Level ERROR -Color $COLORS.ERROR
            $allTestsPass = $false
            $failedTests++
        }
        
        $totalTests++
    } catch {
        Write-TestLog "RAG機能テスト実行中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
        $totalTests++
    }
    
    Write-TestLog ""
} else {
    Write-TestLog "RAG機能テストはスキップされました" -Level WARNING -Color $COLORS.WARNING
    $skippedTests++
    Write-TestLog ""
}

# AIモデルテスト実行（オプション）
if (-not $SkipModelTest) {
    Write-TestLog "AIモデルテストを実行中..." -Color $COLORS.INFO
    
    try {
        $testStartTime = Get-Date
        $modelParams = @{
            Provider = "all"
        }
        
        if ($SaveResults) {
            $modelParams.Add("SaveResults", $true)
        }
        
        & (Join-Path $ScriptDir "Test-Models.ps1") @modelParams
        $exitCode = $LASTEXITCODE
        $testEndTime = Get-Date
        $duration = $testEndTime - $testStartTime
        
        if ($exitCode -eq 0) {
            Write-TestLog "AIモデルテストが成功しました（所要時間: $($duration.TotalSeconds)秒）" -Color $COLORS.SUCCESS
            $passedTests++
        } else {
            Write-TestLog "AIモデルテストが失敗しました（所要時間: $($duration.TotalSeconds)秒）" -Level ERROR -Color $COLORS.ERROR
            $allTestsPass = $false
            $failedTests++
        }
        
        $totalTests++
    } catch {
        Write-TestLog "AIモデルテスト実行中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
        $totalTests++
    }
    
    Write-TestLog ""
} else {
    Write-TestLog "AIモデルテストはスキップされました" -Level WARNING -Color $COLORS.WARNING
    $skippedTests++
    Write-TestLog ""
}

# 結果サマリー
$endTime = Get-Date
$totalDuration = $endTime - $startTime

Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "           テスト結果サマリー           " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "総実行時間: $($totalDuration.TotalSeconds)秒" -Color $COLORS.INFO
Write-TestLog "合計テスト数: $totalTests" -Color $COLORS.INFO
Write-TestLog "成功: $passedTests" -Color $COLORS.SUCCESS
Write-TestLog "失敗: $failedTests" -Color (if ($failedTests -gt 0) { $COLORS.ERROR } else { $COLORS.INFO })
Write-TestLog "スキップ: $skippedTests" -Color (if ($skippedTests -gt 0) { $COLORS.WARNING } else { $COLORS.INFO })
Write-TestLog "成功率: $(if ($totalTests -gt 0) { [math]::Round(($passedTests / ($totalTests - $skippedTests)) * 100, 2) } else { 0 })%" -Color $COLORS.INFO

# レポート生成（オプション）
if ($GenerateReport) {
    Write-TestLog ""
    Write-TestLog "テスト結果レポートを生成しています..." -Color $COLORS.INFO
    
    $reportParams = @{}
    
    if ($OpenReport) {
        $reportParams.Add("OpenReport", $true)
    }
    
    & (Join-Path $ScriptDir "Generate-TestReport.ps1") @reportParams
}

# 終了コード
if ($allTestsPass) {
    Write-TestLog "すべてのテストが成功しました！" -Color $COLORS.SUCCESS
    exit 0
} else {
    Write-TestLog "いくつかのテストが失敗しました。詳細は上記を確認してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
} 