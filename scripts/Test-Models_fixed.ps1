# AIモデルテストスクリプト（改良版）
param (
    [Parameter(Mandatory = $false)]
    [ValidateSet("openai", "anthropic", "google", "all")]
    [string]$Provider = "all",
    
    [Parameter(Mandatory = $false)]
    [switch]$SaveResults,
    
    [Parameter(Mandatory = $false)]
    [switch]$GenerateReport
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
Write-TestLog "          AIモデルテスト実行            " -Color $COLORS.INFO
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

# ビルド
$compileSuccess = Invoke-TypeScriptCompile
if (-not $compileSuccess) {
    Write-TestLog "TypeScriptのコンパイルに失敗しました。エラーを修正してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# APIキー設定確認
function Check-ApiKey {
    param(
        [string]$EnvVarName,
        [string]$ProviderName
    )
    
    if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($EnvVarName))) {
        Write-TestLog "$ProviderName`: APIキーが設定されていません ($EnvVarName)" -Level WARNING -Color $COLORS.WARNING
        return $false
    } else {
        Write-TestLog "$ProviderName`: APIキーが設定されています" -Color $COLORS.SUCCESS
        return $true
    }
}

# 各プロバイダのAPIキー確認
$openaiApiOk = Check-ApiKey -EnvVarName "OPENAI_API_KEY" -ProviderName "OpenAI"
$anthropicApiOk = Check-ApiKey -EnvVarName "ANTHROPIC_API_KEY" -ProviderName "Anthropic"
$googleApiOk = Check-ApiKey -EnvVarName "GOOGLE_API_KEY" -ProviderName "Google"

Write-TestLog ""

# テスト実行関数
function Invoke-ModelTest {
    param(
        [string]$TestPattern,
        [string]$ProviderName,
        [bool]$ApiKeySet
    )
    
    if (($Provider -eq "all" -or $Provider -eq $TestPattern) -and $ApiKeySet) {
        Write-TestLog "$ProviderName`モデルのテストを実行しています..." -Color $COLORS.INFO
        
        try {
            $testStartTime = Get-Date
            $output = npx jest --testPathPattern="$TestPattern" --verbose 2>&1
            $exitCode = $LASTEXITCODE
            $testEndTime = Get-Date
            $duration = $testEndTime - $testStartTime
            $durationMs = [math]::Round($duration.TotalMilliseconds)
            
            if ($exitCode -eq 0) {
                Write-TestLog "$ProviderName`モデルのテストが成功しました（所要時間: $($duration.TotalSeconds)秒）" -Color $COLORS.SUCCESS
                
                if ($SaveResults) {
                    $testResult = [PSCustomObject]@{
                        test_name = "$ProviderName`モデルテスト"
                        success = $true
                        duration_ms = $durationMs
                        stdout = $output
                    }
                    
                    Save-TestResult -TestName "$TestPattern-test" -Result $testResult
                }
                
                return $true
            } else {
                Write-TestLog "$ProviderName`モデルのテストが失敗しました（終了コード: $exitCode、所要時間: $($duration.TotalSeconds)秒）" -Level ERROR -Color $COLORS.ERROR
                
                if ($SaveResults) {
                    $testResult = [PSCustomObject]@{
                        test_name = "$ProviderName`モデルテスト"
                        success = $false
                        exit_code = $exitCode
                        duration_ms = $durationMs
                        stdout = $output
                    }
                    
                    Save-TestResult -TestName "$TestPattern-test" -Result $testResult
                }
                
                return $false
            }
        } catch {
            Write-TestLog "$ProviderName`モデルのテスト実行中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
            
            if ($SaveResults) {
                $testResult = [PSCustomObject]@{
                    test_name = "$ProviderName`モデルテスト"
                    success = $false
                    error = $_.ToString()
                    duration_ms = 0
                }
                
                Save-TestResult -TestName "$TestPattern-test" -Result $testResult
            }
            
            return $false
        }
    } else {
        if ($Provider -ne "all" -and $Provider -ne $TestPattern) {
            # 特定のプロバイダーが指定され、このテストは対象外
            return $true
        } elseif (-not $ApiKeySet) {
            Write-TestLog "$ProviderName`モデルのテストをスキップします（APIキーが設定されていません）" -Level WARNING -Color $COLORS.WARNING
            
            if ($SaveResults) {
                $testResult = [PSCustomObject]@{
                    test_name = "$ProviderName`モデルテスト"
                    success = $false
                    skipped = $true
                    reason = "APIキーが設定されていません"
                    duration_ms = 0
                }
                
                Save-TestResult -TestName "$TestPattern-test" -Result $testResult
            }
            
            return $true  # スキップはエラーとして扱わない
        }
    }
}

# テスト実行
$openaiSuccess = Invoke-ModelTest -TestPattern "openai" -ProviderName "OpenAI" -ApiKeySet $openaiApiOk
$anthropicSuccess = Invoke-ModelTest -TestPattern "anthropic" -ProviderName "Anthropic" -ApiKeySet $anthropicApiOk
$googleSuccess = Invoke-ModelTest -TestPattern "google" -ProviderName "Google" -ApiKeySet $googleApiOk

# 結果サマリー
Write-TestLog ""
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "            テスト結果サマリー           " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO

function Write-TestResult {
    param(
        [string]$ProviderName,
        [bool]$Success,
        [bool]$ApiKeySet
    )
    
    if (-not $ApiKeySet) {
        Write-TestLog "$ProviderName`: スキップ（APIキーなし）" -Level WARNING -Color $COLORS.WARNING
    } elseif ($Success) {
        Write-TestLog "$ProviderName`: 成功" -Color $COLORS.SUCCESS
    } else {
        Write-TestLog "$ProviderName`: 失敗" -Level ERROR -Color $COLORS.ERROR
    }
}

Write-TestResult -ProviderName "OpenAI" -Success $openaiSuccess -ApiKeySet $openaiApiOk
Write-TestResult -ProviderName "Anthropic" -Success $anthropicSuccess -ApiKeySet $anthropicApiOk
Write-TestResult -ProviderName "Google" -Success $googleSuccess -ApiKeySet $googleApiOk

# 全体の結果
$allSuccess = $openaiSuccess -and $anthropicSuccess -and $googleSuccess

# 終了時間とかかった時間
$endTime = Get-Date
$duration = $endTime - $startTime
Write-TestLog "テスト実行時間: $($duration.TotalSeconds)秒" -Color $COLORS.INFO

# レポート生成（オプション）
if ($GenerateReport) {
    Write-TestLog ""
    Write-TestLog "テスト結果レポートを生成しています..." -Color $COLORS.INFO
    
    & (Join-Path $ScriptDir "Generate-TestReport.ps1") -OpenReport
}

# 終了コード
if ($allSuccess) {
    Write-TestLog "すべてのテストが成功しました！" -Color $COLORS.SUCCESS
    exit 0
} else {
    Write-TestLog "いくつかのテストが失敗しました。詳細は上記を確認してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
} 
