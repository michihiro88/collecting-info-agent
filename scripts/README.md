# テスト自動化スクリプト

このディレクトリには、プロジェクトのテスト自動化のためのPowerShellスクリプトが含まれています。これらのスクリプトは、異なる種類のテストを実行し、結果を収集・レポートします。

## 前提条件

- PowerShell 5.1以上
- Node.js 14.x以上
- NPM 6.x以上
- TSC（TypeScriptコンパイラ）
- Jest（テストランナー）

## スクリプトの概要

### メインスクリプト

- **Test-All.ps1**: すべてのテストを順番に実行するメインスクリプト
  ```powershell
  # 基本実行
  .\Test-All.ps1
  
  # 結果を保存してレポートを生成する場合
  .\Test-All.ps1 -SaveResults -GenerateReport
  
  # 特定のテストをスキップする場合
  .\Test-All.ps1 -SkipRagTest -SaveResults
  
  # レポート生成後に自動で開く場合
  .\Test-All.ps1 -SaveResults -GenerateReport -OpenReport
  ```

### 個別テストスクリプト

- **Test-Rag.ps1**: RAG（Retrieval Augmented Generation）機能のテスト
  ```powershell
  # 基本実行
  .\Test-Rag.ps1
  
  # クエリを指定して実行
  .\Test-Rag.ps1 -Query "AIとは何ですか？"
  
  # モデルを指定して実行
  .\Test-Rag.ps1 -Query "AIとは何ですか？" -Model "gpt-4"
  
  # 結果を保存する場合
  .\Test-Rag.ps1 -Query "AIとは何ですか？" -SaveResults
  ```

- **Test-Models.ps1**: AIモデルプロバイダーのテスト
  ```powershell
  # すべてのプロバイダをテスト
  .\Test-Models.ps1
  
  # 特定のプロバイダのみテスト
  .\Test-Models.ps1 -Provider openai
  .\Test-Models.ps1 -Provider anthropic
  .\Test-Models.ps1 -Provider google
  
  # 結果を保存する場合
  .\Test-Models.ps1 -Provider all -SaveResults
  
  # レポートも生成する場合
  .\Test-Models.ps1 -Provider all -SaveResults -GenerateReport
  ```

### ユーティリティスクリプト

- **Generate-TestReport.ps1**: テスト結果からHTMLレポートを生成
  ```powershell
  # 基本実行
  .\Generate-TestReport.ps1
  
  # 出力ディレクトリを指定
  .\Generate-TestReport.ps1 -OutputDir "reports"
  
  # レポート名を指定
  .\Generate-TestReport.ps1 -ReportName "テスト結果_2023-10-01"
  
  # すべての詳細を含める
  .\Generate-TestReport.ps1 -IncludeAllDetails
  
  # 生成後にレポートを開く
  .\Generate-TestReport.ps1 -OpenReport
  ```

- **TestUtility.psm1**: 共通ユーティリティ関数を含むモジュール
  - このモジュールは直接実行するものではなく、他のスクリプトから参照されます
  - エラーハンドリング、ログ出力、環境変数読み込み、テスト結果保存などの機能を提供

## テスト結果の形式

テスト結果は以下の構造のJSONファイルとして保存されます：

```json
{
  "test_name": "テスト名",
  "success": true/false,
  "duration_ms": 1234,
  "timestamp": "2023-10-01T12:34:56Z",
  "stdout": "コマンド出力（オプション）",
  "exit_code": 0,
  "error": "エラーメッセージ（失敗時のみ）",
  "skipped": false,
  "reason": "スキップ理由（スキップ時のみ）"
}
```

## レポートの例

生成されるHTMLレポートには以下の情報が含まれます：

- テスト実行の概要（総数、成功数、失敗数、スキップ数）
- 成功率の表示
- 各テストの詳細（名前、結果、所要時間）
- 失敗したテストのエラー詳細（オプション）
- コマンド出力のログ（オプション）

## トラブルシューティング

- **.envファイルがない**: プロジェクトルートに`.env`ファイルが必要です。`.env.sample`をコピーして作成してください。
- **実行ポリシーエラー**: PowerShellの実行ポリシーが制限されている場合は、以下のコマンドで一時的に変更できます：
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
- **モジュールが見つからない**: モジュールのインポートに失敗する場合は、パスが正しいか確認してください。
- **テスト結果が保存されない**: 出力ディレクトリが存在するか、書き込み権限があるか確認してください。 