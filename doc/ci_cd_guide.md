# CI/CD 環境でのテスト自動化ガイド

このドキュメントでは、情報収集エージェントプロジェクトのCI/CD環境におけるテスト自動化の設定方法と運用ガイドラインを説明します。

## 1. テスト自動化の概要

### 1.1 テスト自動化の目的

- 継続的な品質保証
- リグレッションの早期発見
- リリースプロセスの効率化
- 多言語実装（TypeScript, Python, Rust, Go）間の一貫性確保

### 1.2 自動化されるテスト種別

- **単体テスト**: 各コンポーネントの個別機能テスト
- **統合テスト**: コンポーネント間の連携テスト
- **カバレッジ分析**: コードカバレッジの測定と報告
- **静的解析**: リンター、型チェック
- **クロスプラットフォームテスト**: 異なるOS環境でのテスト

## 2. テスト実行スクリプト

### 2.1 PowerShellスクリプト（Windows環境）

```powershell
# test-all.ps1
$ErrorActionPreference = "Stop"

# 環境準備
Write-Host "環境変数を設定中..." -ForegroundColor Green
$env:NODE_ENV = "test"
$env:LOG_LEVEL = "error"

# 単体テスト実行
Write-Host "単体テストを実行中..." -ForegroundColor Green
npm run test:unit

# 統合テスト実行（オプション）
if ($args[0] -eq "full") {
    Write-Host "統合テストを実行中..." -ForegroundColor Green
    npm run test:integration
}

# カバレッジレポート生成
Write-Host "カバレッジレポートを生成中..." -ForegroundColor Green
npm run test:coverage

Write-Host "テスト完了！" -ForegroundColor Green
```

### 2.2 Bash スクリプト（Unix/Linux/macOS環境）

```bash
#!/bin/bash
# test-all.sh
set -e

# 環境準備
echo -e "\033[0;32m環境変数を設定中...\033[0m"
export NODE_ENV=test
export LOG_LEVEL=error

# 単体テスト実行
echo -e "\033[0;32m単体テストを実行中...\033[0m"
npm run test:unit

# 統合テスト実行（オプション）
if [ "$1" = "full" ]; then
    echo -e "\033[0;32m統合テストを実行中...\033[0m"
    npm run test:integration
fi

# カバレッジレポート生成
echo -e "\033[0;32mカバレッジレポートを生成中...\033[0m"
npm run test:coverage

echo -e "\033[0;32mテスト完了！\033[0m"
```

### 2.3 PowerShellスクリプトの互換性向上のためのポイント

- **絶対パスの代わりに相対パスを使用する**
  ```powershell
  # 悪い例
  $configPath = "C:\Projects\my-project\config.json"
  
  # 良い例
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $configPath = Join-Path $scriptDir "config.json"
  ```

- **OS固有のパス区切り文字を避ける**
  ```powershell
  # 悪い例
  $logPath = "logs\app.log"
  
  # 良い例
  $logPath = Join-Path "logs" "app.log"
  ```

- **環境変数の設定方法を統一する**
  ```powershell
  # 悪い例
  $env:NODE_ENV = "test"
  
  # 良い例（クロスプラットフォーム対応）
  if ($PSVersionTable.Platform -eq "Unix") {
      # Unix系PowerShell用
      $env:NODE_ENV = "test"
  } else {
      # Windows PowerShell用
      [Environment]::SetEnvironmentVariable("NODE_ENV", "test", "Process")
  }
  ```

- **終了コードの扱いを統一する**
  ```powershell
  # 悪い例
  if ($LASTEXITCODE -ne 0) { throw "テスト失敗" }
  
  # 良い例
  if (-not $?) {
      Write-Error "テスト失敗"
      exit 1
  }
  ```

## 3. GitHub Actions CI/CD 設定

### 3.1 基本設定（`.github/workflows/test.yml`）

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [16.x, 18.x]
      fail-fast: false
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint
      run: npm run lint
    
    - name: Type check
      run: npm run type-check
    
    - name: Run tests
      run: |
        if [ "${{ runner.os }}" == "Windows" ]; then
          pwsh -File ./scripts/test-all.ps1
        else
          bash ./scripts/test-all.sh
        fi
      shell: bash
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        directory: ./coverage/
        flags: ${{ runner.os }}
```

### 3.2 多言語対応CI設定（`.github/workflows/multilang-test.yml`）

```yaml
name: Multi-Language Tests

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1'  # 毎週月曜日の午前2時に実行

jobs:
  typescript:
    name: TypeScript Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18.x'
      - run: npm ci
      - run: npm test

  python:
    name: Python Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd python
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          cd python
          pytest --cov=src

  rust:
    name: Rust Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run tests
        run: |
          cd rust
          cargo test

  go:
    name: Go Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.20'
      - name: Run tests
        run: |
          cd go
          go test ./...
```

## 4. テスト結果収集と分析

### 4.1 テスト結果レポートの生成

```powershell
# test-report.ps1
$ErrorActionPreference = "Stop"

# テスト実行
npm test -- --json --outputFile=test-results.json

# 結果集計
$results = Get-Content -Raw -Path test-results.json | ConvertFrom-Json
$totalTests = $results.numTotalTests
$passedTests = $results.numPassedTests
$failedTests = $results.numFailedTests
$skippedTests = $results.numPendingTests

# レポート生成
$report = @"
# テスト実行結果レポート

- 実行日時: $(Get-Date)
- 総テスト数: $totalTests
- 成功: $passedTests ($(($passedTests / $totalTests * 100).ToString("0.0"))%)
- 失敗: $failedTests ($(($failedTests / $totalTests * 100).ToString("0.0"))%)
- スキップ: $skippedTests ($(($skippedTests / $totalTests * 100).ToString("0.0"))%)

## 失敗したテスト

$(
    if ($failedTests -gt 0) {
        $results.testResults | Where-Object { -not $_.status -eq "passed" } | ForEach-Object {
            "- $($_.name): $($_.message)"
        }
    } else {
        "なし"
    }
)

## テストカバレッジ

$(
    $coverage = Get-Content -Raw -Path coverage/coverage-summary.json | ConvertFrom-Json
    "- ステートメント: $($coverage.total.statements.pct)%"
    "- ブランチ: $($coverage.total.branches.pct)%"
    "- 関数: $($coverage.total.functions.pct)%"
    "- 行: $($coverage.total.lines.pct)%"
)
"@

# レポート保存
$report | Out-File -FilePath test-report.md -Encoding utf8
Write-Host "テストレポートを生成しました: test-report.md"
```

### 4.2 カバレッジ閾値の設定（`jest.config.js`）

```javascript
module.exports = {
  // ... 既存の設定 ...
  
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
    "./src/models/": {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    "./src/processors/": {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    "./src/agents/": {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
  },
};
```

## 5. クロスプラットフォームテスト戦略

### 5.1 Docker による環境標準化

```Dockerfile
# Dockerfile.test
FROM node:18-alpine

WORKDIR /app

# 必要なツールのインストール
RUN apk add --no-cache git bash

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# ソースコードとテストのコピー
COPY . .

# テスト実行
CMD ["npm", "test"]
```

### 5.2 Docker Composeによる複数環境テスト

```yaml
# docker-compose.test.yml
version: '3'

services:
  test-node16:
    build:
      context: .
      dockerfile: Dockerfile.test
    image: info-agent-test:node16
    environment:
      - NODE_ENV=test
      - LOG_LEVEL=error
    volumes:
      - ./coverage-node16:/app/coverage

  test-node18:
    build:
      context: .
      dockerfile: Dockerfile.test
    image: info-agent-test:node18
    environment:
      - NODE_ENV=test
      - LOG_LEVEL=error
    volumes:
      - ./coverage-node18:/app/coverage
```

## 6. 多言語テスト自動化

### 6.1 言語間の共通テスト仕様

テスト仕様を言語に依存しない形式で定義し、それを各言語向けに変換することで一貫性を確保します。

```yaml
# test-specs/search-service.yaml
name: SearchService
tests:
  - name: should return available providers
    setup:
      mockProviders:
        - name: google
          available: true
        - name: bing
          available: false
    action: getAvailableProviders
    expect:
      result:
        - google
      notContain:
        - bing

  - name: should search with specified provider
    setup:
      mockProviders:
        - name: google
          searchResults:
            - title: "Test Result 1"
              url: "https://example.com/1"
              snippet: "This is a test result 1"
    action: search
    params:
      query: "test query"
      provider: "google"
    expect:
      result:
        length: 1
        firstItem:
          title: "Test Result 1"
```

### 6.2 言語別テスト生成スクリプト

```powershell
# generate-tests.ps1
param (
    [string]$language = "typescript",  # デフォルトはTypeScript
    [string]$specDir = "./test-specs",
    [string]$outputDir = "./generated-tests"
)

# 出力ディレクトリの作成
if (-not (Test-Path $outputDir)) {
    New-Item -Path $outputDir -ItemType Directory | Out-Null
}

# 言語別テンプレートパスの設定
$templateDir = "./test-templates/$language"

# テスト仕様ファイルの処理
Get-ChildItem -Path $specDir -Filter "*.yaml" | ForEach-Object {
    $specFile = $_
    $spec = Get-Content -Raw $specFile.FullName | ConvertFrom-Yaml
    
    # テンプレートファイルの読み込み
    $templateFile = Join-Path $templateDir "test-template.$language"
    $template = Get-Content -Raw $templateFile
    
    # テンプレートの変数置換
    $testContent = $template
    $testContent = $testContent.Replace("{{TEST_NAME}}", $spec.name)
    
    # テストケースの生成
    $testCases = ""
    foreach ($test in $spec.tests) {
        $testCase = GenerateTestCase -test $test -language $language
        $testCases += $testCase
    }
    $testContent = $testContent.Replace("{{TEST_CASES}}", $testCases)
    
    # 出力ファイル名の決定
    $outputFileName = switch ($language) {
        "typescript" { "$($spec.name.ToLower()).test.ts" }
        "python" { "test_$($spec.name.ToLower()).py" }
        "rust" { "$($spec.name.ToLower())_test.rs" }
        "go" { "$($spec.name.ToLower())_test.go" }
    }
    
    # テストファイルの保存
    $outputPath = Join-Path $outputDir $outputFileName
    $testContent | Out-File -FilePath $outputPath -Encoding utf8
    
    Write-Host "Generated test: $outputPath"
}
```

## 7. トラブルシューティング

### 7.1 よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| PowerShellスクリプトがUnix環境で動作しない | パス区切り文字やコマンド互換性の問題 | `Join-Path`を使用し、OS固有コマンドを避ける |
| テストがランダムに失敗する | 非同期処理や時間依存のテスト | timeoutの延長、モックの安定化、flaky testのマーク |
| ビルドが特定の環境でのみ失敗 | 環境変数や依存関係の問題 | Docker環境の標準化、CI環境の詳細ログ取得 |
| カバレッジ閾値が満たされない | テスト不足、または閾値の設定が高すぎる | テストの追加または現実的な閾値設定 |

### 7.2 CI/CDパイプラインのデバッグ

```powershell
# debug-ci.ps1
# CIデバッグ用スクリプト - ローカルでCIと同等の環境をシミュレート

$ErrorActionPreference = "Stop"
Write-Host "CI環境をシミュレートしています..." -ForegroundColor Yellow

# 環境変数設定
$env:CI = "true"
$env:NODE_ENV = "test"

# 環境情報出力
Write-Host "環境情報:" -ForegroundColor Cyan
Write-Host "OS: $($PSVersionTable.OS)"
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Node: $(node -v)"
Write-Host "NPM: $(npm -v)"

# クリーンインストール
Write-Host "依存関係のクリーンインストール..." -ForegroundColor Cyan
npm ci

# リント実行
Write-Host "リント実行中..." -ForegroundColor Cyan
npm run lint

# 型チェック
Write-Host "型チェック実行中..." -ForegroundColor Cyan
npm run type-check

# テスト実行
Write-Host "テスト実行中..." -ForegroundColor Cyan
npm test

# 結果確認
if ($LASTEXITCODE -eq 0) {
    Write-Host "ローカルCIシミュレーション: 成功" -ForegroundColor Green
} else {
    Write-Host "ローカルCIシミュレーション: 失敗" -ForegroundColor Red
}
```

## 8. 今後の改善計画

### 8.1 短期改善計画 (2025年3月15日～3月22日)

- PowerShellスクリプトの互換性問題解決
- テスト結果の自動収集と報告機能の実装
- GitHub Actions設定の拡充

### 8.2 中期改善計画 (2025年3月25日～4月5日)

- 多言語テスト仕様の標準化
- Docker環境によるクロスプラットフォームテスト自動化
- テストカバレッジ改善ロードマップの実装

### 8.3 長期改善計画 (2025年4月～6月)

- CI/CDパイプラインの完全自動化
- 多言語実装（Python, Rust, Go）のテスト環境整備
- パフォーマンス監視とベンチマーク自動化

## 9. 参考リソース

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PowerShell Cross-Platform Guide](https://docs.microsoft.com/en-us/powershell/scripting/overview)
- [Docker Testing Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## 10. 更新履歴

| 日付 | バージョン | 内容 | 更新者 |
|------|----------|------|--------|
| 2025-03-10 | 1.0 | 初版作成 | DevOpsチーム | 