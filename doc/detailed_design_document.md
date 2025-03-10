# 情報収集エージェント 詳細設計書

## 改訂履歴

| 日付 | バージョン | 内容 | 作成者 |
|------|----------|------|-------|
| 2025-03-15 | 1.0 | 初版作成 | 開発チーム |

## 目次

1. [ソフトウェア概要](#1-ソフトウェア概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [コンポーネント詳細](#3-コンポーネント詳細)
4. [データフロー](#4-データフロー)
5. [シーケンス図](#5-シーケンス図)
6. [主要クラス・関数の説明](#6-主要クラス関数の説明)
7. [エラーハンドリング設計](#7-エラーハンドリング設計)
8. [テスト戦略](#8-テスト戦略)
9. [技術的課題と解決策](#9-技術的課題と解決策)
10. [運用ガイドライン](#10-運用ガイドライン)

## 1. ソフトウェア概要

### 1.1 概要

情報収集エージェントは、ウェブ上の情報を効率的に収集し、AI技術を活用して要約・統合するアプリケーションです。このシステムは複数のAIモデル（OpenAI、Anthropic Claude、Google Gemini）に対応し、検索機能、コンテンツ処理、情報統合機能を備えています。

### 1.2 主要機能

1. **マルチモデル対応**
   - OpenAI GPTモデル（GPT-4等）
   - Anthropic Claudeモデル（Claude 3 Opus等）
   - Google Geminiモデル
   - モデル間の自動切り替えと冗長化

2. **情報検索と収集**
   - Google検索API連携
   - 検索結果のキャッシュ機能
   - レート制限制御

3. **コンテンツ処理**
   - HTML処理（メタデータ抽出、コンテンツ抽出、不要要素除去）
   - PDF処理（テキスト抽出、構造化）
   - マルチフォーマット対応

4. **情報統合と要約**
   - マルチステージRAG（Retrieval-Augmented Generation）
   - 関連性スコアリング
   - コンテンツ統合処理

5. **堅牢なエラーハンドリング**
   - 各レイヤーでのエラー検出と処理
   - グレースフルデグラデーション（段階的機能低下）
   - リトライメカニズムとフォールバック処理

### 1.3 システム要件

#### 1.3.1 ハードウェア要件
- CPU: デュアルコア以上推奨
- メモリ: 4GB以上推奨
- ディスク: 1GB以上の空き容量

#### 1.3.2 ソフトウェア要件
- Node.js 16+
- npm または yarn
- オペレーティングシステム：Windows 10/11、macOS、Linux (Ubuntu 20.04+)

#### 1.3.3 外部サービス要件
- 各AIプロバイダーのAPIキー
  - OpenAI APIキー
  - Anthropic APIキー
  - Google APIキー
- Google検索APIキーとカスタム検索エンジンID

### 1.4 利用シナリオ

#### 1.4.1 情報収集と要約
ユーザーが特定のトピックについて情報を取得したい場合、クエリを入力すると以下の処理が行われます：
1. 検索エージェントが検索APIを利用して関連情報を持つURLを取得
2. 各URLからコンテンツを取得し、HTMLプロセッサーでクリーニング
3. コンテンツに対して関連性スコアリングを実施
4. 高スコアのコンテンツを選別して要約処理
5. 複数ソースからの情報を統合して最終結果を生成

#### 1.4.2 異なるAIモデルの利用
ユーザーは特定の用途に適したAIモデルを指定できます：
- OpenAI GPT-4: 一般的な質問応答に適している
- Claude 3 Opus: 詳細な分析や長文コンテキスト処理に優れている
- Google Gemini: 日本語処理や特定ドメインに強み

#### 1.4.3 エラー発生時のシナリオ
APIエラーや接続問題が発生した場合：
1. エラーハンドラーがエラータイプを判別
2. リトライが可能なエラーの場合は自動リトライ
3. 特定のモデルが利用できない場合は別モデルへフォールバック
4. 部分的な結果のみ取得できた場合はその範囲で処理を継続

### 1.5 使用方法

#### 1.5.1 CLIモード
コマンドラインから以下のように実行：
```bash
npm start -- --query "調査したい質問" --model claude-3-opus
```

#### 1.5.2 ライブラリとして使用
アプリケーションコードから以下のように使用：
```javascript
const { Agent } = require('./src/agents/agent');
const { GoogleModel } = require('./src/models/providers/google-model');
const { envManager } = require('./src/config/env-manager');

async function main() {
  // 環境変数の初期化
  envManager.initialize();
  
  // モデルの初期化
  const model = new GoogleModel('gemini-pro', 'GOOGLE_API_KEY');
  
  // エージェントの初期化
  const agent = new Agent(model);
  
  // クエリの実行
  const result = await agent.processQuery('太陽系について教えてください');
  console.log(result);
}

main().catch(console.error);
```

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ

情報収集エージェントは、複数のレイヤーから構成されるモジュール化されたアーキテクチャを採用しています。これにより、コンポーネントの独立性が高まり、拡張性とメンテナンス性が向上しています。

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

### 2.2 レイヤー構成

#### 2.2.1 インターフェースレイヤー
- **CLI/APIインターフェース**: ユーザーからの入力を受け付け、実行パラメータを処理し、結果を出力するインターフェース

#### 2.2.2 エージェントレイヤー
- **メインエージェント**: 全体の処理フローを制御し、他のエージェントを調整
- **検索エージェント**: 情報収集のための検索処理を担当
- **情報処理エージェント**: 取得したコンテンツの処理と統合を担当

#### 2.2.3 サービスレイヤー
- **検索サービス**: 検索APIへのアクセスと結果のキャッシュを管理
- **コンテンツプロセッサー**: 異なる形式のコンテンツを処理
- **モデルセレクタ**: 適切なAIモデルの選択と初期化を担当

#### 2.2.4 プロバイダーレイヤー
- **検索プロバイダー**: Google検索など、具体的な検索APIへのアクセスを実装
- **AIモデルプロバイダー**: OpenAI、Anthropic、Googleなどの各AIモデルへのアクセスを実装

#### 2.2.5 ユーティリティレイヤー
- **設定管理**: アプリケーション設定の読み込みと管理
- **環境変数管理**: 環境変数の安全な取得と検証
- **エラーハンドリング**: 構造化されたエラー管理機能
- **ロギング**: アプリケーション動作の記録

### 2.3 モジュール間の依存関係

主要なモジュール間の依存関係は以下の通りです。矢印の方向はモジュールAがモジュールBに依存していることを示します。

```mermaid
flowchart TD
    メインエージェント --> 検索エージェント
    メインエージェント --> 情報処理エージェント
    メインエージェント --> モデルセレクタ
    検索エージェント --> 検索サービス
    情報処理エージェント --> コンテンツプロセッサー
    情報処理エージェント --> AIモデル
    モデルセレクタ --> AIモデル
    検索サービス --> 検索プロバイダー
    コンテンツプロセッサー --> フォーマットプロセッサー
    全コンポーネント --> 設定管理
    全コンポーネント --> エラーハンドリング
    全コンポーネント --> ロギング
```

この依存関係の設計により、各モジュールは具体的な実装ではなく抽象インターフェースに依存し、依存性の逆転原則(DIP)に準拠しています。これにより、モジュールの置き換えが容易になっています。

### 2.4 テクノロジースタック

#### 2.4.1 プログラミング言語とフレームワーク
- **言語**: TypeScript (JavaScript)
- **ランタイム**: Node.js
- **パッケージ管理**: npm

#### 2.4.2 主要ライブラリと依存関係
- **APIクライアント**: axios
- **HTML処理**: cheerio
- **PDF処理**: pdf.js
- **設定管理**: js-yaml
- **CLI処理**: commander
- **テスト**: Jest
- **ロギング**: winston

#### 2.4.3 外部サービス連携
- **OpenAI API**: GPTモデルへのアクセス
- **Anthropic API**: Claudeモデルへのアクセス
- **Google AI Studio API**: Geminiモデルへのアクセス
- **Google Custom Search API**: ウェブ検索

### 2.5 デプロイメントアーキテクチャ

情報収集エージェントは、以下の2つの主要なデプロイメントモードをサポートしています：

#### 2.5.1 スタンドアロンモード
ユーザーのローカルマシン上で実行され、CLIインターフェースを通じて操作します。

```mermaid
flowchart TD
    subgraph ローカルマシン
        A[情報収集エージェント]
    end
    A -->|API呼び出し| B
    subgraph 外部APIサービス
        B[AI API]
        C[検索 API]
    end
```

#### 2.5.2 ライブラリモード
他のアプリケーションに組み込んで利用する形式で、内部APIとして機能します。

```mermaid
flowchart TD
    subgraph ホストアプリケーション
        A[ビジネスロジック]
        B[UI層]
        C[情報収集エージェント]
        A --> C
    end
    C -->|API呼び出し| D
    subgraph 外部APIサービス
        D[AI API]
        E[検索 API]
    end
```

### 2.6 マルチ言語アーキテクチャ

2025年以降の多言語実装（Python、Rust、Go）では、以下の共通アーキテクチャ原則を維持します：

1. **共通インターフェース定義**：全ての言語実装で同一のインターフェース定義を使用
2. **言語特性を活かした実装**：各言語の強みを活かした実装（例：Rustのメモリ安全性、Goの並行処理）
3. **共通テストケース**：言語に依存しないテスト仕様の定義
4. **相互運用性**：異なる言語実装間でのデータ形式の互換性維持

```mermaid
flowchart TB
    A[TypeScript実装] --> E[共通仕様・インターフェース]
    B[Python実装] --> E
    C[Rust実装] --> E
    D[Go実装] --> E
```

## 3. コンポーネント詳細

このセクションでは、各コンポーネントの詳細な設計と実装について説明します。

### 3.1 メインエージェント

#### 3.1.1 概要
メインエージェントは情報収集エージェントの中心的なコンポーネントであり、全体の処理フローを制御します。ユーザークエリを受け取り、検索、情報処理、AIモデル呼び出しの調整を行います。

#### 3.1.2 主要責務
- ユーザークエリの受け取りと初期処理
- 検索エージェントの呼び出しと結果の取得
- 情報処理エージェントの呼び出しとコンテンツ統合
- AIモデルを使用した最終レスポンスの生成
- エラーハンドリングとリカバリー

#### 3.1.3 実装詳細
**ファイル**: `src/agents/main-agent.ts`

**主要クラス**: `MainAgent`

**シングルトンパターン**:
```typescript
private static instance: MainAgent | null = null;

public static getMainAgent(): MainAgent {
  if (!MainAgent.instance) {
    MainAgent.instance = new MainAgent();
  }
  return MainAgent.instance;
}
```

**主要メソッド**:
- `process(query: string, options?: ProcessOptions): Promise<string>` - クエリ処理の主要メソッド
- `processUrl(url: string, options?: ProcessOptions): Promise<string>` - URL直接処理メソッド
- `constructPrompt(query: string, context: string): string` - プロンプト構築メソッド
- `validateUrl(url: string): boolean` - URL検証メソッド

#### 3.1.4 内部状態管理
メインエージェントは以下の状態を管理します：
- 現在のモデルインスタンス
- 処理中のクエリ
- 設定パラメータ

#### 3.1.5 依存コンポーネント
- 検索エージェント (`SearchAgent`)
- 情報処理エージェント (`InfoProcessor`)
- モデルセレクタ (`ModelSelector`)
- 設定ローダー (`ConfigLoader`)

#### 3.1.6 エラー処理
メインエージェントは次のエラーシナリオを処理します：
- 検索エラー: 検索エージェントからのエラーをキャッチし、フォールバック処理
- 情報処理エラー: 部分的な情報で処理を継続
- AIモデルエラー: 代替モデルへの切り替え
- 一般的なエラー: エラー情報をログに記録し、適切なエラーメッセージを返す

### 3.2 検索エージェント

#### 3.2.1 概要
検索エージェントは、与えられたクエリに関連する情報を収集するためのウェブ検索を担当します。検索サービスとの連携、検索結果の処理、取得したURLからのコンテンツ抽出を行います。

#### 3.2.2 主要責務
- クエリに基づく検索の実行
- 検索結果の関連性評価
- URLからのコンテンツ取得
- 検索結果のキャッシュ管理
- レート制限の遵守

#### 3.2.3 実装詳細
**ファイル**: `src/agents/search-agent.ts`

**主要クラス**: `SearchAgent`

**シングルトンパターン**:
```typescript
private static instance: SearchAgent | null = null;

public static getSearchAgent(): SearchAgent {
  if (!SearchAgent.instance) {
    SearchAgent.instance = new SearchAgent();
  }
  return SearchAgent.instance;
}
```

**主要メソッド**:
- `search(query: string, options?: SearchOptions): Promise<SearchResult[]>` - 検索実行メソッド
- `fetchContent(url: string): Promise<string>` - URLからコンテンツを取得するメソッド
- `cleanHtml(html: string): string` - HTMLコンテンツからスクリプトや不要な要素を除去するメソッド
- `getRateLimitStatus(): RateLimitStatus` - 現在のレート制限状態を取得するメソッド

#### 3.2.4 内部状態管理
検索エージェントは次の状態を管理します：
- 検索サービスのインスタンス
- 検索エンジン設定
- キャッシュ状態

#### 3.2.5 依存コンポーネント
- 検索サービス (`SearchService`)
- HTML/コンテンツプロセッサー (`HtmlProcessor`)
- 設定ローダー (`ConfigLoader`)
- エラーハンドラー (`ErrorHandler`)

#### 3.2.6 URLコンテンツ取得処理
検索エージェントは、以下のステップでURLからコンテンツを取得します：
1. URLの妥当性検証
2. `axios`を使用したHTTPリクエスト送信
3. レスポンスのステータスコード確認
4. HTMLコンテンツのクリーニング
5. エラー処理とリトライロジック

#### 3.2.7 エラー処理
検索エージェントは以下のエラーシナリオを処理します：
- 検索API接続エラー: リトライまたは代替検索エンジンへの切り替え
- URL取得エラー: 個別URLのエラーを分離し、成功したURLのみで処理を続行
- レート制限エラー: バックオフと再試行、または日次クォータ制限到達時のユーザー通知

### 3.3 情報処理エージェント

#### 3.3.1 概要
情報処理エージェントは、検索エージェントから取得したコンテンツの処理、解析、関連性スコアリング、統合を担当します。コンテンツプロセッサーと連携して異なる形式のコンテンツを処理します。

#### 3.3.2 主要責務
- 異なる形式のコンテンツ処理（HTML、PDF等）
- テキスト抽出と前処理
- 関連性スコアリングと重要情報の抽出
- 複数ソースからの情報統合
- RAG (Retrieval-Augmented Generation) プロセスの実行

#### 3.3.3 実装詳細
**ファイル**: `src/agents/info-processor.ts`

**主要クラス**: `InfoProcessor`

**主要メソッド**:
- `processContent(content: string, query: string, options?: ProcessingOptions): Promise<ProcessedContent>` - コンテンツ処理メソッド
- `scoreRelevance(processedContent: ProcessedContent, query: string): number` - 関連性スコアリングメソッド
- `integrateContents(contents: ProcessedContent[]): Promise<IntegratedContent>` - コンテンツ統合メソッド
- `summarize(content: IntegratedContent, query: string): Promise<string>` - 要約生成メソッド

#### 3.3.4 内部状態管理
情報処理エージェントは以下の状態を管理します：
- 現在処理中のコンテンツ
- プロセッサー設定
- コンテキスト情報

#### 3.3.5 依存コンポーネント
- コンテンツプロセッサー (`ContentProcessor`)
- HTMLプロセッサー (`HtmlProcessor`)
- PDFプロセッサー (`PdfProcessor`)
- AIサマライザー (`AISummarizer`)
- コンテンツ統合プロセッサー (`ContentIntegrator`)
- RAGプロセッサー (`MultiStageRag`)

#### 3.3.6 マルチステージRAG処理
情報処理エージェントは、以下のステップでRAG処理を実行します：
1. 初期検索と情報収集
2. 初期検索結果に基づく深掘り検索
3. 関連コンテンツの抽出と前処理
4. コンテキスト構築とAIモデルへの入力生成
5. AIモデルによる知識拡張と回答生成

#### 3.3.7 エラー処理
情報処理エージェントは以下のエラーシナリオを処理します：
- コンテンツ処理エラー: 個別ドキュメントのエラーを分離し、処理可能なコンテンツのみで続行
- 統合処理エラー: 部分的な統合結果でも処理を続行
- モデル処理エラー: 代替の要約手法や簡略化処理に切り替え

### 3.4 モデルセレクタ

#### 3.4.1 概要
モデルセレクタは、利用可能なAIモデルの管理、適切なモデルの選択、モデルインスタンスの初期化を担当します。

#### 3.4.2 主要責務
- 利用可能なAIモデルの登録と管理
- 要件や設定に基づいた適切なモデルの選択
- モデルインスタンスの初期化と設定
- モデル間のフォールバック処理

#### 3.4.3 実装詳細
**ファイル**: `src/models/selector.ts`

**主要クラス**: `ModelSelector`

**主要メソッド**:
- `selectModel(modelName?: string): AIModel` - モデル名またはデフォルト設定に基づいたモデル選択
- `getAvailableModels(): string[]` - 利用可能なモデル一覧の取得
- `getModelByName(name: string): AIModel | null` - 名前指定でのモデル取得
- `registerModel(model: AIModel): void` - 新しいモデルの登録

#### 3.4.4 内部状態管理
モデルセレクタは以下の状態を管理します：
- 登録済みのモデルインスタンス
- デフォルトモデル設定
- モデル初期化状態

#### 3.4.5 依存コンポーネント
- AIモデルインターフェース (`AIModel`)
- 各種モデルプロバイダー (OpenAI, Anthropic, Google)
- 環境変数マネージャー (`EnvManager`)
- 設定ローダー (`ConfigLoader`)

#### 3.4.6 モデル選択ロジック
モデルセレクタは、以下の優先順位でモデルを選択します：
1. ユーザー指定モデル（名前で指定）
2. 設定ファイルのデフォルトモデル
3. 利用可能なモデルの中で最も優先度の高いもの
4. モデルが見つからない場合はエラーをスロー

#### 3.4.7 エラー処理
モデルセレクタは以下のエラーシナリオを処理します：
- モデル初期化エラー: 代替モデルを試行
- 指定モデルが見つからない: デフォルトモデルにフォールバック
- API認証エラー: 適切なエラーメッセージでユーザーに通知

### 3.5 検索サービス

#### 3.5.1 概要
検索サービスは、検索プロバイダーとの連携、検索結果のキャッシュ管理、レート制限制御を担当します。

#### 3.5.2 主要責務
- 検索プロバイダーの管理（Google検索等）
- 検索実行と結果の標準形式への変換
- 検索結果のキャッシュと再利用
- レート制限の管理と制御

#### 3.5.3 実装詳細
**ファイル**: `src/search/search-service.ts`

**主要クラス**: `SearchService`

**主要メソッド**:
- `search(query: string, options?: SearchOptions): Promise<SearchResult[]>` - 検索実行メソッド
- `searchWithProvider(query: string, providerName: string, options?: SearchOptions): Promise<SearchResult[]>` - 特定プロバイダーでの検索メソッド
- `getAvailableProviders(): string[]` - 利用可能な検索プロバイダー一覧の取得
- `getRateLimitStatus(): RateLimitStatus` - レート制限状態の取得

#### 3.5.4 内部状態管理
検索サービスは以下の状態を管理します：
- 検索プロバイダーインスタンス
- キャッシュマネージャー
- レート制限マネージャー

#### 3.5.5 依存コンポーネント
- 検索プロバイダーインターフェース (`ISearchProvider`)
- Google検索プロバイダー (`GoogleSearchProvider`)
- 検索キャッシュ (`SearchCache`)
- レート制限マネージャー (`RateLimiter`)
- 設定ローダー (`ConfigLoader`)

#### 3.5.6 キャッシュメカニズム
検索サービスは、以下のステップで検索結果をキャッシュします：
1. 検索前にキャッシュチェック
2. キャッシュヒットの場合はキャッシュから結果を返す
3. キャッシュミスの場合は検索を実行し、結果をキャッシュに保存
4. キャッシュの有効期限と最大サイズを管理

#### 3.5.7 エラー処理
検索サービスは以下のエラーシナリオを処理します：
- API接続エラー: リトライロジックと適切なエラーメッセージ
- レート制限エラー: バックオフアルゴリズムによる再試行
- 認証エラー: 設定の問題を特定するための詳細なエラーメッセージ

### 3.6 コンテンツプロセッサー

#### 3.6.1 概要
コンテンツプロセッサーは、異なる形式のコンテンツ（HTML、PDF等）を処理し、テキスト抽出、構造化、前処理を行うコンポーネントです。

#### 3.6.2 主要責務
- コンテンツタイプの判別
- HTML/PDFからのテキスト抽出
- 重要メタデータの抽出
- 不要な要素の除去とクリーニング
- テキストの正規化と前処理

#### 3.6.3 実装詳細
**ファイル**: `src/processors/html/html-processor.ts`, `src/processors/pdf/pdf-processor.ts`

**主要クラス**: `HtmlProcessor`, `PdfProcessor`

**主要メソッド**:
- `process(content: string): Promise<ProcessedContent>` - コンテンツ処理メソッド
- `extractMetadata(content: string): Metadata` - メタデータ抽出メソッド
- `cleanContent(content: string): string` - コンテンツクリーニングメソッド
- `extractMainText(content: string): string` - 主要テキスト抽出メソッド

#### 3.6.4 内部処理フロー
HTMLプロセッサーは、以下のステップでコンテンツを処理します：
1. HTMLの解析（cheerioライブラリ使用）
2. メタデータ（タイトル、説明、著者等）の抽出
3. 不要な要素（スクリプト、広告等）の除去
4. 主要コンテンツの特定と抽出
5. テキストの正規化と前処理

PDFプロセッサーは、以下のステップでコンテンツを処理します：
1. PDFの解析（pdf.jsライブラリ使用）
2. テキストコンテンツの抽出
3. ページ構造の保持
4. テキストの正規化と前処理

#### 3.6.5 依存コンポーネント
- HTML解析ライブラリ (cheerio)
- PDF処理ライブラリ (pdf.js)
- テキスト正規化ユーティリティ
- 設定ローダー (`ConfigLoader`)

#### 3.6.6 エラー処理
コンテンツプロセッサーは以下のエラーシナリオを処理します：
- 解析エラー: 一部解析できない場合でも処理可能な部分を抽出
- 不正なフォーマット: フォーマットエラーを検出し、適切なエラーメッセージを返す
- リソース制限: 大きすぎるコンテンツの処理を制限し、部分的な処理を実行

### 3.7 AIモデルプロバイダー

#### 3.7.1 概要
AIモデルプロバイダーは、各AIサービス（OpenAI、Anthropic、Google）への接続、API呼び出し、レスポンス処理を担当するコンポーネントです。

#### 3.7.2 主要責務
- AIサービスAPIとの通信
- リクエストの構築と送信
- レスポンスのパースと処理
- エラーハンドリングとリトライ
- ストリーミングレスポンスの処理

#### 3.7.3 実装詳細
**ファイル**: 
- `src/models/providers/openai-model.ts`
- `src/models/providers/anthropic-model.ts`
- `src/models/providers/google-model.ts`

**主要クラス**: `OpenAIModel`, `AnthropicModel`, `GoogleModel` (全てが `BaseModel` を継承し、`AIModel` インターフェースを実装)

**共通インターフェース**:
```typescript
interface AIModel {
  modelName: string;
  generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  generateTextStream?(prompt: string, options?: ModelOptions): AsyncGenerator<string, void, unknown>;
  isAvailable(): Promise<boolean>;
}
```

**主要メソッド**:
- `generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>` - テキスト生成メソッド
- `generateTextStream(prompt: string, options?: ModelOptions): AsyncGenerator<string, void, unknown>` - ストリーミングテキスト生成メソッド
- `isAvailable(): Promise<boolean>` - モデル利用可能性確認メソッド
- `handleError(error: any): AppError` - エラー処理メソッド

#### 3.7.4 内部状態管理
AIモデルプロバイダーは以下の状態を管理します：
- APIクライアントインスタンス
- API認証情報
- モデル設定（温度、トークン制限等）
- 現在のリクエスト状態

#### 3.7.5 依存コンポーネント
- APIクライアント (axios)
- 環境変数マネージャー (`EnvManager`)
- エラーハンドラー (`ErrorHandler`)
- ロガー (`Logger`)

#### 3.7.6 リトライメカニズム
AIモデルプロバイダーは、以下のリトライロジックを実装しています：
1. 一時的なエラー（レート制限、サーバー過負荷等）を検出
2. エクスポネンシャルバックオフアルゴリズムでの待機
3. 設定された最大リトライ回数まで再試行
4. リトライ失敗時のグレースフルデグラデーション

#### 3.7.7 エラー処理
AIモデルプロバイダーは以下のエラーシナリオを処理します：
- API認証エラー: 認証情報の問題を特定するためのエラーメッセージ
- レート制限エラー: バックオフと再試行
- コンテンツポリシー違反: ユーザーに適切なメッセージを返す
- ネットワークエラー: 接続問題のトラブルシューティング情報を含むエラー

### 3.8 環境変数マネージャー

#### 3.8.1 概要
環境変数マネージャーは、環境変数の管理、安全な取得、検証を担当するコンポーネントです。APIキーなどの機密情報を安全に管理します。

#### 3.8.2 主要責務
- 環境変数のロードと初期化
- 環境変数の存在チェックと検証
- 機密情報へのアクセス制御
- デフォルト値の提供

#### 3.8.3 実装詳細
**ファイル**: `src/config/env-manager.ts`

**主要クラス**: `EnvManager`

**シングルトンパターン**:
```typescript
private static instance: EnvManager | null = null;

public static getInstance(): EnvManager {
  if (!EnvManager.instance) {
    EnvManager.instance = new EnvManager();
  }
  return EnvManager.instance;
}
```

**主要メソッド**:
- `initialize(): void` - 環境変数の初期化
- `get(key: string, defaultValue?: string): string` - 環境変数取得メソッド
- `getRequired(key: string): string` - 必須環境変数取得メソッド（存在しない場合はエラー）
- `has(key: string): boolean` - 環境変数存在確認メソッド

#### 3.8.4 内部状態管理
環境変数マネージャーは以下の状態を管理します：
- 初期化状態
- 環境変数キャッシュ
- 検証結果

#### 3.8.5 依存コンポーネント
- Node.js `process.env`
- dotenv (`.env`ファイルのロード)
- エラーハンドラー (`ErrorHandler`)

#### 3.8.6 エラー処理
環境変数マネージャーは以下のエラーシナリオを処理します：
- 必須環境変数の欠落: 明確なエラーメッセージでユーザーに何が不足しているかを通知
- 不正な形式: 環境変数の形式が不正な場合の検証エラー
- 権限の問題: 環境変数にアクセスできない場合のエラー処理

### 3.9 エラーハンドラー

#### 3.9.1 概要
エラーハンドラーは、アプリケーション全体でのエラー管理、エラー情報の収集、適切なエラーレスポンスの生成を担当するコンポーネントです。

#### 3.9.2 主要責務
- 構造化されたエラー情報の生成
- エラータイプの分類とコード化
- エラーログの記録
- ユーザー向けエラーメッセージの生成
- リカバリーアクションの提案

#### 3.9.3 実装詳細
**ファイル**: `src/utils/error-handler.ts`

**主要クラス**: `AppError`, `ErrorHandler`

**エラークラス構造**:
```typescript
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly metadata?: Record<string, any>;

  constructor(message: string, code: ErrorCode, statusCode: number = 500, isOperational: boolean = true, metadata?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**主要メソッド**:
- `handleError(error: Error | AppError): AppError` - エラー処理メソッド
- `isOperationalError(error: Error | AppError): boolean` - 運用エラーか判別するメソッド
- `createError(message: string, code: ErrorCode, ...): AppError` - エラー生成ヘルパーメソッド
- `logError(error: Error | AppError): void` - エラーログ記録メソッド

#### 3.9.4 エラーコード体系
エラーハンドラーは、以下のカテゴリのエラーコードを定義しています：
- 認証/認可エラー (AUTH_*)
- 外部サービスエラー (EXTERNAL_*)
- 入力検証エラー (VALIDATION_*)
- リソースエラー (RESOURCE_*)
- システムエラー (SYSTEM_*)
- 未知のエラー (UNKNOWN)

#### 3.9.5 依存コンポーネント
- ロガー (`Logger`)
- 設定ローダー (`ConfigLoader`)

#### 3.9.6 エラー処理フロー
エラーハンドラーは、以下のステップでエラーを処理します：
1. エラーの捕捉と分類
2. エラー情報の構造化（`AppError`への変換）
3. エラーのログ記録
4. 運用エラーかプログラミングエラーかの判別
5. 適切なエラーレスポンスの生成

## 4. データフロー

このセクションでは、情報収集エージェント内での主要なデータフローを説明します。

### 4.1 基本データフロー

情報収集エージェントの基本的なデータフローは以下の通りです：

```mermaid
flowchart LR
    A[ユーザークエリ] --> B[メインエージェント]
    B --> C[検索エージェント]
    C --> D[検索サービス]
    D --> E[検索API実行]
    E --> F[検索結果返却]
    F --> C
    C --> G[URLコンテンツ取得]
    G --> H[コンテンツプロセッサー]
    H --> I[情報処理エージェント]
    I --> J[AIモデル]
    J --> I
    I --> B
    B --> K[最終結果返却]
```

### 4.2 クエリ処理フロー

ユーザークエリが処理される具体的なデータフローを示します：

1. **クエリ受付**:
   - ユーザーが自然言語クエリを入力
   - メインエージェントが `process()` メソッドを呼び出し

2. **検索実行**:
   - メインエージェントが検索エージェントの `search()` メソッドを呼び出し
   - 検索エージェントが検索サービスに検索を委譲
   - 検索サービスが適切な検索プロバイダーを選択して検索を実行
   - 検索結果（URL一覧）が返却される

3. **コンテンツ取得**:
   - 検索エージェントが各URLから `fetchContent()` メソッドを使用してコンテンツを取得
   - HTML/PDFなどのコンテンツが取得される
   - 取得したコンテンツを初期クリーニング

4. **コンテンツ処理**:
   - 情報処理エージェントが各コンテンツを処理
   - HTMLプロセッサー/PDFプロセッサーによるコンテンツ処理
   - 関連性スコアリングによる重要情報の抽出
   - 複数のコンテンツソースからの情報統合

5. **回答生成**:
   - AIモデルによる要約と回答生成
   - 処理済みコンテンツをコンテキストとして使用
   - ユーザークエリに対する直接的な回答を生成

6. **結果返却**:
   - 最終的な回答がユーザーに返却される

### 4.3 検索フロー詳細

検索処理の詳細なデータフローを示します：

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

キャッシュとレート制限の考慮:
1. 検索前にキャッシュをチェック
2. キャッシュヒットの場合はキャッシュから結果を返す
3. キャッシュミスの場合はレート制限をチェック
4. レート制限に問題がなければ検索APIを呼び出し
5. 検索結果をキャッシュに保存して返却

### 4.4 コンテンツ処理フロー

取得したコンテンツの処理フローを示します：

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

コンテンツ処理のステップ:
1. HTMLまたはPDFコンテンツの解析
2. メタデータ（タイトル、著者、日付など）の抽出
3. 不要要素（広告、ナビゲーション、フッターなど）の除去
4. メインコンテンツの抽出
5. テキストの正規化と前処理
6. 処理済みコンテンツの関連性スコアリング
7. 複数のコンテンツソースからの情報統合
8. AIモデルによる要約生成

### 4.5 AIモデル呼び出しフロー

AIモデル呼び出しのデータフローを示します：

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

APIモデル呼び出しのステップ:
1. モデルセレクタによる適切なモデルの選択
2. 環境変数マネージャーからAPIキーの取得
3. プロンプトの構築（クエリとコンテキスト情報）
4. AIモデルのgenerateText()メソッド呼び出し
5. APIクライアントによるモデルAPI呼び出し
6. APIレスポンスの受信と解析
7. 構造化されたモデルレスポンスの返却

### 4.6 エラーハンドリングフロー

エラー発生時のデータフローを示します：

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

エラーハンドリングのステップ:
1. API呼び出しなどの潜在的にエラーが発生する処理をtry/catchで囲む
2. エラー発生時にエラーハンドラーの`handleError()`メソッドを呼び出し
3. 発生したエラーを`AppError`クラスに変換して構造化
4. エラーコードの割当てとエラー分類
5. エラー情報をログに記録
6. エラーが操作可能（リカバリー可能）かどうかを判定
7. リカバリー可能な場合は適切なリカバリー処理を実行
8. リカバリー不可能な場合は適切なエラーメッセージをユーザーに返却

### 4.7 設定データフロー

アプリケーション設定のロードと利用のデータフローを示します：

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

## 5. シーケンス図

このセクションでは、情報収集エージェントの主要な処理のシーケンス図を示します。

### 5.1 基本的なクエリ処理シーケンス

以下は、基本的なクエリ処理のシーケンス図です：

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

### 5.2 エラー発生時のシーケンス

APIエラーが発生した場合のエラーハンドリングシーケンス：

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

### 5.3 環境変数ロード・設定シーケンス

アプリケーション起動時の環境変数と設定ロードのシーケンス：

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

### 5.4 キャッシュとレート制限シーケンス

検索機能でのキャッシュとレート制限のシーケンス：

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

### 5.4 検索リカバリーシーケンス

検索API障害時のリカバリーシーケンス：

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

## 6. 主要クラス・関数の説明

このセクションでは、システムの主要なクラス、インターフェース、関数の詳細な説明を提供します。

### 6.1 共通インターフェース

#### 6.1.1 AIModelインターフェース

AIモデルの共通インターフェースを定義します。

```typescript
interface AIModel {
  readonly modelName: string;
  readonly modelType: ModelType;
  
  generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  generateTextStream?(prompt: string, options?: ModelOptions): AsyncGenerator<string, void, unknown>;
  isAvailable(): Promise<boolean>;
}
```

**主要メソッド**:
- `generateText`: プロンプトに基づいてテキストを生成します
- `generateTextStream`: ストリーミングモードでテキストを生成します（オプション）
- `isAvailable`: モデルが現在利用可能かを確認します

#### 6.1.2 SearchProviderインターフェース

検索プロバイダーの共通インターフェースを定義します。

```typescript
interface SearchProvider {
  readonly providerName: string;
  
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getUsageInfo(): ProviderUsageInfo;
}
```

**主要メソッド**:
- `search`: 指定されたクエリで検索を実行します
- `getUsageInfo`: 現在の利用状況情報を取得します

#### 6.1.3 ContentProcessorインターフェース

コンテンツプロセッサーの共通インターフェースを定義します。

```typescript
interface ContentProcessor {
  readonly processorType: string;
  
  canProcess(content: string, contentType?: string): boolean;
  process(content: string, options?: ProcessingOptions): Promise<ProcessedContent>;
}
```

**主要メソッド**:
- `canProcess`: 指定されたコンテンツを処理できるかを判断します
- `process`: コンテンツを処理して構造化されたデータを返します

### 6.2 主要クラス

#### 6.2.1 MainAgent

システム全体のフローを制御するメインエージェントクラスです。

```typescript
class MainAgent {
  private readonly searchAgent: SearchAgent;
  private readonly infoProcessor: InfoProcessor;
  private readonly modelSelector: ModelSelector;
  
  constructor();
  
  public static getInstance(): MainAgent;
  public async process(query: string, options?: ProcessOptions): Promise<string>;
  public async processUrl(url: string, options?: ProcessOptions): Promise<string>;
  
  private constructPrompt(query: string, context: string): string;
  private validateUrl(url: string): boolean;
  private handleSearchError(error: Error, query: string): Promise<SearchResult[]>;
}
```

**主要メソッド**:
- `process`: ユーザークエリを処理するメインメソッド
- `processUrl`: 特定のURLを直接処理するメソッド
- `constructPrompt`: AIモデル用のプロンプトを構築します
- `handleSearchError`: 検索エラーを処理するメソッド

#### 6.2.2 SearchAgent

検索処理を担当するエージェントクラスです。

```typescript
class SearchAgent {
  private readonly searchService: SearchService;
  private readonly htmlProcessor: HtmlProcessor;
  
  constructor();
  
  public static getInstance(): SearchAgent;
  public async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  public async fetchContent(url: string): Promise<string>;
  
  private cleanHtml(html: string): string;
  private isRateLimited(): boolean;
  private handleRateLimitError(error: Error): void;
}
```

**主要メソッド**:
- `search`: クエリに基づいて検索を実行します
- `fetchContent`: URLからコンテンツを取得します
- `cleanHtml`: HTMLコンテンツを整理します
- `handleRateLimitError`: レート制限エラーを処理します

#### 6.2.3 InfoProcessor

コンテンツ処理と情報統合を担当するクラスです。

```typescript
class InfoProcessor {
  private readonly contentProcessors: Map<string, ContentProcessor>;
  private readonly aiSummarizer: AISummarizer;
  
  constructor();
  
  public async processContent(content: string, query: string, options?: ProcessingOptions): Promise<ProcessedContent>;
  public async integrateContents(contents: ProcessedContent[]): Promise<IntegratedContent>;
  public async summarize(content: IntegratedContent, query: string): Promise<string>;
  
  private scoreRelevance(processedContent: ProcessedContent, query: string): number;
  private selectProcessor(content: string, contentType?: string): ContentProcessor;
}
```

**主要メソッド**:
- `processContent`: 単一のコンテンツを処理します
- `integrateContents`: 複数のコンテンツソースを統合します
- `summarize`: コンテンツを要約します
- `scoreRelevance`: コンテンツの関連性をスコアリングします

#### 6.2.4 ModelSelector

適切なAIモデルを選択するクラスです。

```typescript
class ModelSelector {
  private readonly models: Map<string, AIModel>;
  private defaultModel: string;
  
  constructor();
  
  public selectModel(modelName?: string): AIModel;
  public getAvailableModels(): string[];
  public registerModel(model: AIModel): void;
  
  private initializeModels(): void;
  private getFallbackModel(preferredType?: ModelType): AIModel | null;
}
```

**主要メソッド**:
- `selectModel`: 名前または設定に基づいてモデルを選択します
- `getAvailableModels`: 利用可能なモデルの一覧を返します
- `registerModel`: 新しいモデルを登録します
- `getFallbackModel`: 代替モデルを取得します

#### 6.2.5 OpenAIModel

OpenAIのモデルを実装するクラスです。

```typescript
class OpenAIModel extends BaseModel implements AIModel {
  private readonly apiClient: AxiosInstance;
  private readonly apiKey: string;
  
  constructor(modelName: string, apiKey?: string);
  
  public async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  public async generateTextStream(prompt: string, options?: ModelOptions): AsyncGenerator<string, void, unknown>;
  public async isAvailable(): Promise<boolean>;
  
  private createCompletionRequest(prompt: string, options?: ModelOptions): CompletionRequest;
  private handleApiError(error: any): AppError;
}
```

**主要メソッド**:
- `generateText`: テキスト生成のメインメソッド
- `generateTextStream`: ストリーミングモードでテキスト生成
- `createCompletionRequest`: APIリクエストを構築します
- `handleApiError`: API特有のエラーを処理します

#### 6.2.6 SearchService

検索サービスを管理するクラスです。

```typescript
class SearchService {
  private readonly providers: Map<string, SearchProvider>;
  private readonly cache: SearchCache;
  private readonly rateLimiter: RateLimiter;
  
  constructor();
  
  public async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  public async searchWithProvider(query: string, providerName: string, options?: SearchOptions): Promise<SearchResult[]>;
  public getAvailableProviders(): string[];
  public getRateLimitStatus(): RateLimitStatus;
  
  private getCacheKey(query: string, options?: SearchOptions): string;
  private handleProviderError(error: Error, providerName: string, query: string): Promise<SearchResult[]>;
}
```

**主要メソッド**:
- `search`: デフォルトまたは指定プロバイダーで検索します
- `searchWithProvider`: 特定のプロバイダーで検索します
- `getRateLimitStatus`: 現在のレート制限状態を返します
- `handleProviderError`: プロバイダー固有のエラーを処理します

#### 6.2.7 HtmlProcessor

HTMLコンテンツを処理するクラスです。

```typescript
class HtmlProcessor implements ContentProcessor {
  public readonly processorType: string = 'html';
  
  constructor();
  
  public canProcess(content: string, contentType?: string): boolean;
  public async process(content: string, options?: ProcessingOptions): Promise<ProcessedContent>;
  
  private extractMetadata(dom: CheerioStatic): Metadata;
  private removeUnwantedElements(dom: CheerioStatic): void;
  private extractMainContent(dom: CheerioStatic): string;
  private normalizeText(text: string): string;
}
```

**主要メソッド**:
- `canProcess`: HTMLコンテンツかどうかを判断します
- `process`: HTMLコンテンツを処理します
- `extractMetadata`: メタデータ（タイトル、説明等）を抽出します
- `extractMainContent`: メインコンテンツ部分を抽出します

#### 6.2.8 ErrorHandler

エラー処理を担当するクラスです。

```typescript
class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private readonly logger: Logger;
  
  private constructor();
  
  public static getInstance(): ErrorHandler;
  public handleError(error: Error | AppError): AppError;
  public isOperationalError(error: Error | AppError): boolean;
  public createError(message: string, code: ErrorCode, statusCode?: number, isOperational?: boolean, metadata?: Record<string, any>): AppError;
  
  private logError(error: Error | AppError): void;
  private classifyError(error: Error): ErrorCode;
}
```

**主要メソッド**:
- `handleError`: エラーを処理し、AppErrorに変換します
- `isOperationalError`: 運用エラーか判別します
- `createError`: 新しいAppErrorを作成します
- `classifyError`: エラータイプを分類します

### 6.3 ユーティリティ関数

#### 6.3.1 設定関連関数

```typescript
// 設定ロード関数
function loadConfig(configPath?: string): Configuration;

// 設定検証関数
function validateConfig(config: unknown): Result<Configuration, ValidationError[]>;

// 環境変数からの設定オーバーライド
function overrideFromEnv(config: Configuration): Configuration;
```

#### 6.3.2 エラーハンドリング関数

```typescript
// 再試行処理を実装する関数
async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;

// エラーを変換する関数
function convertError(error: unknown, defaultMessage: string, code: ErrorCode): AppError;

// エラーログ記録関数
function logErrorDetails(error: AppError, context?: Record<string, any>): void;
```

#### 6.3.3 コンテンツ処理関数

```typescript
// HTMLクリーニング関数
function cleanHtml(html: string): string;

// 関連性スコアリング関数
function scoreContentRelevance(content: string, query: string): number;

// テキスト正規化関数
function normalizeText(text: string): string;
```

### 6.4 主要クラス間の関係図

以下のクラス図は、システムの主要クラスとそれらの関係を示しています。

```mermaid
classDiagram
    class MainAgent {
        -SearchAgent searchAgent
        -InfoProcessor infoProcessor
        -ModelSelector modelSelector
        +process(query: string): Promise~string~
        +processUrl(url: string): Promise~string~
    }
    
    class SearchAgent {
        -SearchService searchService
        -HtmlProcessor htmlProcessor
        +search(query: string): Promise~SearchResult[]~
        +fetchContent(url: string): Promise~string~
    }
    
    class InfoProcessor {
        -Map~string, ContentProcessor~ contentProcessors
        -AISummarizer aiSummarizer
        +processContent(content: string): Promise~ProcessedContent~
        +integrateContents(contents: ProcessedContent[]): Promise~IntegratedContent~
    }
    
    class ModelSelector {
        -Map~string, AIModel~ models
        -string defaultModel
        +selectModel(modelName?: string): AIModel
        +getAvailableModels(): string[]
    }
    
    class SearchService {
        -Map~string, SearchProvider~ providers
        -SearchCache cache
        -RateLimiter rateLimiter
        +search(query: string): Promise~SearchResult[]~
    }
    
    class ErrorHandler {
        -Logger logger
        +handleError(error: Error): AppError
        +isOperationalError(error: Error): boolean
    }
    
    %% インターフェース
    class AIModel {
        <<interface>>
        +modelName: string
        +modelType: ModelType
        +generateText(prompt: string): Promise~ModelResponse~
        +isAvailable(): Promise~boolean~
    }
    
    class SearchProvider {
        <<interface>>
        +providerName: string
        +search(query: string): Promise~SearchResult[]~
        +getUsageInfo(): ProviderUsageInfo
    }
    
    class ContentProcessor {
        <<interface>>
        +processorType: string
        +canProcess(content: string): boolean
        +process(content: string): Promise~ProcessedContent~
    }
    
    %% 実装クラス
    class OpenAIModel {
        -AxiosInstance apiClient
        -string apiKey
        +generateText(prompt: string): Promise~ModelResponse~
    }
    
    class GoogleSearchProvider {
        -string apiKey
        -string searchEngineId
        +search(query: string): Promise~SearchResult[]~
    }
    
    class HtmlProcessor {
        +canProcess(content: string): boolean
        +process(content: string): Promise~ProcessedContent~
    }
    
    %% 関連
    MainAgent --> SearchAgent
    MainAgent --> InfoProcessor
    MainAgent --> ModelSelector
    SearchAgent --> SearchService
    SearchAgent --> HtmlProcessor
    InfoProcessor --> ContentProcessor
    ModelSelector --> AIModel
    SearchService --> SearchProvider
    
    %% 実装関係
    AIModel <|.. OpenAIModel
    SearchProvider <|.. GoogleSearchProvider
    ContentProcessor <|.. HtmlProcessor
    
    %% 依存関係
    MainAgent ..> ErrorHandler
    SearchAgent ..> ErrorHandler
    InfoProcessor ..> ErrorHandler
    SearchService ..> ErrorHandler
```

## 7. エラーハンドリング設計

システムの堅牢性を確保するために、包括的なエラーハンドリング戦略を採用しています。

### 7.1 エラー分類体系

以下のカテゴリに基づいてエラーを分類します：

#### 7.1.1 エラータイプ

| エラータイプ | 説明 | 例 |
|----------|-----|-----|
| 運用エラー | 予期可能で回復可能なエラー | API制限、ネットワークタイムアウト |
| プログラミングエラー | バグや実装ミスによるエラー | Nullポインタ参照、型エラー |
| システムエラー | 基盤となるシステムリソースの問題 | メモリ不足、ディスク容量不足 |

#### 7.1.2 エラーコード体系

エラーコードは以下の形式に従います：`<カテゴリ>_<サブカテゴリ>_<具体的なエラー>`

| カテゴリ | サブカテゴリ | エラーコード例 | 説明 |
|---------|------------|--------------|------|
| AUTH | CREDENTIALS | AUTH_CREDENTIALS_INVALID | 無効な認証情報 |
|      | PERMISSIONS | AUTH_PERMISSIONS_INSUFFICIENT | 不十分な権限 |
| API | RATE_LIMIT | API_RATE_LIMIT_EXCEEDED | レート制限超過 |
|     | RESPONSE | API_RESPONSE_INVALID | 無効なAPI応答 |
| VALIDATION | INPUT | VALIDATION_INPUT_INVALID | 無効な入力パラメータ |
|           | FORMAT | VALIDATION_FORMAT_INVALID | 無効なデータ形式 |
| RESOURCE | NOT_FOUND | RESOURCE_NOT_FOUND | リソースが見つからない |
|         | UNAVAILABLE | RESOURCE_UNAVAILABLE | リソースが一時的に利用不可 |
| SYSTEM | MEMORY | SYSTEM_MEMORY_INSUFFICIENT | メモリ不足 |
|        | DISK | SYSTEM_DISK_FULL | ディスク容量不足 |
| NETWORK | CONNECTION | NETWORK_CONNECTION_FAILED | 接続失敗 |
|         | TIMEOUT | NETWORK_TIMEOUT | タイムアウト |
| UNKNOWN | GENERAL | UNKNOWN_ERROR | 原因不明のエラー |

### 7.2 エラー処理戦略

#### 7.2.1 一般的なエラー処理フロー

```
エラー発生 --> エラー検知 --> エラー分類 --> エラー処理 --> リカバリー/報告
```

#### 7.2.2 階層別エラー処理

各レイヤーで以下のエラー処理を行います：

1. **プロバイダーレイヤー**
   - 外部APIエラーの詳細なキャプチャ
   - エラーの一次変換（生のAPIエラー → AppError）
   - リトライロジックの実装

2. **サービスレイヤー**
   - フォールバックメカニズムの実装
   - 代替サービスへの切り替え
   - 部分的な結果の処理

3. **エージェントレイヤー**
   - エンドユーザー向けエラーメッセージの生成
   - 機能の段階的縮小（グレースフルデグラデーション）
   - エラーコンテキストの集約

4. **インターフェースレイヤー**
   - ユーザーへの適切なエラー表示
   - エラーログの記録
   - アクションの提案

### 7.3 リカバリー戦略

#### 7.3.1 リトライメカニズム

一時的なエラーに対するリトライ戦略：

```typescript
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, backoffFactor = 2, initialDelay = 1000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        break;
      }
      
      const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

#### 7.3.2 フォールバックメカニズム

サービスやプロバイダーが利用できない場合のフォールバック戦略：

1. **AIモデルフォールバック**：
   - 優先モデル（OpenAI） → 代替モデル（Anthropic） → 最終手段モデル（Google）

2. **検索プロバイダーフォールバック**：
   - メインプロバイダー → バックアッププロバイダー → キャッシュからの限定的回答

3. **コンテンツ処理フォールバック**：
   - フルHTML処理 → 簡易テキスト抽出 → メタデータのみ

#### 7.3.3 グレースフルデグラデーション

すべてのシステム機能が利用できない場合でも、できる限りサービスを提供する戦略：

1. 完全機能モード：検索 + コンテンツ取得 + AIモデル処理
2. 制限モード：検索 + AIモデル処理（コンテンツ取得なし）
3. 基本モード：キャッシュ済み検索結果 + AIモデル処理
4. 最小モード：AIモデルのみ（コンテキストなし）
5. フォールバックモード：事前定義されたメッセージとエラー説明

### 7.4 ユーザー通知

#### 7.4.1 エラーメッセージの設計原則

1. **明確さ**：何が起きたかを明確に説明
2. **原因**：なぜ問題が発生したかの説明
3. **解決策**：ユーザーができる対処法の提案
4. **フレンドリー**：技術的すぎない言葉づかい

#### 7.4.2 エラーメッセージの例

| エラーコード | ユーザー向けメッセージ |
|------------|----------------------|
| API_RATE_LIMIT_EXCEEDED | 「現在、検索サービスの利用制限に達しています。しばらく待ってから再試行してください。」 |
| AUTH_CREDENTIALS_INVALID | 「APIキーが正しくないか期限切れです。.envファイルでAPIキーを確認してください。」 |
| NETWORK_CONNECTION_FAILED | 「ネットワーク接続に問題が発生しました。インターネット接続を確認して再試行してください。」 |
| RESOURCE_NOT_FOUND | 「検索結果から有効な情報を見つけることができませんでした。別のクエリを試してみてください。」 |

#### 7.4.3 進行状況と部分的な結果の表示

完全な結果が得られない場合でも、進行状況と部分的な結果を提供します：

```
検索実行中... 完了
コンテンツ取得中... 3/5のURLから情報を取得しました（2つのURLでエラーが発生）
情報処理中... 完了
回答生成中... 完了

[部分的な結果に基づいた回答]

注意: 一部の情報ソースにアクセスできなかったため、この回答は不完全な可能性があります。
```

### 7.5 エラーログとモニタリング

#### 7.5.1 エラーログの構造

各エラーログには以下の情報を含めます：

```json
{
  "timestamp": "2025-03-15T14:30:45.123Z",
  "errorCode": "API_RATE_LIMIT_EXCEEDED",
  "message": "Google Search API rate limit exceeded",
  "severity": "WARNING",
  "context": {
    "query": "example search query",
    "component": "SearchService",
    "method": "search",
    "attemptCount": 3
  },
  "stackTrace": "...",
  "metadata": {
    "rateLimitReset": "2025-03-15T14:35:00Z",
    "currentUsage": 95,
    "limit": 100
  }
}
```

#### 7.5.2 エラー頻度の監視

特定のエラータイプの発生頻度を監視し、傾向分析を行います：

1. レート制限エラーの急増 → クォータ増加の検討
2. ネットワークエラーの集中 → インフラ問題の調査
3. 特定のURLでの一貫したエラー → 処理ロジックの見直し

## 8. テスト戦略

情報収集エージェントの品質と信頼性を確保するためのテスト戦略について説明します。

### 8.1 テストレベル

#### 8.1.1 単体テスト (Unit Testing)

個々のクラスや関数の動作を検証します。

**対象**:
- ユーティリティ関数
- 個々のクラスのメソッド
- 独立したロジック

**フレームワーク**: Jest

**テスト例**:
```typescript
// HtmlProcessor.test.ts
describe('HtmlProcessor', () => {
  const processor = new HtmlProcessor();
  
  test('extractMetadata should extract title correctly', () => {
    const html = '<html><head><title>テストタイトル</title></head><body>...</body></html>';
    const metadata = processor.extractMetadata(cheerio.load(html));
    expect(metadata.title).toBe('テストタイトル');
  });
  
  test('cleanHtml should remove script tags', () => {
    const html = '<html><body><script>alert("test")</script><div>コンテンツ</div></body></html>';
    const cleaned = processor.cleanHtml(html);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).toContain('<div>コンテンツ</div>');
  });
});
```

#### 8.1.2 統合テスト (Integration Testing)

複数のコンポーネント間の連携を検証します。

**対象**:
- エージェント + サービス
- サービス + プロバイダー
- 複数のサービスの連携

**フレームワーク**: Jest + TestContainers

**テスト例**:
```typescript
// SearchAgent.integration.test.ts
describe('SearchAgent Integration', () => {
  let searchAgent: SearchAgent;
  let mockSearchService: SearchService;
  
  beforeEach(() => {
    mockSearchService = new MockSearchService();
    searchAgent = new SearchAgent(mockSearchService);
  });
  
  test('search should return processed results', async () => {
    const query = 'テストクエリ';
    const results = await searchAgent.search(query);
    
    expect(results).toHaveLength(5);
    expect(results[0].title).toBeDefined();
    expect(results[0].url).toBeDefined();
    expect(mockSearchService.search).toHaveBeenCalledWith(query, expect.anything());
  });
});
```

#### 8.1.3 システムテスト (System Testing)

システム全体の動作を検証します。

**対象**:
- エンドツーエンドのプロセス
- ユーザーシナリオ
- パフォーマンス

**フレームワーク**: Jest + Puppeteer (CLIの場合)

**テスト例**:
```typescript
// E2E.test.ts
describe('End-to-End Tests', () => {
  test('should process query and return valid result', async () => {
    const result = await runCommand('npm start -- --query "太陽系について教えてください" --model openai');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('太陽系');
    expect(result.stdout).toContain('惑星');
    expect(result.executionTime).toBeLessThan(30000); // 30秒以内に完了すべき
  });
});
```

### 8.2 モックとスタブ

外部依存性をモックすることで、制御された環境でテストを実施します。

#### 8.2.1 モック対象

- 外部APIとの通信
- ファイルシステム操作
- データベース操作

#### 8.2.2 モック実装例

**APIモックの例**:
```typescript
// mock-openai-model.ts
export class MockOpenAIModel implements AIModel {
  public readonly modelName = 'mock-gpt-4';
  public readonly modelType = ModelType.OpenAI;
  
  public async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    // 決定論的な応答を返す
    return {
      text: `これは「${prompt.substring(0, 50)}...」に対するモック応答です。`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      modelName: this.modelName
    };
  }
  
  public async isAvailable(): Promise<boolean> {
    return true;
  }
}
```

**検索サービスモックの例**:
```typescript
// mock-search-service.ts
export class MockSearchService implements SearchService {
  public async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // 固定の検索結果を返す
    return [
      { title: `${query} に関する結果1`, url: 'https://example.com/1', snippet: '...', score: 0.95 },
      { title: `${query} に関する結果2`, url: 'https://example.com/2', snippet: '...', score: 0.85 },
      // ...
    ];
  }
}
```

### 8.3 テストデータ管理

#### 8.3.1 テストデータの種類

- **フィクスチャ**: 静的なHTMLファイル、検索レスポンス、API応答のJSONなど
- **ファクトリー**: テストデータを動的に生成する関数
- **シナリオ**: 特定のテストケース用の入力と期待される出力のセット

#### 8.3.2 テストデータの構成

```
test/
├── fixtures/
│   ├── html/
│   │   ├── article-with-metadata.html
│   │   └── complex-page.html
│   ├── search-responses/
│   │   ├── google-search-result.json
│   │   └── empty-search-result.json
│   └── api-responses/
│       ├── openai-response.json
│       └── error-responses/
│           ├── rate-limit-error.json
│           └── auth-error.json
├── factories/
│   ├── content-factory.ts
│   └── search-result-factory.ts
└── scenarios/
    ├── successful-search-scenario.ts
    └── error-scenarios.ts
```

### 8.4 自動テスト戦略

#### 8.4.1 CI/CDパイプライン

GitHubアクションを使用して自動テストを実行します：

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
    - name: Install dependencies
      run: npm ci
    - name: Run linter
      run: npm run lint
    - name: Run unit tests
      run: npm test
    - name: Run integration tests
      run: npm run test:integration
    - name: Run system tests
      run: npm run test:system
    - name: Upload coverage reports
      uses: codecov/codecov-action@v1
```

#### 8.4.2 テストカバレッジ目標

- 単体テスト: 90%以上
- 統合テスト: 80%以上
- システムテスト: 主要ユーザーフロー100%カバー

#### 8.4.3 テスト結果レポート

カバレッジレポートの例：

```
----------------------------|---------|----------|---------|---------|-------------------
File                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------------|---------|----------|---------|---------|-------------------
All files                   |   92.33 |    85.71 |   91.67 |   92.33 |                   
 src/agents                 |   94.44 |    86.96 |   92.31 |   94.44 |                   
  main-agent.ts             |   95.45 |    87.50 |   93.33 |   95.45 | 142,187           
  search-agent.ts           |   93.33 |    86.36 |   91.67 |   93.33 | 56,98,210         
 src/models                 |   91.89 |    84.62 |   90.91 |   91.89 |                   
  selector.ts               |   96.88 |    91.67 |  100.00 |   96.88 | 45                
 src/processors             |   92.86 |    85.71 |   95.65 |   92.86 |                   
  html-processor.ts         |   91.67 |    83.33 |   94.74 |   91.67 | 76-78,120-122     
  pdf-processor.ts          |   95.24 |    90.91 |  100.00 |   95.24 | 84                
----------------------------|---------|----------|---------|---------|-------------------
```

### 8.5 テスト自動化の課題と対策

#### 8.5.1 外部API依存のテスト

**課題**: 実際のAPIを呼び出すとコストがかかり、テストが不安定になる。

**対策**:
- VCRライブラリ（nock）を使用してAPIリクエストを記録・再生
- 偽のAPIサーバー（MSW）を使用
- API呼び出しを抽象レイヤーで分離し、テスト中は置き換え可能に

#### 8.5.2 非決定論的処理のテスト

**課題**: AIモデルは毎回異なる結果を返すため、テストが困難。

**対策**:
- 結果の構造のみを検証（具体的な内容ではなく）
- 特定のキーワードを含むかどうかのみを検証
- 固定シードを使用（可能な場合）

#### 8.5.3 レート制限の対策

**課題**: テスト中のAPI呼び出しがレート制限に達する。

**対策**:
- テスト用の別APIキーを使用
- テストの実行を分散
- モックレスポンスを優先的に使用

## 9. 技術的課題と解決策

情報収集エージェントの開発における主要な技術的課題とその解決策を説明します。

### 9.1 APIキー管理と安全性

#### 9.1.1 課題

- 複数のAPIキー（OpenAI、Anthropic、Google）の安全な管理
- キーの漏洩リスク
- APIキーのローテーションとバージョン管理

#### 9.1.2 解決策

1. **環境変数による管理**
   - すべてのAPIキーを環境変数として管理
   - `.env`ファイルはバージョン管理対象外に設定（`.gitignore`に追加）
   - `.env.sample`ファイルで必要な変数の例を提供

2. **キー管理セキュリティ**
   - 環境変数マネージャーがキーへのアクセスを制御
   - キー値をログに出力しない
   - メモリ内でキー値を必要な最小限の時間だけ保持

3. **実装例**:
```typescript
// src/config/env-manager.ts
class EnvManager {
  // ...
  
  // APIキーを取得するメソッド（セキュアなアクセス）
  public getApiKey(provider: string): string {
    const key = this.getRequired(`${provider.toUpperCase()}_API_KEY`);
    
    // キーの形式を検証
    if (!this.validateApiKeyFormat(provider, key)) {
      throw new AppError(`Invalid ${provider} API key format`, ErrorCode.AUTH_CREDENTIALS_INVALID);
    }
    
    return key;
  }
  
  // キーの形式を検証（プロバイダー固有のルール）
  private validateApiKeyFormat(provider: string, key: string): boolean {
    switch (provider.toLowerCase()) {
      case 'openai':
        return /^sk-[a-zA-Z0-9]{48}$/.test(key);
      case 'anthropic':
        return /^sk-ant-[a-zA-Z0-9]{48}$/.test(key);
      case 'google':
        return /^[a-zA-Z0-9_-]{39}$/.test(key);
      default:
        return true;
    }
  }
}
```

### 9.2 レート制限の管理

#### 9.2.1 課題

- 外部APIの利用制限（検索API、AIモデルAPI）
- 複数ユーザー間での公平な制限分配
- 制限到達時の優雅な処理

#### 9.2.2 解決策

1. **レート制限追跡システム**
   - サービスごとに使用量を追跡
   - タイムウィンドウベースの制限管理（1分あたり、1日あたりなど）
   - 使用量メトリクスの収集

2. **適応型リクエスト制御**
   - 使用量に基づいたスロットリング
   - バックオフと再試行メカニズム
   - 制限に近づいたときの警告

3. **実装例**:
```typescript
// src/utils/rate-limiter.ts
class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private usage: Map<string, number> = new Map();
  private resetTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    // 制限の初期化
    this.limits.set('google-search', { maxRequests: 100, windowMs: 60 * 1000 }); // 1分あたり100リクエスト
    this.limits.set('openai-api', { maxRequests: 3000, windowMs: 60 * 1000 }); // 1分あたり3000トークン
    // ...他のサービスも同様に設定
  }
  
  // リクエスト前のチェック
  public canMakeRequest(service: string, cost: number = 1): boolean {
    const limit = this.limits.get(service);
    const currentUsage = this.usage.get(service) || 0;
    
    if (!limit) return true; // 制限未設定のサービスは許可
    
    return currentUsage + cost <= limit.maxRequests;
  }
  
  // リクエスト後の使用量増加
  public incrementUsage(service: string, cost: number = 1): void {
    const currentUsage = this.usage.get(service) || 0;
    this.usage.set(service, currentUsage + cost);
    
    // このサービスのリセットタイマーがまだなければ作成
    if (!this.resetTimers.has(service)) {
      const limit = this.limits.get(service);
      if (limit) {
        const timer = setTimeout(() => {
          this.usage.set(service, 0);
          this.resetTimers.delete(service);
        }, limit.windowMs);
        
        this.resetTimers.set(service, timer);
      }
    }
  }
}
```

### 9.3 コンテンツ抽出の精度

#### 9.3.1 課題

- 多様なウェブサイト構造からの正確なコンテンツ抽出
- 広告、ナビゲーション、フッターなどの不要要素の除去
- 多言語コンテンツへの対応

#### 9.3.2 解決策

1. **ヒューリスティックベースの抽出**
   - コンテンツ密度分析（テキストvs.HTML比率）
   - セマンティックHTMLタグ（article, main, section）の優先
   - 一般的な広告・ナビゲーションパターンの除外

2. **機械学習支援抽出**
   - 主要コンテンツ特定のためのシンプルな分類器
   - タグパターン認識
   - 事前学習済みモデルの利用

3. **実装例**:
```typescript
// src/processors/extractors/content-extractor.ts
class ContentExtractor {
  // 主要コンテンツの特定
  public extractMainContent(dom: CheerioStatic): string {
    // 1. 明示的なコンテンツタグを探す
    const articleContent = dom('article, [role="main"], .main-content, #content, .post-content').first();
    if (articleContent.length && this.isContentSubstantial(articleContent)) {
      return this.cleanAndNormalize(articleContent.html() || '');
    }
    
    // 2. コンテンツ密度分析
    const contentBlocks = this.findContentBlocks(dom);
    if (contentBlocks.length) {
      return this.cleanAndNormalize(contentBlocks.map(block => block.html() || '').join(''));
    }
    
    // 3. フォールバック：body全体からナビゲーションなどを除去
    const body = dom('body').clone();
    this.removeNonContentElements(body);
    return this.cleanAndNormalize(body.html() || '');
  }
  
  // テキスト密度に基づいてコンテンツブロックを特定
  private findContentBlocks(dom: CheerioStatic): Cheerio {
    const candidates: Array<{element: Cheerio, score: number}> = [];
    
    dom('p').each((_, paragraph) => {
      const p = dom(paragraph);
      const parent = p.parent();
      
      // 既に評価済みの親要素はスキップ
      if (candidates.some(c => c.element.is(parent))) return;
      
      // テキスト密度とコンテンツ長に基づいてスコア計算
      const textLength = parent.text().length;
      const htmlLength = parent.html()?.length || 1;
      const textDensity = textLength / htmlLength;
      const paragraphCount = parent.find('p').length;
      
      const score = textDensity * Math.min(paragraphCount, 5) * Math.min(textLength / 500, 3);
      
      candidates.push({ element: parent, score });
    });
    
    // スコアでソートして上位のコンテンツブロックを返す
    candidates.sort((a, b) => b.score - a.score);
    return dom(candidates.slice(0, 3).map(c => c.element).get());
  }
}
```

### 9.4 多様なAIモデル統合

#### 9.4.1 課題

- 異なるAIモデルのAPI仕様の違い
- 各モデルの特性と強みの活用
- 新しいモデルの迅速な統合

#### 9.4.2 解決策

1. **抽象化レイヤーの設計**
   - 共通インターフェースの定義（AIModel）
   - プロバイダー固有の実装をカプセル化
   - アダプターパターンの適用

2. **モデル特性のプロファイリング**
   - 各モデルの強みと弱みのデータベース
   - ユースケースに基づいたモデル選択ロジック
   - 結果品質のフィードバックループ

3. **実装例**:
```typescript
// src/models/model-registry.ts
class ModelRegistry {
  private models: Map<string, AIModelProfile> = new Map();
  
  constructor() {
    this.registerModel({
      name: 'gpt-4',
      provider: 'openai',
      capabilities: {
        reasoning: 0.95,
        creativity: 0.90,
        knowledgeCutoff: '2023-04',
        contextWindow: 8192,
        japanese: 0.85
      },
      costPerToken: 0.00006,
      factory: (config) => new OpenAIModel('gpt-4', config.apiKey)
    });
    
    this.registerModel({
      name: 'claude-3-opus',
      provider: 'anthropic',
      capabilities: {
        reasoning: 0.92,
        creativity: 0.85,
        knowledgeCutoff: '2023-08',
        contextWindow: 100000,
        japanese: 0.80
      },
      costPerToken: 0.00005,
      factory: (config) => new AnthropicModel('claude-3-opus', config.apiKey)
    });
    
    // ... 他のモデルも登録
  }
  
  // ユースケースに最適なモデルを選択
  public selectModelForUseCase(useCase: UseCase, constraints?: ModelConstraints): AIModel {
    const candidates = Array.from(this.models.values())
      .filter(model => this.meetsConstraints(model, constraints))
      .map(model => ({
        model,
        score: this.scoreModelForUseCase(model, useCase)
      }));
    
    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0]?.model;
    
    if (!selected) {
      throw new AppError('No suitable model found for the use case', ErrorCode.RESOURCE_UNAVAILABLE);
    }
    
    return selected.factory({
      apiKey: envManager.getApiKey(selected.provider)
    });
  }
}
```

### 9.5 情報の関連性評価と高精度検索

#### 9.5.1 課題

- クエリに関連する適切な情報の特定
- 複数のソースからの情報の評価と統合
- 情報の新鮮さと信頼性の確保

#### 9.5.2 解決策

1. **セマンティック検索技術**
   - テキスト埋め込みモデルによる意味的類似性の計算
   - 関連性に基づく情報のランキング
   - クエリ拡張（同義語、関連語句の追加）

2. **マルチステージ検索**
   - 初期検索で広範なコンテンツを収集
   - 収集した情報に基づいてクエリを洗練
   - 深掘り検索で情報を補完

3. **実装例**:
```typescript
// src/search/semantic-search.ts
class SemanticSearch {
  private embedder: TextEmbedder;
  
  constructor(embedder: TextEmbedder) {
    this.embedder = embedder;
  }
  
  // セマンティック検索の実行
  public async search(query: string, documents: string[]): Promise<RankedDocument[]> {
    // クエリの埋め込みベクトルを取得
    const queryEmbedding = await this.embedder.embed(query);
    
    // 各ドキュメントの埋め込みを計算
    const documentEmbeddings = await Promise.all(
      documents.map(doc => this.embedder.embed(doc))
    );
    
    // コサイン類似度に基づいて関連性スコアを計算
    const rankedDocs = documents.map((text, i) => ({
      text,
      score: this.cosineSimilarity(queryEmbedding, documentEmbeddings[i])
    }));
    
    // スコア順にソート
    return rankedDocs.sort((a, b) => b.score - a.score);
  }
  
  // クエリ拡張
  public async expandQuery(query: string): Promise<string> {
    // AIモデルを使用してクエリを拡張
    const prompt = `
      Original query: "${query}"
      Please expand this query with related terms, synonyms, and alternative phrasings to improve search results.
      Format the output as a comma-separated list of search terms.
    `;
    
    const model = modelSelector.selectModel('gpt-3.5-turbo');
    const response = await model.generateText(prompt);
    
    // 元のクエリと拡張クエリを組み合わせる
    return `${query}, ${response.text}`;
  }
}
```

### 9.6 国際化と多言語対応

#### 9.6.1 課題

- 日本語コンテンツと英語コンテンツの両方を処理
- 言語間の構文と構造の違いへの対応
- 多言語でのコンテンツ正規化

#### 9.6.2 解決策

1. **言語検出と処理の最適化**
   - コンテンツの言語自動検出
   - 言語固有の前処理フィルター
   - 言語ごとのトークン化戦略

2. **翻訳とクロスリンガル処理**
   - 必要に応じたコンテンツ翻訳
   - 言語間でのセマンティックマッピング
   - クロスリンガル埋め込みモデルの使用

3. **実装例**:
```typescript
// src/processors/language/language-processor.ts
class LanguageProcessor {
  private langDetector: LanguageDetector;
  private processors: Map<string, LanguageSpecificProcessor> = new Map();
  
  constructor() {
    this.langDetector = new LanguageDetector();
    
    // 言語固有のプロセッサーを登録
    this.processors.set('ja', new JapaneseProcessor());
    this.processors.set('en', new EnglishProcessor());
    this.processors.set('default', new DefaultProcessor());
  }
  
  // コンテンツの言語を検出して適切な処理を適用
  public async processContent(content: string): Promise<ProcessedContent> {
    // 言語検出
    const lang = await this.langDetector.detect(content);
    
    // 適切なプロセッサーを選択
    const processor = this.processors.get(lang) || this.processors.get('default');
    
    // 言語固有の処理を適用
    return processor.process(content);
  }
}

// 日本語特有の処理
class JapaneseProcessor implements LanguageSpecificProcessor {
  public async process(content: string): Promise<ProcessedContent> {
    // 日本語特有の前処理
    content = this.normalizeJapaneseText(content);
    
    // 日本語形態素解析による分かち書き
    const tokens = await this.tokenizeJapanese(content);
    
    // ... その他の処理
    
    return {
      text: content,
      tokens,
      language: 'ja',
      // ... その他のメタデータ
    };
  }
  
  private normalizeJapaneseText(text: string): string {
    // 全角英数字を半角に変換
    text = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    
    // 特殊な句読点の正規化
    text = text.replace(/[、]/g, '、').replace(/[。]/g, '。');
    
    return text;
  }
}
```

### 9.7 パフォーマンスと拡張性

#### 9.7.1 課題

- 大量のURLとコンテンツ処理の効率化
- 並行処理とリソース管理
- 将来的な機能拡張への対応

#### 9.7.2 解決策

1. **並行処理の最適化**
   - Promise.allで複数のURLを並行処理
   - 並行度の制御とバッチ処理
   - スロットリングによるリソース使用の最適化

2. **キャッシュ戦略**
   - マルチレベルキャッシング（メモリ、ファイル）
   - 時間ベースと参照ベースの有効期限
   - コンテンツ更新検出（ETags, Last-Modified）

3. **実装例**:
```typescript
// src/utils/concurrency.ts
class ConcurrencyManager {
  // 並行実行数を制限して非同期タスクを実行
  public async runWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    maxConcurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const task of tasks) {
      // 実行中のタスクが上限に達したら、どれか1つの完了を待つ
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
      
      // 新しいタスクを実行
      const p = Promise.resolve().then(async () => {
        try {
          const result = await task();
          results.push(result);
        } catch (err) {
          console.error('Task error:', err);
          // エラーをスローせず、結果に含めない
        }
      }).finally(() => {
        // 実行中リストから削除
        executing.splice(executing.indexOf(p), 1);
      });
      
      executing.push(p);
    }
    
    // 残りのタスクが完了するのを待つ
    await Promise.all(executing);
    
    return results;
  }
}

// 使用例（複数URLからのコンテンツ取得）
async function fetchContentsWithLimits(urls: string[]): Promise<string[]> {
  const concurrencyManager = new ConcurrencyManager();
  
  const tasks = urls.map(url => async () => {
    return await axios.get(url).then(res => res.data);
  });
  
  return await concurrencyManager.runWithConcurrencyLimit(tasks, 3);
}
```

## 10. 運用ガイドライン

### 10.1 インストールと設定

#### 10.1.1 前提条件

- **Node.js**: バージョン16.0.0以上
- **npm**: バージョン8.0.0以上
- **APIアクセス**:
  - OpenAI API
  - Anthropic API（オプション）
  - Google AI API（オプション）
  - Google Custom Search API

#### 10.1.2 インストール手順

```bash
# リポジトリのクローン
git clone https://github.com/your-organization/information-collection-agent.git
cd information-collection-agent

# 依存パッケージのインストール
npm install

# TypeScriptのビルド
npm run build
```

#### 10.1.3 環境変数設定

`.env.sample`ファイルを`.env`としてコピーし、必要な環境変数を設定します：

```
# .env
# AIモデルAPI設定
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 検索API設定
GOOGLE_SEARCH_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_SEARCH_ENGINE_ID=xxxxxxxxxx:xxxxxxxxxx

# アプリケーション設定
DEFAULT_MODEL=gpt-4
MAX_SEARCH_RESULTS=5
CACHE_DURATION=3600
LOG_LEVEL=info
```

#### 10.1.4 設定ファイルカスタマイズ

`config/default.yml`ファイルで詳細な設定をカスタマイズできます：

```yaml
# config/default.yml
app:
  name: "情報収集エージェント"
  version: "1.0.0"
  
models:
  default: "gpt-4"
  fallbacks:
    - "claude-3-opus"
    - "gemini-pro"
  
search:
  maxResults: 5
  cacheEnabled: true
  cacheDuration: 3600
  
processing:
  parallelUrls: 3
  timeout: 30000
  
logging:
  level: "info"
  format: "json"
  destination: "console"
```

### 10.2 利用方法

#### 10.2.1 コマンドラインインターフェース

```bash
# 基本的な使用法
npm start -- --query "太陽系について教えてください"

# モデル指定
npm start -- --query "太陽系について教えてください" --model claude-3-opus

# 検索結果数の制限
npm start -- --query "太陽系について教えてください" --results 10

# 詳細ログ出力
npm start -- --query "太陽系について教えてください" --verbose

# ヘルプの表示
npm start -- --help
```

#### 10.2.2 プログラムからの利用

```typescript
import { Agent } from 'information-collection-agent';

async function main() {
  // エージェントの初期化
  const agent = new Agent({
    model: 'gpt-4',
    maxResults: 5,
    verbose: false
  });

  // 情報収集と回答生成
  const result = await agent.process('太陽系について教えてください');
  console.log(result);
}

main().catch(console.error);
```

### 10.3 メンテナンスと運用

#### 10.3.1 ログ管理

ログは以下の形式で出力されます：

```json
{
  "level": "info",
  "timestamp": "2025-03-15T12:34:56.789Z",
  "message": "Processing query",
  "context": {
    "query": "太陽系について教えてください",
    "model": "gpt-4",
    "requestId": "req-1234-5678-90ab-cdef"
  }
}
```

ログレベルは以下から選択できます：
- `error`: エラーイベントのみ
- `warn`: 警告とエラー
- `info`: 通常の動作情報（デフォルト）
- `debug`: 詳細な動作情報
- `trace`: 非常に詳細な動作情報

#### 10.3.2 キャッシュメンテナンス

キャッシュは以下の場所に保存されます：
- 検索結果: `cache/search/`
- コンテンツ: `cache/content/`

キャッシュのクリーニング：

```bash
# すべてのキャッシュをクリア
npm run cache:clear

# 検索キャッシュのみクリア
npm run cache:clear:search

# 古いキャッシュ（7日以上）のみクリア
npm run cache:clear:old
```

#### 10.3.3 API使用量モニタリング

APIの使用量を監視するためのコマンド：

```bash
# 使用状況レポートの生成
npm run report:usage

# 日次使用状況の確認
npm run report:usage:daily

# 月次使用状況の確認
npm run report:usage:monthly
```

### 10.4 トラブルシューティング

#### 10.4.1 一般的な問題と解決策

| 問題 | 考えられる原因 | 解決策 |
|------|--------------|-------|
| API接続エラー | APIキーが無効または期限切れ | `.env`ファイルのAPIキーを確認し更新 |
| レート制限エラー | 短時間に多くのリクエストを送信 | `--delay`オプションを使用、バッチ処理を検討 |
| メモリ使用量過多 | 大量のURLを同時処理 | `processing.parallelUrls`設定を減らす |
| タイムアウトエラー | サーバーの応答が遅い | `processing.timeout`設定を増やす |
| 出力が不適切 | プロンプトが最適でない | `config/prompts/`の該当するプロンプトを調整 |

#### 10.4.2 エラーコードとその意味

| エラーコード | 意味 | 対処法 |
|------------|-----|-------|
| `AUTH_CREDENTIALS_INVALID` | APIキーが無効 | `.env`ファイルのAPIキーを確認・更新 |
| `API_RATE_LIMIT_EXCEEDED` | レート制限に達した | 時間をおいて再試行するか、別のAPIキーを使用 |
| `NETWORK_CONNECTION_FAILED` | ネットワーク接続エラー | ネットワーク接続を確認、プロキシ設定を確認 |
| `RESOURCE_NOT_FOUND` | リソースが見つからない | URLが正しいか確認、別のキーワードで検索 |
| `SYSTEM_MEMORY_INSUFFICIENT` | メモリ不足 | 処理するURL数を減らす、Node.jsのメモリ制限を上げる |

#### 10.4.3 診断モード

問題の診断のために診断モードを使用できます：

```bash
# 診断モードで実行
npm start -- --query "テスト" --diagnostic

# 特定コンポーネントの詳細診断
npm start -- --query "テスト" --diagnostic-component search
```

診断モードでは以下の情報が出力されます：
- 詳細なAPI呼び出し情報
- タイミング情報（各ステップの所要時間）
- メモリ使用状況
- システム構成情報

### 10.5 アップデートとバージョン管理

#### 10.5.1 更新手順

```bash
# 最新バージョンに更新
git pull origin main
npm install
npm run build

# 特定バージョンに更新
git checkout v1.2.0
npm install
npm run build
```

#### 10.5.2 バージョン履歴確認

```bash
# バージョン確認
npm run version

# 変更履歴の表示
npm run changelog
```

#### 10.5.3 バックアップと復元

```bash
# 設定のバックアップ
npm run backup:config

# キャッシュを含む完全バックアップ
npm run backup:full

# バックアップからの復元
npm run restore --backup-file backup-2025-03-15.zip
```