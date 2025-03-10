# プロセッサー統合テスト用PowerShellスクリプト
# UTF-8で保存してください

<#
.SYNOPSIS
    情報収集エージェントのプロセッサー統合機能をテストするスクリプト

.DESCRIPTION
    コンテンツプロセッサー統合とRAG機能のテストを実行します。

.PARAMETER Target
    テスト対象（integration, all）

.EXAMPLE
    ./test-processors-integration.ps1 -Target integration
    統合機能のテストのみを実行します。

.EXAMPLE
    ./test-processors-integration.ps1
    すべてのプロセッサー統合関連テストを実行します。
#>

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("integration", "all")]
    [string]$Target = "all"
)

# テストパスの設定
$testPath = ""

switch ($Target) {
    "integration" {
        $testPath = "test/unit/processors/integration"
        Write-Host "プロセッサー統合テストを実行中..." -ForegroundColor Cyan
    }
    "all" {
        $testPath = "test/unit/processors"
        Write-Host "すべてのプロセッサーテストを実行中..." -ForegroundColor Cyan
    }
}

# テスト実行
try {
    npm test -- $testPath
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "テスト成功！" -ForegroundColor Green
    } else {
        Write-Host "テスト失敗。終了コード: $exitCode" -ForegroundColor Red
    }
    
    exit $exitCode
} catch {
    Write-Host "テスト実行中にエラーが発生しました: $_" -ForegroundColor Red
    exit 1
} 