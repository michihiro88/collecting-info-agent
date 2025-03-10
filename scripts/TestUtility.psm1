# TestUtility.psm1
# テスト実行のための共通ユーティリティモジュール

# 色の定義
$COLORS = @{
    SUCCESS = 'Green'
    WARNING = 'Yellow'
    ERROR = 'Red'
    INFO = 'Cyan'
    NORMAL = 'White'
}

# ログレベルの定義
enum LogLevel {
    DEBUG = 0
    INFO = 1
    WARNING = 2
    ERROR = 3
}

# 現在のログレベル（環境変数から取得、デフォルトはINFO）
$script:CurrentLogLevel = [LogLevel]::INFO
if (![string]::IsNullOrEmpty($env:LOG_LEVEL)) {
    try {
        $script:CurrentLogLevel = [LogLevel]$env:LOG_LEVEL
    }
    catch {
        # デフォルト値を維持
    }
}

# テスト結果の保存先ディレクトリ
$TEST_RESULTS_DIR = Join-Path $PSScriptRoot '..' 'test-reports'

# ロギング関数
function Write-TestLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [LogLevel]$Level = [LogLevel]::INFO,
        
        [Parameter(Mandatory = $false)]
        [string]$Color = $COLORS.NORMAL,
        
        [Parameter(Mandatory = $false)]
        [switch]$NoNewLine
    )
    
    if ($Level -ge $script:CurrentLogLevel) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logPrefix = "[$timestamp][$Level]"
        
        if ($NoNewLine) {
            Write-Host "$logPrefix $Message" -ForegroundColor $Color -NoNewline
        }
        else {
            Write-Host "$logPrefix $Message" -ForegroundColor $Color
        }
    }
}

# 環境変数の読み込み関数
function Import-EnvFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$EnvFile = '.env'
    )
    
    # .envファイルの存在確認
    if (Test-Path $EnvFile) {
        # 環境変数の読み込み
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                # 環境変数の設定（ダブルクォート除去）
                if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                [Environment]::SetEnvironmentVariable($key, $value)
            }
        }
        Write-TestLog "環境変数を読み込みました: $EnvFile" -Level INFO -Color $COLORS.SUCCESS
        return $true
    }
    else {
        Write-TestLog "環境変数ファイルが見つかりません: $EnvFile" -Level ERROR -Color $COLORS.ERROR
        return $false
    }
}

# 依存パッケージの確認
function Test-Dependencies {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string[]]$RequiredCommands = @('node', 'npx')
    )
    
    $allDependenciesFound = $true
    
    foreach ($cmd in $RequiredCommands) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) {
            Write-TestLog "✓ $cmd が利用可能です" -Level DEBUG -Color $COLORS.SUCCESS
        }
        else {
            Write-TestLog "✗ $cmd が見つかりません" -Level ERROR -Color $COLORS.ERROR
            $allDependenciesFound = $false
        }
    }
    
    return $allDependenciesFound
}

# TypeScriptコードのコンパイル
function Invoke-TypeScriptCompile {
    [CmdletBinding()]
    param()
    
    Write-TestLog "TypeScriptをコンパイルしています..." -Level INFO -Color $COLORS.INFO
    
    try {
        $output = npx tsc 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-TestLog "コンパイルに失敗しました" -Level ERROR -Color $COLORS.ERROR
            Write-TestLog $output -Level ERROR
            return $false
        }
        Write-TestLog "コンパイル完了" -Level INFO -Color $COLORS.SUCCESS
        return $true
    }
    catch {
        Write-TestLog "コンパイル中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
        return $false
    }
}

# テスト結果の保存
function Save-TestResult {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TestName,
        
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Result
    )
    
    # 結果保存ディレクトリがなければ作成
    if (!(Test-Path -Path $TEST_RESULTS_DIR)) {
        New-Item -ItemType Directory -Path $TEST_RESULTS_DIR | Out-Null
    }
    
    # 現在のタイムスタンプ
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    
    # 結果ファイル名の生成
    $resultFileName = "$TestName-$timestamp.json"
    $resultFilePath = Join-Path $TEST_RESULTS_DIR $resultFileName
    
    # 結果にタイムスタンプとメタ情報を追加
    $Result | Add-Member -MemberType NoteProperty -Name 'timestamp' -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    $Result | Add-Member -MemberType NoteProperty -Name 'platform' -Value $env:OS
    $Result | Add-Member -MemberType NoteProperty -Name 'powershell_version' -Value $PSVersionTable.PSVersion.ToString()
    
    # JSONに変換して保存
    $Result | ConvertTo-Json -Depth 10 | Out-File -FilePath $resultFilePath -Encoding utf8
    
    Write-TestLog "テスト結果を保存しました: $resultFilePath" -Level INFO -Color $COLORS.SUCCESS
    
    return $resultFilePath
}

# テストレポートの生成
function New-TestReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [string]$OutputDir = $TEST_RESULTS_DIR,
        
        [Parameter(Mandatory = $false)]
        [string]$ReportName = "テスト実行サマリー",
        
        [Parameter(Mandatory = $false)]
        [switch]$IncludeAllResults = $false
    )
    
    # 結果ディレクトリの確認
    if (!(Test-Path -Path $OutputDir)) {
        Write-TestLog "テスト結果ディレクトリが見つかりません: $OutputDir" -Level ERROR -Color $COLORS.ERROR
        return $null
    }
    
    # 結果ファイルの取得
    $resultFiles = Get-ChildItem -Path $OutputDir -Filter "*.json" | Sort-Object LastWriteTime -Descending
    
    if ($resultFiles.Count -eq 0) {
        Write-TestLog "テスト結果ファイルが見つかりません" -Level WARNING -Color $COLORS.WARNING
        return $null
    }
    
    # レポート用のデータ準備
    $reportData = [PSCustomObject]@{
        report_name = $ReportName
        generated_at = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        total_tests = $resultFiles.Count
        success_count = 0
        failure_count = 0
        test_results = @()
    }
    
    # 各結果ファイルの処理
    foreach ($file in $resultFiles) {
        try {
            $testResult = Get-Content -Path $file.FullName -Raw | ConvertFrom-Json
            
            # 成功/失敗のカウント
            if ($testResult.success) {
                $reportData.success_count++
            }
            else {
                $reportData.failure_count++
            }
            
            # 詳細結果をレポートに追加（オプション）
            if ($IncludeAllResults) {
                $reportData.test_results += $testResult
            }
            else {
                # 要約情報のみ追加
                $reportData.test_results += [PSCustomObject]@{
                    test_name = $testResult.test_name
                    success = $testResult.success
                    timestamp = $testResult.timestamp
                    duration_ms = $testResult.duration_ms
                }
            }
        }
        catch {
            Write-TestLog "結果ファイルの解析エラー ($($file.Name)): $_" -Level WARNING -Color $COLORS.WARNING
        }
    }
    
    # レポートファイルの生成
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $reportFileName = "test-report-$timestamp.json"
    $reportFilePath = Join-Path $OutputDir $reportFileName
    
    # JSONに変換して保存
    $reportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFilePath -Encoding utf8
    
    Write-TestLog "テストレポートを生成しました: $reportFilePath" -Level INFO -Color $COLORS.SUCCESS
    
    # HTMLレポートも生成
    $htmlReportPath = $reportFilePath -replace '\.json$', '.html'
    $htmlContent = @"
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$($reportData.report_name)</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header {
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .summary {
            display: flex;
            margin-bottom: 20px;
        }
        .summary-item {
            flex: 1;
            padding: 15px;
            border-radius: 5px;
            margin-right: 10px;
            text-align: center;
        }
        .total {
            background-color: #e0e0e0;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
        }
        .failure {
            background-color: #f8d7da;
            color: #721c24;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            position: sticky;
            top: 0;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .success-row {
            background-color: #d4edda !important;
        }
        .failure-row {
            background-color: #f8d7da !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>$($reportData.report_name)</h1>
        <p>生成日時: $($reportData.generated_at)</p>
    </div>
    
    <div class="summary">
        <div class="summary-item total">
            <h2>合計テスト数</h2>
            <p>$($reportData.total_tests)</p>
        </div>
        <div class="summary-item success">
            <h2>成功</h2>
            <p>$($reportData.success_count)</p>
        </div>
        <div class="summary-item failure">
            <h2>失敗</h2>
            <p>$($reportData.failure_count)</p>
        </div>
    </div>
    
    <h2>テスト結果</h2>
    <table>
        <thead>
            <tr>
                <th>テスト名</th>
                <th>結果</th>
                <th>実行日時</th>
                <th>実行時間 (ms)</th>
            </tr>
        </thead>
        <tbody>
"@

    foreach ($result in $reportData.test_results) {
        # 三項演算子を使わずにif文で実装
        if ($result.success) {
            $rowClass = "success-row"
            $status = "成功"
        } else {
            $rowClass = "failure-row"
            $status = "失敗"
        }
        
        $htmlContent += @"
            <tr class="$rowClass">
                <td>$($result.test_name)</td>
                <td>$status</td>
                <td>$($result.timestamp)</td>
                <td>$($result.duration_ms)</td>
            </tr>
"@
    }

    $htmlContent += @"
        </tbody>
    </table>
</body>
</html>
"@

    $htmlContent | Out-File -FilePath $htmlReportPath -Encoding utf8
    Write-TestLog "HTMLレポートを生成しました: $htmlReportPath" -Level INFO -Color $COLORS.SUCCESS
    
    return [PSCustomObject]@{
        json_path = $reportFilePath
        html_path = $htmlReportPath
        report_data = $reportData
    }
}

# エクスポートする関数
Export-ModuleMember -Function Write-TestLog
Export-ModuleMember -Function Import-EnvFile
Export-ModuleMember -Function Test-Dependencies
Export-ModuleMember -Function Invoke-TypeScriptCompile
Export-ModuleMember -Function Save-TestResult
Export-ModuleMember -Function New-TestReport
Export-ModuleMember -Variable COLORS 