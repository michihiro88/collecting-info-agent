#!/bin/bash
# コンテンツプロセッサーテスト実行スクリプト
#
# 使用方法:
#   ./test-processors.sh [processor-type]
#
# 引数:
#   processor-type: テストするプロセッサータイプ（html, pdf, ai, all）
#
# 例：
#   ./test-processors.sh html  # HTMLプロセッサーのみテスト
#   ./test-processors.sh all   # すべてのプロセッサーをテスト

# デフォルト値設定
PROCESSOR_TYPE=${1:-all}

# テスト対象のパスを設定
TEST_PATTERN=""

case "${PROCESSOR_TYPE,,}" in
    "html")
        TEST_PATTERN="test/unit/processors/html"
        echo "HTMLプロセッサーのテストを実行します..."
        ;;
    "pdf")
        TEST_PATTERN="test/unit/processors/pdf"
        echo "PDFプロセッサーのテストを実行します..."
        ;;
    "ai")
        TEST_PATTERN="test/unit/processors/ai"
        echo "AI要約プロセッサーのテストを実行します..."
        ;;
    "all")
        TEST_PATTERN="test/unit/processors"
        echo "すべてのコンテンツプロセッサーのテストを実行します..."
        ;;
    *)
        echo "エラー: 無効なプロセッサータイプです。html, pdf, ai, または all を指定してください。"
        exit 1
        ;;
esac

# テスト実行
npm test -- $TEST_PATTERN
TEST_RESULT=$?

# 終了ステータスを確認
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "\e[32mテスト成功: すべてのテストが正常に完了しました。\e[0m"
else
    echo -e "\e[31mテスト失敗: いくつかのテストが失敗しました。\e[0m"
fi

exit $TEST_RESULT 