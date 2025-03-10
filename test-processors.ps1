# コンテンツプロセッサーテスト実行スクリプト
#
# 使用方法:
#   .\test-processors.ps1 [processor-type]
#
# 引数:
#   processor-type: テストするプロセッサータイプ（html, pdf, ai, all）
#
# 例：
#   .\test-processors.ps1 html  # HTMLプロセッサーのみテスト
#   .\test-processors.ps1 all   # すべてのプロセッサーをテスト

param(
    [string]$processorType = "all"
)

# テスト対象のパスを設定
$testPattern = ""

switch ($processorType.ToLower()) {
    "html" {
        $testPattern = "test/unit/processors/html"
        Write-Host "HTMLプロセッサーのテストを実行します..."
    }
    "pdf" {
        $testPattern = "test/unit/processors/pdf"
        Write-Host "PDFプロセッサーのテストを実行します..."
    }
    "ai" {
        $testPattern = "test/unit/processors/ai"
        Write-Host "AI要約プロセッサーのテストを実行します..."
    }
    "all" {
        $testPattern = "test/unit/processors"
        Write-Host "すべてのコンテンツプロセッサーのテストを実行します..."
    }
    default {
        Write-Host "エラー: 無効なプロセッサータイプです。html, pdf, ai, または all を指定してください。"
        exit 1
    }
}

# テスト実行
npm test -- $testPattern

# 終了ステータスを確認
if ($LASTEXITCODE -eq 0) {
    Write-Host "テスト成功: すべてのテストが正常に完了しました。" -ForegroundColor Green
} else {
    Write-Host "テスト失敗: いくつかのテストが失敗しました。" -ForegroundColor Red
}

exit $LASTEXITCODE 