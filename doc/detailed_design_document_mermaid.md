# 情報収集エージェント 詳細設計図（Mermaid形式）

## 1. 全体アーキテクチャ

```mermaid
flowchart TD
    A["CLI / API インターフェース"] --> B["メインエージェント"]
    B --> C["検索エージェント"]
    B --> D["情報処理エージェント"]
    B --> E["モデルセレクタ"]
    C --> F["検索サービス"]
    D --> G["コンテンツプロセッサー"]
    E --> H["AIモデル群"]
    F --> I["検索プロバイダー群"]
    G --> J["フォーマットプロセッサー"]
```

## 2. データフロー図

### 2.1 検索フロー

```mermaid
flowchart TD
    A["検索エージェント"] --> B["検索サービス"]
    B --> C["検索キャッシュgetメソッド"]
    C --> |"キャッシュヒット"| D["検索結果返却"]
    C --> |"キャッシュミス"| E["レート制限チェック"]
    E --> F["API呼び出し"]
    F --> G["検索結果をキャッシュに保存"]
    G --> D
    D --> H["URLからコンテンツ取得"]
    H --> A
```

### 2.2 コンテンツ処理フロー

```mermaid
flowchart TD
    A["情報処理エージェント"] --> B["HTMLプロセッサー"]
    B --> C["DOM解析"]
    C --> D["メタデータ抽出"]
    D --> E["不要要素除去"]
    E --> F["メインコンテンツ抽出"]
    F --> G["テキスト正規化"]
    G --> H["処理済みコンテンツ"]
    H --> I["関連性スコアリング"]
    I --> J["コンテンツ統合"]
    J --> K["AIサマライザー"]
    K --> L["AIモデルgenerateTextメソッド"]
```

### 2.3 AIモデル呼び出しフロー

```mermaid
flowchart TD
    A["メインエージェント"] --> B["モデルセレクタselectModelメソッド"]
    B --> C["環境変数マネージャーgetメソッド"]
    C --> D["APIキー取得"]
    D --> E["AIモデルインスタンス"]
    E --> F["プロンプト構築"]
    F --> G["AIモデルgenerateTextメソッド"]
    G --> H["APIクライアントrequestメソッド"]
    H --> I["モデルAPI呼び出し"]
    I --> J["APIレスポンス受信"]
    J --> K["レスポンス解析"]
    K --> L["モデルレスポンス"]
```

### 2.4 エラーハンドリングフロー

```mermaid
flowchart TD
    A["API呼び出し実行"] --> B["エラー発生\ntry/catch"]
    B --> C["エラーハンドラーhandleErrorメソッド"]
    C --> D["AppError作成"]
    D --> E["エラー分類"]
    E --> F["エラーログ記録"]
    F --> G["操作可能性判定"]
    G --> |"リカバリー可能"| H["リカバリー可能判定"]
    G --> |"リカバリー不可能"| I["エラーレスポンス返却"]
    H --> J["リカバリー処理"]
    J --> K["フォールバック実行"]
    K --> L["処理継続"]
```

## 3. シーケンス図

### 3.1 基本的なクエリ処理シーケンス

```mermaid
sequenceDiagram
    participant User as "ユーザー"
    participant Main as "メインエージェント"
    participant Search as "検索エージェント"
    participant Service as "検索サービス"
    participant Provider as "検索プロバイダー"
    participant Info as "情報処理エージェント"
    participant Model as "AIモデル"
    
    User->>Main: クエリ入力
    Main->>Search: process(query)
    Search->>Service: search(query)
    Service->>Provider: search(query)
    Provider->>Provider: API呼び出し
    Provider-->>Service: 検索結果
    Service-->>Search: 検索結果
    Search->>Service: URLからコンテンツ取得
    Service-->>Search: コンテンツ
    Search-->>Main: 検索結果とコンテンツ
    Main->>Info: processContent()
    Info->>Model: コンテンツ処理
    Model-->>Info: 処理結果
    Info->>Model: generateText()
    Model-->>Info: AIモデル応答
    Info-->>Main: 処理結果
    Main-->>User: 最終結果表示
```

### 3.2 エラー発生時のシーケンス

```mermaid
sequenceDiagram
    participant User as "ユーザー"
    participant Main as "メインエージェント"
    participant Search as "検索エージェント"
    participant Service as "検索サービス"
    participant Provider as "検索プロバイダー"
    participant Error as "エラーハンドラー"
    
    User->>Main: クエリ入力
    Main->>Search: search(query)
    Search->>Service: search(query)
    Service->>Provider: search(query)
    Provider->>Error: API呼び出し
    Error->>Error: APIエラー発生
    Provider->>Error: handleError()
    Error->>Error: エラー処理
    Error-->>Provider: AppError
    Provider-->>Service: 検索エラー
    Service-->>Search: 検索エラー
    Search->>Search: フォールバック処理
    Search-->>Main: 部分的結果またはエラーメッセージ
    Main-->>User: エラー通知
```

### 3.3 環境変数ロード・設定シーケンス

```mermaid
sequenceDiagram
    participant App as "アプリケーション起動"
    participant Loader as "設定ローダー"
    participant Env as "環境変数マネージャー"
    participant Dotenv as "dotenv"
    participant Schema as "スキーマ検証"
    
    App->>Loader: initialize()
    Loader->>Env: load()
    Env->>Dotenv: initialize()
    Dotenv->>Dotenv: .envファイル読込
    Dotenv-->>Env: 環境変数読込完了
    Loader->>Loader: YAMLファイル読込
    Loader->>Schema: validateSchema()
    Schema->>Schema: スキーマ検証
    Schema-->>Loader: 検証結果
    Loader->>Env: 環境変数オーバーライド
    Env->>Dotenv: get(キー)
    Dotenv-->>Env: 環境変数値
    Env-->>Loader: オーバーライド値
    Loader->>Loader: 設定適用
    Loader-->>App: 設定ロード完了
```

### 3.4 キャッシュとレート制限シーケンス

```mermaid
sequenceDiagram
    participant Search as "検索エージェント"
    participant Service as "検索サービス"
    participant Cache as "検索キャッシュ"
    participant Rate as "レート制限マネージャー"
    participant API as "検索API"
    
    Search->>Service: search(query)
    Service->>Cache: get(cacheKey)
    Cache->>Cache: キャッシュチェック
    
    alt "キャッシュヒット"
        Cache-->>Service: キャッシュデータ返却
    else "キャッシュミス"
        Cache-->>Service: キャッシュミス
        Service->>Rate: checkLimit()
        Rate->>Rate: レート制限チェック
        
        alt "制限なし"
            Rate-->>Service: 制限なし
            Service->>API: API呼び出し
            API->>API: 検索実行
            API-->>Service: 検索結果
            Service->>Cache: set(cacheKey, results)
            Cache->>Cache: キャッシュ保存
            Service->>Rate: incrementUsage()
            Rate->>Rate: 使用量カウント
        else "制限あり"
            Rate-->>Service: 制限あり
            Service-->>Search: レート制限エラー
        end
    end
    
    Service-->>Search: 検索結果
```

### 3.5 検索リカバリーシーケンス

```mermaid
sequenceDiagram
    participant User as "ユーザー"
    participant Main as "メインエージェント"
    participant Search as "検索エージェント"
    participant Service as "検索サービス"
    participant Provider as "検索プロバイダA"
    participant Provider2 as "検索プロバイダB"
    participant Error as "エラーハンドラー"
    
    User->>Main: 質問入力
    Main->>Search: 検索実行
    Search->>Service: search()
    Service->>Provider: APIリクエスト
    Provider-->>Service: APIエラー
    Service->>Error: handleError()
    Error->>Error: エラー分析
    Error->>Service: リカバリー指示
    Service->>Provider2: フォールバック検索
    Provider2-->>Service: 検索結果
    Service-->>Search: 検索結果返却
    Search-->>Main: 情報提供
    Main-->>User: 回答表示
``` 