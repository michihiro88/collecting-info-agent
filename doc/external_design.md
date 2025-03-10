# 外部設計ドキュメント

## 1. システム構成

### 1.1 システムアーキテクチャ
```
+--------------------------+
|  ユーザーインターフェース  |
|  (CLI / 設定ファイル)     |
+--------------------------+
            ↓
+--------------------------+
|  情報収集エージェント     |
|  (メイン / 検索 / 整理)   |
+--------------------------+
            ↓
+--------------------------+
|  AIモデル統合層          |
|  (Anthropic/Google/OpenAI)|
+--------------------------+
            ↓
+--------------------------+
|  情報収集・処理層        |
|  (Web/API/解析)          |
+--------------------------+
            ↓
+--------------------------+
|  データストレージ層       |
|  (ログ/キャッシュ/結果)   |
+--------------------------+
```

### 1.2 コンポーネント間の関係
```
                 +------------------+
                 | CLIインターフェース |
                 +------------------+
                        ↓
+------------------+    ↓    +------------------+
| 設定マネージャー  | ←→ | メインエージェント   |
+------------------+    ↓    +------------------+
                        ↓           ↓
                +------------------+ ↓
                | モデルセレクター | ↓
                +------------------+ ↓
                        ↓           ↓
+------------------+    ↓    +------------------+
| 検索エージェント  | ←→ | 情報整理エージェント |
+------------------+    ↓    +------------------+
        ↓                          ↑
+------------------+          +------------------+
| 情報収集モジュール |  →→→→  | データ構造化モジュール |
+------------------+          +------------------+
        ↓                          ↑
+------------------+          +------------------+
| キャッシュマネージャー | ←→ | ログマネージャー   |
+------------------+          +------------------+
```

### 1.3 主要コンポーネント
1. ユーザーインターフェース
   - コマンドラインインターフェース
     - 入力パラメータ処理
     - ヘルプテキストの表示
     - 進捗状況の表示
   - 設定ファイルによる設定管理
     - YAML/JSON形式の設定読み込み
     - 設定の検証と規定値の適用
     - 複数プロファイルの管理

2. 情報収集エージェント
   - メインエージェント
     - エージェント間の調整
     - タスク割り当てと監視
     - ユーザーインターフェースとの連携
   - 検索エージェント
     - 検索戦略の決定
     - 検索クエリの生成と実行
     - 検索結果の初期評価
   - 情報整理エージェント
     - 関連性によるフィルタリング
     - 情報の構造化
     - レポート生成

3. AIモデル統合層
   - モデルプロバイダーインターフェース
     - 統一されたAPIインターフェース
     - モデル固有パラメータの管理
     - エラー処理と再試行ロジック
   - モデル切り替え制御
     - コスト/パフォーマンス最適化ロジック
     - フォールバックメカニズム
     - モデル使用状況の監視
   - プロンプト管理
     - プロンプトテンプレート
     - プロンプト変数の挿入
     - プロンプト最適化機能

4. 情報収集・処理層
   - Webクローラー
     - URLの検証と正規化
     - コンテンツ取得とパース
     - レート制限の実装
   - テキスト解析エンジン
     - 本文抽出
     - エンティティ認識
     - 要約生成
   - 情報フィルタリング
     - 重複検出
     - 関連性スコアリング
     - コンテンツ分類

5. データストレージ層
   - ログ管理
     - マルチレベルロギング
     - ローテーションポリシー
     - ログ検索機能
   - キャッシュ管理
     - 検索結果のキャッシュ
     - TTLベースの有効期限
     - ディスク/メモリキャッシュの階層化
   - 結果保存
     - マークダウン/HTML/PDF出力
     - 構造化データ出力（JSON/CSV）
     - バージョン管理

## 2. インターフェース設計

### 2.1 外部インターフェース
1. 入力インターフェース
   - URL
     - 形式: 文字列（有効なURL）
     - 検証: URL構文チェック、到達可能性確認
     - 例: `https://zenn.dev/discus0434/articles/6e5add61970786`
   - ローカルファイル
     - 形式: ファイルパス
     - 対応形式: .txt, .md, .pdf, .docx
     - 例: `./sources/article.pdf`
   - テキスト入力
     - 形式: 文字列
     - 制限: 最大10,000文字
     - 例: `技術記事の要約を作成して関連情報を集めてください`
   - 設定ファイル
     - 形式: YAML/JSON
     - 検証: スキーマ検証
     - 例: `./config/default.yml`

2. 出力インターフェース
   - 構造化された情報
     - 形式: Markdown/HTML/PDF/JSON
     - 構造: 階層化された情報
     - 例: 見出し、箇条書き、表、リンク等
   - ログファイル
     - 形式: テキストファイル
     - 構造: 日時、レベル、メッセージ
     - 例: `2025-03-08 10:15:23 [INFO] 検索開始: "LangChain"`
   - エラーメッセージ
     - 形式: 構造化エラーオブジェクト
     - 詳細: コード、メッセージ、原因、推奨アクション
     - 例: `エラー[E1001]: APIキーが設定されていません。.envファイルを確認してください。`

### 2.2 コマンドラインインターフェース仕様
```
使用方法: info-agent [オプション] <入力>

オプション:
  -c, --config <file>     設定ファイルを指定
  -m, --model <name>      使用するAIモデルを指定
  -o, --output <format>   出力形式を指定 (md|html|pdf|json)
  -s, --schedule <cron>   定期実行スケジュールを設定
  -v, --verbose           詳細ログを出力
  -h, --help              ヘルプを表示

例:
  info-agent https://example.com/article
  info-agent -m claude-3-7-sonnet -o pdf ./data.txt
  info-agent -c custom.yml "AIエージェントの最新動向"
```

### 2.3 内部インターフェース
1. エージェント間通信
   - メッセージキュー
     - 形式: 非同期メッセージング
     - 構造: タイプ、ペイロード、メタデータ
     - 実装: 内部イベントバス
   - イベントバス
     - イベントタイプ: タスク開始/完了/エラー/進捗
     - サブスクリプション: イベントフィルタリング
     - 例: `TaskCompleted(taskId, result)`

2. データストア
   - ファイルシステム
     - 構造: ディレクトリ階層（日付/タスク/結果）
     - アクセス: 読み書き権限管理
     - 形式: バイナリ/テキスト
   - キャッシュ
     - キー: URL/クエリハッシュ
     - 値: 検索結果/解析済みコンテンツ
     - TTL: コンテンツタイプ別の有効期限

## 3. データ設計

### 3.1 データ構造
1. 設定データ

```yaml
# config.yml
version: "1.0"
general:
  workspace: "./workspace"
  cache_dir: "./cache"
  report_dir: "./reports"
  max_concurrent_tasks: 3

models:
  default: "claude-3-5-sonnet"
  available:
    - name: "claude-3-7-sonnet"
      provider: "anthropic"
      api_key_env: "ANTHROPIC_API_KEY"
      max_tokens: 4096
      temperature: 0.7
    - name: "gpt-4o"
      provider: "openai"
      api_key_env: "OPENAI_API_KEY"
      max_tokens: 4096
      temperature: 0.7

search:
  max_results: 50
  default_depth: 2
  user_agent: "InfoAgent/1.0"
  rate_limit:
    requests_per_minute: 10
    parallel_requests: 3

logging:
  level: "info"  # debug, info, warn, error
  file: "./logs/agent.log"
  max_size: "10MB"
  max_files: 7
  chat_log: "./logs/chat-%Y-%m-%d.log"
```

2. 収集データ

```typescript
// TypeScript Interface
interface SearchResult {
  id: string;
  source: {
    type: 'web' | 'file' | 'api';
    url?: string;
    filePath?: string;
    apiName?: string;
  };
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    language?: string;
    contentType?: string;
    tags?: string[];
  };
  content: {
    fullText: string;
    summary?: string;
    keyPoints?: string[];
    entities?: { 
      name: string;
      type: string;
      count: number;
    }[];
  };
  relevance: number;  // 0-100
  timestamp: Date;
  processingInfo: {
    modelUsed: string;
    processingTime: number;
    tokenCount?: number;
  };
}
```

3. ログデータ

```typescript
// TypeScript Interface
interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  context: {
    component: string;
    operation: string;
    taskId?: string;
  };
  message: string;
  data?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

interface ChatLogEntry {
  timestamp: Date;
  direction: 'INPUT' | 'OUTPUT';
  modelId: string;
  message: string;
  tokens?: number;
  processingTime?: number;
}
```

### 3.2 データフロー
1. 情報収集フロー詳細
```
入力
 │
 ↓
入力解析
 │ (URL/ファイル/テキスト → 検索条件)
 ↓
検索条件生成
 │ (キーワード抽出、優先順位付け)
 ↓
検索実行
 │ (Web/API/ローカルファイル)
 │ ← キャッシュチェック
 ↓
初期フィルタリング
 │ (関連性評価、重複削除)
 ↓
詳細分析
 │ (AI処理、メタデータ抽出)
 ↓
構造化
 │ (カテゴリ分類、関連付け)
 ↓
レポート生成
 │ (markdown/HTML/PDF)
 ↓
出力
```

2. ログフロー詳細
```
イベント発生
 │
 ↓
ログレベル判定
 │ (INFO/WARN/ERROR)
 ↓
コンテキスト付加
 │ (コンポーネント、操作、タスクID)
 ↓
ログメッセージ構築
 │
 ↓
出力先判定
 │→ コンソール出力
 │→ ファイル出力
 │   │
 │   ↓
 │  サイズチェック
 │   │
 │   ↓
 │  ローテーション判定
 │
 ↓
監視・アラート
 │ (エラーレベルに応じた通知)
 ↓
ログ検索インデックス更新
```

## 4. API設計

### 4.1 AIプロバイダーAPI
1. モデルインターフェース
```typescript
interface AIModel {
  id: string;
  provider: 'anthropic' | 'openai' | 'google';
  
  // プロンプト実行メソッド
  generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  
  // RAG (検索拡張生成)メソッド
  generateWithContext(
    prompt: string, 
    context: SearchResult[], 
    options?: ModelOptions
  ): Promise<ModelResponse>;
  
  // エラー処理メソッド
  handleError(error: any): Promise<ModelResponse | null>;
}

interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  streamResponse?: boolean;
}

interface ModelResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    modelId: string;
    finishReason: string;
    processingTime: number;
  };
}
```

2. プロバイダー固有の実装
```typescript
// Anthropicプロバイダーの例
class AnthropicModel implements AIModel {
  private client: any; // Anthropic Client
  
  constructor(apiKey: string, modelId: string) {
    // クライアント初期化
  }
  
  async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    // Anthropic API呼び出し
    try {
      const response = await this.client.messages.create({
        model: this.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
      });
      
      // レスポンス変換
      return {
        text: response.content[0].text,
        usage: {
          // ...トークン使用量情報
        },
        metadata: {
          // ...メタデータ
        }
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  // その他のメソッド実装
}
```

### 4.2 検索API設計
```typescript
interface SearchService {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getByUrl(url: string): Promise<SearchResult | null>;
}

interface SearchOptions {
  maxResults?: number;
  sources?: ('web' | 'api' | 'local')[];
  filters?: {
    minRelevance?: number;
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    language?: string[];
    contentType?: string[];
  };
}

// Web検索実装
class WebSearchService implements SearchService {
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Webスクレイピングまたは検索エンジンAPI呼び出し
  }
  
  async getByUrl(url: string): Promise<SearchResult | null> {
    // 特定URLのコンテンツ取得
  }
}
```

## 5. エラーハンドリング

### 5.1 エラー種別
1. 入力エラー
   - 無効なURL
     - 診断: URL構文検証
     - 処理: ユーザーに再入力を促す
     - コード: `E1001`
   - ファイルアクセスエラー
     - 診断: ファイル存在確認、権限確認
     - 処理: 代替パスの提案またはパーミッション要求
     - コード: `E1002`
   - 不正な設定
     - 診断: スキーマ検証
     - 処理: 規定値の適用と警告
     - コード: `E1003`

2. 処理エラー
   - AIモデルエラー
     - 診断: API応答コード分析
     - 処理: 代替モデルへのフォールバック
     - コード: `E2001` 
   - ネットワークエラー
     - 診断: 接続テスト、タイムアウト確認
     - 処理: 指数バックオフによるリトライ
     - コード: `E2002`
   - パースエラー
     - 診断: コンテンツ形式確認
     - 処理: 代替パース方法の試行
     - コード: `E2003`

3. システムエラー
   - メモリ不足
     - 診断: メモリ使用状況監視
     - 処理: リソース解放、処理分割
     - コード: `E3001`
   - ディスク容量不足
     - 診断: ディスク空き容量チェック
     - 処理: キャッシュクリア、古いログ削除
     - コード: `E3002`
   - プロセスエラー
     - 診断: プロセス状態確認
     - 処理: 安全な終了とリカバリ
     - コード: `E3003`

### 5.2 エラー処理方針
- エラーログの記録
  - 構造化ログエントリ
  - エラーコード、メッセージ、スタックトレース
  - コンテキスト情報（操作、入力データ）
- リトライメカニズム
  - 一時的エラーの自動リトライ
  - 指数バックオフアルゴリズム
  - 最大リトライ回数の設定
- フォールバック処理
  - 代替モデルへの切り替え
  - 機能の部分的無効化
  - キャッシュデータの利用
- ユーザーへの通知
  - 明確なエラーメッセージ
  - 推奨される対処法の提示
  - 詳細ログへのリファレンス

## 6. セキュリティ設計

### 6.1 API認証情報の管理
- 環境変数による管理
  - `.env.sample`テンプレートの提供
  - 本番環境での適切な変数設定
- キーローテーション
  - 定期的なキー更新の仕組み
  - 複数キーの並行サポート

### 6.2 データ保護
- 機密情報の扱い
  - メモリ内での最小限保持
  - ファイルシステム上の暗号化
- 出力データの検証
  - 機密情報の流出防止
  - PII（個人識別情報）の自動検出と編集 