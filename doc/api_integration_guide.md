# 外部API連携ガイドライン

## 1. 概要

情報収集エージェントは、AIモデルAPIと検索APIの2種類の外部APIに依存しています。本ドキュメントでは、これらのAPIとの連携方法、設定方法、および開発時の注意点について解説します。

## 2. AIモデルAPI

### 2.1 サポートするAIモデルプロバイダー

現在、以下のAIモデルプロバイダーをサポートしています：

1. **Anthropic Claude**
   - 高度な理解力と長文処理能力
   - 情報抽出と要約に強み

2. **OpenAI GPT**
   - 優れた汎用性
   - コードと構造化データ生成に強み

3. **Google Gemini**
   - マルチモーダル処理能力
   - 分析と推論に強み

### 2.2 API設定

各AIモデルへの接続は、`.env`ファイルで設定します。以下の環境変数を設定してください：

```
# Anthropic設定
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-opus-20240229

# OpenAI設定
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo

# Google設定
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-1.5-pro
```

`.env.sample`ファイルをコピーして`.env`ファイルを作成し、必要なAPIキーを設定してください。

### 2.3 モデル実装

新しいAIモデルを追加する場合は、以下の手順に従ってください：

1. **モデルクラスの作成**
   - `src/models/providers`ディレクトリに新しいモデルクラスファイルを作成
   - `BaseModel`クラスを継承し、必要なメソッドを実装

2. **インターフェースの実装**
   - `IAIModel`インターフェースに定義されたメソッドを全て実装
   - 特に`generateText`と`generateTextStream`メソッドの実装が必要

3. **モデルセレクタへの登録**
   - `src/models/selector.ts`ファイルの`ModelSelector`クラスを更新
   - `initializeModels`メソッド内で新しいモデルを登録

### 2.4 エラーハンドリング

AIモデルAPIとの通信時には、以下のエラーを考慮する必要があります：

1. **認証エラー**
   - APIキーが無効または期限切れの場合
   - 対応: 適切なエラーメッセージで`MODEL_AUTH_ERROR`を返す

2. **レート制限エラー**
   - APIの使用制限に達した場合
   - 対応: 指数バックオフによるリトライと`MODEL_RATE_LIMIT_ERROR`の返却

3. **モデル利用不可エラー**
   - 指定されたモデルが利用できない場合
   - 対応: 代替モデルへのフォールバックまたは`MODEL_UNAVAILABLE_ERROR`の返却

4. **コンテンツポリシー違反**
   - 入力内容がコンテンツポリシーに違反する場合
   - 対応: ユーザーへの通知と`MODEL_CONTENT_POLICY_ERROR`の返却

### 2.5 パフォーマンス最適化

AIモデルAPIの利用にあたり、以下の最適化を検討してください：

1. **トークン使用量の最適化**
   - 不要なコンテキスト情報を削除
   - プロンプトを最適化して簡潔にする

2. **キャッシュ戦略**
   - 同一クエリに対する結果をキャッシュ
   - 有効期限付きキャッシュの実装

3. **並列リクエスト**
   - 独立した複数のクエリを並列処理
   - Promise.allを活用した効率的な実行

## 3. 検索API

### 3.1 サポートする検索エンジン

現在、以下の検索エンジンをサポートしています：

1. **Google Custom Search**
   - 広範なインデックスと高精度
   - 最大100件/日の無料利用枠

2. **Bing Search**
   - Microsoftの検索エンジン
   - 無料利用枠あり

3. **DuckDuckGo**
   - プライバシー重視の検索エンジン
   - API利用制限なし

### 3.2 API設定

検索APIの設定は、`.env`ファイルで行います：

```
# Google Custom Search設定
GOOGLE_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_google_search_engine_id

# Bing Search設定
BING_SEARCH_API_KEY=your_bing_search_api_key

# DuckDuckGo設定
# APIキーは不要
```

### 3.3 検索エンジン実装

新しい検索エンジンを追加する場合は、以下の手順に従ってください：

1. **検索エンジンクラスの作成**
   - `src/agents/search/engines`ディレクトリに新しいエンジンクラスを作成
   - 共通インターフェースを実装

2. **検索結果の標準化**
   - 異なる検索エンジンからの結果を統一フォーマットに変換
   - `SearchResult`インターフェースに適合させる

3. **SearchAgentへの登録**
   - `src/agents/search-agent.ts`の`validEngines`配列に新しいエンジンを追加
   - 対応するエンジン処理ロジックを`search`メソッドに追加

### 3.4 エラーハンドリング

検索APIとの通信時には、以下のエラーを考慮する必要があります：

1. **認証エラー**
   - APIキーが無効または期限切れの場合
   - 対応: ユーザーに通知して`SEARCH_AUTH_ERROR`を返す

2. **クエリエラー**
   - 検索クエリが無効な場合
   - 対応: クエリの修正提案と`SEARCH_QUERY_ERROR`の返却

3. **レート制限エラー**
   - API使用制限に達した場合
   - 対応: 別の検索エンジンへの切替えまたは`SEARCH_RATE_LIMIT_ERROR`の返却

4. **ネットワークエラー**
   - 接続タイムアウトなどのネットワーク問題
   - 対応: リトライロジックと`SEARCH_NETWORK_ERROR`の返却

### 3.5 Webコンテンツ取得

検索結果のURLからコンテンツを取得する際には、以下の点に注意してください：

1. **HTMLパース**
   - cheerioなどのライブラリを使用してDOM解析
   - メタデータとコンテンツの抽出

2. **コンテンツ抽出**
   - 主要なコンテンツ部分の特定と抽出
   - 不要な要素（広告、ナビゲーションなど）の除去

3. **テキスト正規化**
   - 余分な空白や特殊文字の除去
   - 段落や見出しの構造を保持

4. **エラー処理**
   - アクセス拒否（403）への対応
   - タイムアウト処理

## 4. API接続テスト

開発およびデプロイ時には、以下のテストを実施してAPIの接続状況を確認してください：

### 4.1 AIモデルAPI接続テスト

```typescript
// AIモデルAPIのテスト方法
import { getDefaultModel } from '../src/models/selector';

async function testModelConnection() {
  try {
    const model = getDefaultModel();
    const response = await model.generateText('Hello, world!');
    console.log('AIモデル接続成功:', response.text);
    return true;
  } catch (error) {
    console.error('AIモデル接続失敗:', error);
    return false;
  }
}
```

### 4.2 検索API接続テスト

```typescript
// 検索APIのテスト方法
import { getSearchAgent } from '../src/agents/search-agent';

async function testSearchConnection() {
  try {
    const searchAgent = getSearchAgent();
    const results = await searchAgent.search('test query');
    console.log('検索API接続成功:', results.length, '件の結果');
    return true;
  } catch (error) {
    console.error('検索API接続失敗:', error);
    return false;
  }
}
```

## 5. API利用の制限と注意点

### 5.1 コスト管理

1. **予算設定**
   - 各APIの利用上限を設定
   - コスト監視とアラート設定

2. **利用状況の監視**
   - APIリクエスト数の記録
   - 日次/月次レポートの生成

### 5.2 APIキーの管理

1. **セキュアな保存**
   - 環境変数またはシークレット管理サービスの使用
   - ソースコードに直接記載しない

2. **アクセス制限**
   - APIキーのIP制限設定
   - 最小権限の原則に基づくアクセス許可

### 5.3 フォールバックメカニズム

1. **代替サービス**
   - 主要サービスが利用できない場合の代替手段
   - グレースフル・デグラデーション

2. **エラー時の振る舞い**
   - ユーザーへの適切な通知
   - 部分的な機能提供の継続

## 6. APIのバージョン管理

各APIのバージョン変更に対応するため、以下の方針を採用しています：

1. **アダプターパターンの採用**
   - APIの特定バージョンに依存しないインターフェース設計
   - バージョン固有のロジックをアダプターに隔離

2. **変更の監視**
   - API提供元の更新情報の定期的な確認
   - 重要な変更に関するアラート設定

3. **定期的な互換性テスト**
   - 既存コードと最新APIの互換性確認
   - 必要に応じたアダプターの更新

## 7. トラブルシューティング

### 7.1 よくある問題と解決策

1. **認証エラー**
   - APIキーの再生成
   - 権限設定の確認

2. **レート制限**
   - リクエスト間隔の調整
   - バルクオペレーションの最適化

3. **タイムアウト**
   - ネットワーク接続の確認
   - リクエストタイムアウト値の調整

### 7.2 ログ収集と分析

1. **詳細なログ記録**
   - リクエスト/レスポンスの記録
   - エラー情報とスタックトレースの保存

2. **統計分析**
   - エラー率の監視
   - レスポンス時間の傾向分析

## 8. 参考リソース

### 8.1 API公式ドキュメント

- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Google AI API](https://ai.google.dev/docs)
- [Google Custom Search API](https://developers.google.com/custom-search/v1/introduction)
- [Bing Search API](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api)

### 8.2 関連ライブラリ

- [@langchain/anthropic](https://www.npmjs.com/package/@langchain/anthropic) - Anthropic Claude連携
- [openai](https://www.npmjs.com/package/openai) - OpenAI API連携
- [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) - Google AI連携
- [axios](https://www.npmjs.com/package/axios) - HTTPリクエスト
- [cheerio](https://www.npmjs.com/package/cheerio) - HTML解析 