#!/bin/bash

# AIモデルテストスクリプト
# このスクリプトはOpenAI、Anthropic、Google AIモデルのテストを実行します

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}      AIモデルテスト実行スクリプト      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# 環境変数のチェック
CHECK_ENV_VAR() {
  VAR_NAME=$1
  if [[ -z "${!VAR_NAME}" ]]; then
    echo -e "${YELLOW}警告: $VAR_NAME 環境変数が設定されていません。このモデルのテストはスキップされる可能性があります。${NC}"
    return 1
  else
    echo -e "${GREEN}✓ $VAR_NAME 環境変数が設定されています${NC}"
    return 0
  fi
}

# 必要な環境変数をチェック
echo "環境変数のチェック..."
OPENAI_OK=false
ANTHROPIC_OK=false
GOOGLE_OK=false

CHECK_ENV_VAR "OPENAI_API_KEY" && OPENAI_OK=true
CHECK_ENV_VAR "ANTHROPIC_API_KEY" && ANTHROPIC_OK=true
CHECK_ENV_VAR "GOOGLE_API_KEY" && GOOGLE_OK=true

echo

# テスト実行
echo -e "${BLUE}テストを実行します...${NC}"

# 特定のテストだけを実行するオプション
if [[ ! -z "$1" ]]; then
  TEST_PATTERN=$1
  echo -e "${YELLOW}テストパターン '$TEST_PATTERN' に一致するテストのみ実行します${NC}"
  echo
  npx jest --testPathPattern="$TEST_PATTERN" --verbose
  exit $?
fi

# すべてのモデルテストを実行
echo -e "${BLUE}すべてのモデルテストを実行します${NC}"

# 実行結果を保存する変数
OPENAI_RESULT=0
ANTHROPIC_RESULT=0
GOOGLE_RESULT=0

# OpenAIモデルテスト
echo -e "\n${BLUE}OpenAI モデルテスト:${NC}"
if [[ "$OPENAI_OK" == true ]]; then
  npx jest --testPathPattern="openai-model.test" --verbose
  OPENAI_RESULT=$?
else
  echo -e "${YELLOW}OpenAI APIキーが設定されていないため、一部のテストはスキップされます${NC}"
  npx jest --testPathPattern="openai-model.test" --verbose
  OPENAI_RESULT=$?
fi

# Anthropicモデルテスト
echo -e "\n${BLUE}Anthropic モデルテスト:${NC}"
if [[ "$ANTHROPIC_OK" == true ]]; then
  npx jest --testPathPattern="anthropic-model.test" --verbose
  ANTHROPIC_RESULT=$?
else
  echo -e "${YELLOW}Anthropic APIキーが設定されていないため、一部のテストはスキップされます${NC}"
  npx jest --testPathPattern="anthropic-model.test" --verbose
  ANTHROPIC_RESULT=$?
fi

# Googleモデルテスト
echo -e "\n${BLUE}Google モデルテスト:${NC}"
if [[ "$GOOGLE_OK" == true ]]; then
  npx jest --testPathPattern="google-model.test" --verbose
  GOOGLE_RESULT=$?
else
  echo -e "${YELLOW}Google APIキーが設定されていないため、一部のテストはスキップされます${NC}"
  npx jest --testPathPattern="google-model.test" --verbose
  GOOGLE_RESULT=$?
fi

# 結果のサマリー
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}            テスト結果サマリー           ${NC}"
echo -e "${BLUE}========================================${NC}"

if [[ $OPENAI_RESULT -eq 0 ]]; then
  echo -e "${GREEN}✓ OpenAI モデルテスト: 成功${NC}"
else
  echo -e "${RED}✗ OpenAI モデルテスト: 失敗 (コード: $OPENAI_RESULT)${NC}"
fi

if [[ $ANTHROPIC_RESULT -eq 0 ]]; then
  echo -e "${GREEN}✓ Anthropic モデルテスト: 成功${NC}"
else
  echo -e "${RED}✗ Anthropic モデルテスト: 失敗 (コード: $ANTHROPIC_RESULT)${NC}"
fi

if [[ $GOOGLE_RESULT -eq 0 ]]; then
  echo -e "${GREEN}✓ Google モデルテスト: 成功${NC}"
else
  echo -e "${RED}✗ Google モデルテスト: 失敗 (コード: $GOOGLE_RESULT)${NC}"
fi

# 全体の結果
if [[ $OPENAI_RESULT -eq 0 && $ANTHROPIC_RESULT -eq 0 && $GOOGLE_RESULT -eq 0 ]]; then
  echo -e "\n${GREEN}すべてのテストが成功しました！${NC}"
  exit 0
else
  echo -e "\n${RED}一部のテストが失敗しました。詳細は上記の出力を確認してください。${NC}"
  exit 1
fi 