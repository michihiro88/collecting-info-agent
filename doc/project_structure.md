# プロジェクト構造

## ディレクトリ構成

```
collecting-info-agent/
├── doc/                    # ドキュメント
│   ├── requirements_analysis.md    # 要件分析
│   ├── external_design.md          # 外部設計
│   ├── implementation_plan.md      # 実装計画
│   ├── summary.md                  # ドキュメント概要
│   └── project_structure.md        # プロジェクト構造
│
├── src/                    # ソースコード
│   ├── config/             # 設定関連
│   │   ├── config-schema.ts        # 設定スキーマ定義
│   │   └── config-loader.ts        # 設定読み込み
│   │
│   ├── models/             # AIモデル統合
│   │   ├── interfaces/             # インターフェース定義
│   │   ├── providers/              # モデルプロバイダー実装
│   │   └── selector.ts             # モデル選択ロジック
│   │
│   ├── agents/             # エージェント実装
│   │   ├── main-agent.ts           # メインエージェント
│   │   ├── search-agent.ts         # 検索エージェント
│   │   └── organization-agent.ts   # 情報整理エージェント
│   │
│   ├── crawlers/           # 情報収集
│   │   ├── web-crawler.ts          # Webクローラー
│   │   ├── file-processor.ts       # ファイル処理
│   │   └── api-client.ts           # API呼び出し
│   │
│   ├── processors/         # 情報処理
│   │   ├── text-extractor.ts       # テキスト抽出
│   │   ├── analyzer.ts             # 情報分析
│   │   └── summarizer.ts           # 要約生成
│   │
│   ├── storage/            # データ保存
│   │   ├── cache.ts                # キャッシュ管理
│   │   └── result-store.ts         # 結果保存
│   │
│   ├── utils/              # ユーティリティ
│   │   ├── logger.ts               # ログ管理
│   │   ├── error-handler.ts        # エラー処理
│   │   └── types.ts                # 共通型定義
│   │
│   ├── cli/                # コマンドライン
│   │   ├── commands/               # コマンド実装
│   │   └── helpers/                # CLI補助機能
│   │
│   └── index.ts            # エントリーポイント
│
├── test/                   # テストコード
│   ├── unit/               # ユニットテスト
│   ├── integration/        # 統合テスト
│   └── e2e/                # エンドツーエンドテスト
│
├── config/                 # 設定ファイル
│   ├── default.yml                 # デフォルト設定
│   └── profiles/                   # 設定プロファイル
│
├── scripts/                # スクリプト
│   ├── build.js                    # ビルドスクリプト
│   └── deploy.js                   # デプロイスクリプト
│
├── logs/                   # ログファイル
│   ├── system/                     # システムログ
│   └── chat/                       # チャットログ
│
├── cache/                  # キャッシュデータ
│
├── reports/                # 生成レポート
│
├── .env.sample             # 環境変数サンプル
├── .gitignore              # Git無視ファイル
├── package.json            # パッケージ設定
├── tsconfig.json           # TypeScript設定
├── jest.config.js          # Jestテスト設定
├── .eslintrc.js            # ESLint設定
├── .prettierrc             # Prettier設定
└── README.md               # プロジェクト説明
```

## 主要ディレクトリの説明

### doc/
設計ドキュメントや仕様書などのドキュメントを格納します。要件分析、外部設計、実装計画などのドキュメントが含まれます。

### src/
ソースコードを格納します。TypeScriptで記述されたアプリケーションコードが含まれます。

#### src/config/
設定関連のコードを格納します。設定ファイルの読み込みや設定のスキーマ定義などが含まれます。

#### src/models/
AIモデル統合のコードを格納します。各モデルプロバイダー（Anthropic、Google、OpenAI）の実装やモデル選択ロジックが含まれます。

#### src/agents/
情報収集エージェントの実装を格納します。メインエージェント、検索エージェント、情報整理エージェントなどが含まれます。

#### src/crawlers/
Web、ファイル、APIなどからの情報収集コードを格納します。URL処理、コンテンツ取得、レート制限などの実装が含まれます。

#### src/processors/
収集した情報の処理コードを格納します。テキスト抽出、情報分析、要約生成などの実装が含まれます。

#### src/storage/
データの保存コードを格納します。キャッシュ管理や結果保存などの実装が含まれます。

#### src/utils/
共通ユーティリティを格納します。ログ管理、エラー処理、共通型定義などが含まれます。

#### src/cli/
コマンドラインインターフェースのコードを格納します。コマンド実装やCLI補助機能が含まれます。

### test/
テストコードを格納します。ユニットテスト、統合テスト、エンドツーエンドテストなどが含まれます。

### config/
設定ファイルを格納します。デフォルト設定やプロファイル別設定などが含まれます。

### scripts/
ビルド、デプロイなどのスクリプトを格納します。

### logs/
システムログやチャットログなどのログファイルを格納します。

### cache/
キャッシュデータを格納します。検索結果や一時的なデータなどが含まれます。

### reports/
生成されたレポートを格納します。マークダウン、HTML、PDFなどの形式で出力されます。

## ファイル命名規則

1. **ファイル名**: ケバブケース（kebab-case）を使用
   - 例: `web-crawler.ts`, `error-handler.ts`

2. **クラス名**: パスカルケース（PascalCase）を使用
   - 例: `WebCrawler`, `ErrorHandler`

3. **インターフェース名**: 頭文字に「I」を付けたパスカルケース
   - 例: `ISearchResult`, `ILogger`

4. **型名**: パスカルケース
   - 例: `SearchResult`, `LogEntry`

5. **関数名**: キャメルケース（camelCase）
   - 例: `fetchContent()`, `parseResult()`

6. **変数名**: キャメルケース
   - 例: `searchQuery`, `resultList`

7. **定数名**: 大文字のスネークケース（SNAKE_CASE）
   - 例: `MAX_RESULTS`, `DEFAULT_TIMEOUT`

## モジュール間の依存関係

1. 循環依存を避ける
2. 依存方向は上位→下位の方向に統一
   - agents → models, crawlers, processors
   - crawlers → utils
   - processors → utils
3. ユーティリティは他のモジュールから依存されてよい
4. 設定は他のモジュールから参照されてよい 