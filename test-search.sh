#!/bin/bash

# 検索機能テスト用シェルスクリプト
# 注: Bing検索はマイクロソフト社により廃止されたため、サポートされなくなりました。

# 使用法の表示
function show_usage {
  echo "使用法: $0 [options]"
  echo "オプション:"
  echo "  -p, --provider <provider>  テストする検索プロバイダー (google, all) [デフォルト: all]"
  echo "  -h, --help                 このヘルプメッセージを表示"
  echo ""
  echo "例:"
  echo "  $0 --provider google     # Googleプロバイダーのテストを実行"
  echo "  $0                       # すべての検索機能のテストを実行"
}

# 引数解析
PROVIDER="all"

while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--provider)
      PROVIDER="$2"
      shift 2
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "不明なオプション: $1"
      show_usage
      exit 1
      ;;
  esac
done

# プロバイダーの検証
if [[ ! "$PROVIDER" =~ ^(google|all)$ ]]; then
  echo "エラー: プロバイダーは 'google' または 'all' のいずれかでなければなりません。"
  exit 1
fi

# テストパスの設定
TEST_PATH=""

case $PROVIDER in
  "google")
    TEST_PATH="test/unit/search/providers/google-search.test.ts"
    echo -e "\033[0;36mGoogleプロバイダーのテスト実行中...\033[0m"
    ;;
  "all")
    TEST_PATH="test/unit/search"
    echo -e "\033[0;36mすべての検索機能のテスト実行中...\033[0m"
    ;;
esac

# テスト実行
npm test -- $TEST_PATH
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "\033[0;32mテスト成功！\033[0m"
else
  echo -e "\033[0;31mテスト失敗。終了コード: $EXIT_CODE\033[0m"
fi

exit $EXIT_CODE 