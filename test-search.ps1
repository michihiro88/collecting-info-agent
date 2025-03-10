# 検索機能テスト用PowerShellスクリプト
# UTF-8で保存してください

<#
.SYNOPSIS
    情報収集エージェントの検索機能をテストするスクリプト

.DESCRIPTION
    Google検索プロバイダーのテストを実行します。
    注: Bing検索はマイクロソフト社により廃止されたため、サポートされなくなりました。

.PARAMETER Provider
    テストする検索プロバイダー（google, all）

.EXAMPLE
    ./test-search.ps1 -Provider google
    Googleプロバイダーのテストを実行します。

.EXAMPLE
    ./test-search.ps1
    すべての検索機能のテストを実行します。
#>

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("google", "all")]
    [string]$Provider = "all"
)

# テストパスの設定
$testPath = ""

switch ($Provider) {
    "google" {
        $testPath = "test/unit/search/providers/google-search.test.ts"
        Write-Host "Googleプロバイダーのテスト実行中..." -ForegroundColor Cyan
    }
    "all" {
        $testPath = "test/unit/search"
        Write-Host "すべての検索機能のテスト実行中..." -ForegroundColor Cyan
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