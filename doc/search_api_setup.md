# 検索API設定ガイド

## Google Custom Search API設定手順

1. Google Cloud Consoleにアクセス: https://console.cloud.google.com/
2. 新しいプロジェクトを作成またはプロジェクトを選択
3. APIライブラリから「Custom Search API」を有効化
4. 認証情報を作成し、APIキーを取得
5. Custom Search Engineを設定: https://cse.google.com/cse/all
6. 検索エンジンIDを取得

## 環境変数の設定

プロジェクトのルートディレクトリに`.env`ファイルを作成し、以下の変数を設定：

```
GOOGLE_SEARCH_API_KEY=あなたのGoogleAPIキー
GOOGLE_SEARCH_ENGINE_ID=あなたの検索エンジンID
```

## 使用制限と注意点

- Google Custom Search APIは1日あたり100クエリまで無料
- 追加クエリは1000クエリごとに$5の料金
- レート制限を守るために実装された制限機能を活用すること

## トラブルシューティング

### よくある問題と解決策

1. **APIキーが無効**
   - Google Cloud Consoleでキーの制限がないことを確認
   - キーが有効化されているか確認（無効化されている場合は再有効化）

2. **リクエスト数超過**
   - キャッシュ機能を活用して重複リクエストを削減
   - 1日のクエリ制限を確認し、予算に応じて増加

3. **検索結果が少ない**
   - 検索エンジン設定で「全ウェブを検索」が有効になっているか確認
   - 検索キーワードを調整（より一般的な用語を使用）

## Bing Search API（今後実装予定）

Microsoft Bing Search APIも今後追加予定です。設定手順は追って更新します。 