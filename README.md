# 情報収集エージェント

このプロジェクトは、複数のAIモデルを使用して情報収集と分析を行うエージェントを実装しています。

## 機能

- 複数のAIモデル（OpenAI、Anthropic Claude、Google Gemini）のサポート
- 情報検索と取得
- コンテキスト管理と関連性スコアリング
- 堅牢なエラーハンドリング
- 設定管理
- 安全な環境変数管理

## 要件

- Node.js 16+
- npm または yarn
- 各AIプロバイダーのAPIキー

## インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd collecting-info-agent

# 依存関係のインストール
npm install
```

## 環境設定

`.env.sample`ファイルを参考に`.env`ファイルをプロジェクトのルートディレクトリに作成し、必要なAPIキーを設定します:

```
# OpenAI API設定
OPENAI_API_KEY=your_openai_api_key

# Anthropic API設定
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google API設定
GOOGLE_API_KEY=your_google_api_key

# Google Search API設定
GOOGLE_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_google_search_engine_id
```

**注意**: `.env`ファイルには機密情報が含まれるため、決してGitリポジトリにコミットしないでください。

## 使用方法

### CLIモード

```bash
npm start -- --query "調査したい質問" --model claude-3-opus
```

### ライブラリとして使用

```javascript
const { Agent } = require('./src/agents/agent');
const { GoogleModel } = require('./src/models/providers/google-model');
const { envManager } = require('./src/config/env-manager');

async function main() {
  // 環境変数の初期化
  envManager.initialize();
  
  // モデルの初期化（環境変数から自動的にAPIキーを取得）
  const model = new GoogleModel('gemini-pro', 'GOOGLE_API_KEY');
  
  // エージェントの初期化
  const agent = new Agent(model);
  
  // クエリの実行
  const result = await agent.processQuery('太陽系について教えてください');
  console.log(result);
}

main().catch(console.error);
```

## テスト

テストを実行するには:

```bash
# すべてのテストを実行
npm test

# 単体テストのみ実行
npm run test:unit

# 統合テストのみ実行
npm run test:integration

# 環境変数ロジックのテスト
npm run test:env
```

### Windows環境でのモデルテスト

PowerShellスクリプトを使用してAIモデルのテストを実行できます:

```powershell
# すべてのモデルテストを実行
.\Run-ModelTests.ps1

# 特定のモデルテストのみ実行
.\Run-ModelTests.ps1 openai

# 環境変数ロジックのテスト
.\test-env-logic.ps1
```

### APIキーと本番環境

テストを実行するには各AIプロバイダーのAPIキーが必要です。APIキーが設定されていない場合、関連するテストはスキップされます。テスト環境では、`EnvManager`クラスを使用して環境変数を安全に管理します。

## プロジェクト構造

```
collecting-info-agent/
├── config/             # 設定ファイル
├── doc/                # ドキュメント
├── src/                # ソースコード
│   ├── agents/         # エージェント実装
│   │   ├── info-processor.ts  # 情報処理エージェント
│   │   ├── main-agent.ts      # メインエージェント
│   │   └── search-agent.ts    # 検索エージェント
│   ├── config/         # 設定管理
│   │   ├── config-loader.ts  # YAML設定ファイル読み込み
│   │   ├── config-schema.ts  # 設定スキーマ定義
│   │   └── env-manager.ts    # 環境変数管理
│   ├── models/         # AIモデル実装
│   │   ├── interfaces/ # モデルインターフェース
│   │   ├── providers/  # 各プロバイダー実装
│   │   └── selector.ts # モデル選択機能
│   ├── processors/     # コンテンツ処理
│   │   ├── ai/         # AI要約生成
│   │   ├── html/       # HTML処理
│   │   ├── integration/ # コンテンツ統合
│   │   ├── pdf/        # PDF処理
│   │   └── rag/        # RAG処理
│   ├── search/         # 検索機能
│   │   ├── cache/      # 検索キャッシュ
│   │   └── providers/  # 検索プロバイダー
│   └── utils/          # ユーティリティ
│       ├── error-handler.ts  # エラー処理
│       ├── logger.ts         # ロギング
│       └── types.ts          # 型定義
├── test/               # テスト
│   ├── integration/    # 統合テスト
│   ├── mocks/          # モックオブジェクト
│   └── unit/           # 単体テスト
├── .env.sample         # 環境変数サンプル
└── .env                # 環境変数（gitignore）
```

## 実装の進捗状況

### 2025年3月9日 更新

- **すべてのテストが正常に通過**：最新のテスト実行で、全156件のテストが正常に実行されました（スキップされた1件は統合テスト環境の制約によるものです）。
- **エラーハンドリングの強化**：アプリケーション全体でエラーハンドリング機能を大幅に強化し、より堅牢な動作を実現しました。
- **テスト環境の改善**：モックの最適化とテスト自動化スクリプトの改善により、テストの安定性と再現性が向上しました。
- **検索機能の統合**：Google検索APIとの連携が実装され、キャッシュ機能とレート制限機能も追加されました。
- **RAG機能の強化**：検索結果の関連性スコアリング、コンテンツ統合、マルチステージRAG処理が実装されました。

## 環境変数管理

本プロジェクトでは、`EnvManager`クラスを使用して環境変数を安全に管理しています：

- `.env`ファイルの自動読み込み
- 環境変数の取得と検証
- 必須環境変数のチェック
- テスト用の安全な環境変数操作

直接`.env`ファイルを参照したり変更したりする代わりに、`EnvManager`を経由して環境変数にアクセスします。

## エラーハンドリング

アプリケーション全体で統一されたエラーハンドリングアプローチを採用しています：

- `AppError`クラスによる構造化されたエラー情報
- エラーコードによるエラータイプの分類
- 詳細なエラーメタデータの提供
- グレースフルデグラデーション（障害時の段階的機能低下）
- 各層でのエラー処理とリカバリー

## ドキュメント

詳細なドキュメントは`doc`ディレクトリで参照できます：

- [実装計画](./doc/implementation_plan_final.md) - プロジェクトの実装計画
- [テスト計画](./doc/test_plan_updated_2025.md) - テスト戦略と実行計画
- [テスト結果](./doc/test_execution_results.md) - テスト実行結果と分析

## 貢献

プルリクエストは歓迎します。大きな変更を加える場合は、まずissueを開いて変更内容について議論してください。

## ライセンス

[MIT](LICENSE) 