# テスト結果レポート生成スクリプト
param(
    [Parameter(Mandatory = $false)]
    [string]$OutputDir,
    
    [Parameter(Mandatory = $false)]
    [string]$ReportName = "テスト実行結果サマリー",
    
    [Parameter(Mandatory = $false)]
    [switch]$IncludeAllDetails,
    
    [Parameter(Mandatory = $false)]
    [switch]$OpenReport
)

# スクリプトディレクトリの取得
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# デフォルト出力ディレクトリの設定（パラメータで指定がない場合）
if (-not $OutputDir) {
    $OutputDir = Join-Path $RootDir "test-reports"
}

# ユーティリティモジュールのインポート
Import-Module (Join-Path $ScriptDir "TestUtility.psm1") -Force

# ヘッダー表示
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "        テスト結果レポート生成           " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog ""

# 出力ディレクトリの確認
if (!(Test-Path -Path $OutputDir)) {
    Write-TestLog "出力ディレクトリが存在しません: $OutputDir" -Level WARNING -Color $COLORS.WARNING
    Write-TestLog "ディレクトリを作成します..." -Color $COLORS.INFO
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# テスト結果ファイルの検索
$resultFiles = Get-ChildItem -Path $OutputDir -Filter "*.json" | 
    Where-Object { $_.Name -notlike "test-report-*" } | 
    Sort-Object LastWriteTime -Descending

if ($resultFiles.Count -eq 0) {
    Write-TestLog "テスト結果ファイルが見つかりません: $OutputDir" -Level WARNING -Color $COLORS.WARNING
    exit 1
}

Write-TestLog "テスト結果ファイルが見つかりました: $($resultFiles.Count)件" -Color $COLORS.SUCCESS

# 結果が1日以上前のものを警告
$oneDayAgo = (Get-Date).AddDays(-1)
$oldFiles = $resultFiles | Where-Object { $_.LastWriteTime -lt $oneDayAgo }
if ($oldFiles.Count -gt 0) {
    Write-TestLog "注意: $($oldFiles.Count)件のテスト結果ファイルは1日以上前のものです" -Level WARNING -Color $COLORS.WARNING
}

# レポート生成
try {
    Write-TestLog "レポートを生成しています..." -Color $COLORS.INFO
    
    # カスタムレポート名を作成（日付を含む）
    $dateStr = Get-Date -Format "yyyy-MM-dd"
    $customReportName = "$ReportName ($dateStr)"
    
    $report = New-TestReport -OutputDir $OutputDir -ReportName $customReportName -IncludeAllResults:$IncludeAllDetails
    
    if ($report) {
        Write-TestLog "レポートの生成が完了しました" -Color $COLORS.SUCCESS
        Write-TestLog "JSONレポート: $($report.json_path)" -Color $COLORS.SUCCESS
        Write-TestLog "HTMLレポート: $($report.html_path)" -Color $COLORS.SUCCESS
        
        # 成功率を計算して表示
        $successRate = 0
        if ($report.report_data.total_tests -gt 0) {
            $successRate = [math]::Round(($report.report_data.success_count / $report.report_data.total_tests) * 100, 2)
        }
        
        Write-TestLog "テスト結果サマリー:" -Color $COLORS.INFO
        Write-TestLog "- 合計テスト数: $($report.report_data.total_tests)" -Color $COLORS.INFO
        
        # 成功数の色分け
        if ($report.report_data.success_count -eq $report.report_data.total_tests) {
            Write-TestLog "- 成功: $($report.report_data.success_count) (100%)" -Color $COLORS.SUCCESS
        } else {
            Write-TestLog "- 成功: $($report.report_data.success_count) ($successRate%)" -Color $COLORS.INFO
        }
        
        # 失敗数の色分け
        if ($report.report_data.failure_count -gt 0) {
            Write-TestLog "- 失敗: $($report.report_data.failure_count)" -Color $COLORS.ERROR
        } else {
            Write-TestLog "- 失敗: 0" -Color $COLORS.SUCCESS
        }
        
        # HTMLレポートを開く
        if ($OpenReport -and (Test-Path $report.html_path)) {
            Write-TestLog "HTMLレポートを開いています..." -Color $COLORS.INFO
            Invoke-Item $report.html_path
        }
        
        # 成功率に応じた終了コード
        if ($successRate -eq 100) {
            exit 0
        } elseif ($successRate -ge 80) {
            exit 1  # 部分的成功
        } else {
            exit 2  # 多くの失敗
        }
    } else {
        Write-TestLog "レポートの生成に失敗しました" -Level ERROR -Color $COLORS.ERROR
        exit 3
    }
} catch {
    Write-TestLog "レポート生成中にエラーが発生しました: $_" -Level ERROR -Color $COLORS.ERROR
    Write-TestLog $_.ScriptStackTrace -Level ERROR
    exit 4
} 