# RAG機能テスト用PowerShellスクリプト（改良版）
param (
    [Parameter(Mandatory = $false)]
    [string]$Query,
    
    [Parameter(Mandatory = $false)]
    [string]$Model,
    
    [Parameter(Mandatory = $false)]
    [switch]$SaveResults
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
Write-TestLog "          RAG機能テスト実行              " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog ""

# 環境変数の読み込み
$envLoaded = Import-EnvFile (Join-Path $RootDir ".env")
if (-not $envLoaded) {
    Write-TestLog ".envファイルが見つかりません。.env.sampleをコピーして設定してください。" -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# 依存関係の確認
$dependenciesOk = Test-Dependencies
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

# テスト用クエリ
if (-not $Query) {
    $Query = Read-Host "検索クエリを入力してください"
}

# モデル名（オプション）
if ($Model) {
    Write-TestLog "使用モデル: $Model" -Color $COLORS.INFO
} else {
    Write-TestLog "使用モデル: デフォルト" -Color $COLORS.INFO
}

# プラットフォームに応じたNode実行コマンド
$nodeCmd = "node"
if ($IsWindows) {
    # Windowsの場合は追加の設定が必要ならここで
} elseif ($IsLinux -or $IsMacOS) {
    # LinuxまたはMacの場合は追加の設定が必要ならここで
}

# RAG処理の実行
Write-TestLog "RAG処理を実行しています: '$Query'" -Color $COLORS.INFO

try {
    # 開始時間
    $startTime = Get-Date

    # コマンド実行
    if ($Model) {
        $process = Start-Process -FilePath $nodeCmd -ArgumentList "dist/test-rag.js", "`"$Query`"", $Model -NoNewWindow -PassThru -RedirectStandardOutput "temp_output.txt" -RedirectStandardError "temp_error.txt"
    } else {
        $process = Start-Process -FilePath $nodeCmd -ArgumentList "dist/test-rag.js", "`"$Query`"" -NoNewWindow -PassThru -RedirectStandardOutput "temp_output.txt" -RedirectStandardError "temp_error.txt"
    }

    # プロセスの完了を待機（タイムアウトを設定）
    $timeoutSeconds = 180
    $processCompleted = $process.WaitForExit($timeoutSeconds * 1000)

    # 完了時間とかかった時間
    $endTime = Get-Date
    $duration = $endTime - $startTime
    $durationMs = [math]::Round($duration.TotalMilliseconds)

    # 標準出力と標準エラー出力を取得
    $stdout = Get-Content "temp_output.txt" -Raw
    $stderr = Get-Content "temp_error.txt" -Raw

    # 一時ファイルを削除
    Remove-Item "temp_output.txt" -ErrorAction SilentlyContinue
    Remove-Item "temp_error.txt" -ErrorAction SilentlyContinue

    # プロセスがタイムアウトした場合
    if (-not $processCompleted) {
        try {
            $process.Kill()
        } catch {
            # プロセス終了のエラーは無視
        }
        Write-TestLog "RAG処理がタイムアウトしました（$timeoutSeconds秒）" -Level ERROR -Color $COLORS.ERROR
        
        # テスト結果の記録
        if ($SaveResults) {
            $testResult = [PSCustomObject]@{
                test_name = "RAG処理"
                query = $Query
                model = $Model
                success = $false
                error = "タイムアウト"
                duration_ms = $durationMs
                stdout = $stdout
                stderr = $stderr
            }
            
            Save-TestResult -TestName "rag-test" -Result $testResult
        }
        exit 1
    }

    # プロセスの終了コードを確認
    if ($process.ExitCode -eq 0) {
        Write-TestLog "RAG処理が完了しました（所要時間: $($duration.TotalSeconds)秒）" -Color $COLORS.SUCCESS
        
        # 標準出力を表示
        if ($stdout) {
            Write-TestLog "--- 実行結果 ---" -Color $COLORS.INFO
            Write-Host $stdout
            Write-TestLog "---------------" -Color $COLORS.INFO
        }
        
        # テスト結果の記録
        if ($SaveResults) {
            $testResult = [PSCustomObject]@{
                test_name = "RAG処理"
                query = $Query
                model = $Model
                success = $true
                duration_ms = $durationMs
                stdout = $stdout
                stderr = $stderr
            }
            
            Save-TestResult -TestName "rag-test" -Result $testResult
        }
        exit 0
    } else {
        Write-TestLog "RAG処理の実行中にエラーが発生しました（終了コード: $($process.ExitCode)）" -Level ERROR -Color $COLORS.ERROR
        
        # エラー出力があれば表示
        if ($stderr) {
            Write-TestLog "--- エラー内容 ---" -Level ERROR -Color $COLORS.ERROR
            Write-Host $stderr
            Write-TestLog "----------------" -Level ERROR -Color $COLORS.ERROR
        }
        
        # テスト結果の記録
        if ($SaveResults) {
            $testResult = [PSCustomObject]@{
                test_name = "RAG処理"
                query = $Query
                model = $Model
                success = $false
                error = $stderr
                exit_code = $process.ExitCode
                duration_ms = $durationMs
                stdout = $stdout
                stderr = $stderr
            }
            
            Save-TestResult -TestName "rag-test" -Result $testResult
        }
        exit $process.ExitCode
    }
} catch {
    $endTime = Get-Date
    $duration = $endTime - $startTime
    $durationMs = [math]::Round($duration.TotalMilliseconds)
    
    Write-TestLog "エラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
    
    # テスト結果の記録
    if ($SaveResults) {
        $testResult = [PSCustomObject]@{
            test_name = "RAG処理"
            query = $Query
            model = $Model
            success = $false
            error = $_.ToString()
            duration_ms = $durationMs
        }
        
        Save-TestResult -TestName "rag-test" -Result $testResult
    }
    exit 1
} 
