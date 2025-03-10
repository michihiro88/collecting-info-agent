# テスト自動化の改善点

## 現状の課題

テスト実行スクリプトに関して、以下の課題が確認されました：

1. **PowerShellスクリプトのエンコーディング問題**
   - 日本語を含むPowerShellスクリプトが文字化けする
   - UTF-8エンコーディングの問題により、スクリプトが正常に実行できない

2. **リダイレクト演算子の互換性問題**
   - PowerShellの`2>&1`などのリダイレクト演算子がエラーを引き起こす
   - クロスプラットフォーム対応が不十分

3. **エラーハンドリングの不足**
   - テスト失敗時の詳細情報が十分に記録されていない
   - エラーの種類に応じた適切な対応が行われていない

4. **テスト結果の収集と報告の仕組みが不十分**
   - テスト結果が構造化されていない
   - レポート生成機能が不安定

## 改善策

### 1. エンコーディング問題の解決

- **UTF-8 with BOMの使用**
  ```powershell
  # UTF-8 with BOMでファイルを保存
  $content = Get-Content -Path script.ps1 -Raw
  [System.IO.File]::WriteAllText("script.ps1", $content, [System.Text.Encoding]::UTF8)
  ```

- **バッチファイルとPowerShellの併用**
  ```batch
  @echo off
  powershell -ExecutionPolicy Bypass -File "%~dp0\run-tests.ps1" %*
  exit /b %ERRORLEVEL%
  ```

### 2. クロスプラットフォーム対応の強化

- **プラットフォーム検出と分岐処理**
  ```powershell
  if ($IsWindows) {
      # Windows固有の処理
  } elseif ($IsLinux) {
      # Linux固有の処理
  } elseif ($IsMacOS) {
      # macOS固有の処理
  }
  ```

- **リダイレクト処理の改善**
  ```powershell
  # 一時ファイルを使用した出力キャプチャ
  $tempFile = [System.IO.Path]::GetTempFileName()
  Start-Process -FilePath "npx" -ArgumentList "jest" -NoNewWindow -Wait -RedirectStandardOutput $tempFile
  $output = Get-Content -Path $tempFile -Raw
  Remove-Item -Path $tempFile -Force
  ```

### 3. エラーハンドリングの強化

- **構造化されたエラー情報**
  ```powershell
  try {
      # テスト実行
  } catch {
      $errorInfo = @{
          message = $_.Exception.Message
          type = $_.Exception.GetType().Name
          stackTrace = $_.ScriptStackTrace
          timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      }
      $errorInfo | ConvertTo-Json | Out-File "error-log.json"
  }
  ```

- **エラータイプに応じた処理**
  ```powershell
  catch {
      switch -Regex ($_.Exception.Message) {
          "Cannot find module" { 
              Write-Host "モジュールが見つかりません。依存関係を確認してください。" -ForegroundColor Red
          }
          "Timeout" { 
              Write-Host "テストがタイムアウトしました。処理時間を確認してください。" -ForegroundColor Yellow
          }
          default { 
              Write-Host "エラーが発生しました: $_" -ForegroundColor Red
          }
      }
  }
  ```

### 4. テスト結果の収集と報告の改善

- **構造化されたテスト結果**
  ```powershell
  $testResult = @{
      name = "単体テスト"
      success = $exitCode -eq 0
      duration_ms = $duration.TotalMilliseconds
      timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      details = @{
          total = $totalTests
          passed = $passedTests
          failed = $failedTests
          skipped = $skippedTests
      }
  }
  $testResult | ConvertTo-Json | Out-File "test-result.json"
  ```

- **HTML形式のレポート生成**
  ```powershell
  function Generate-HtmlReport {
      param (
          [string]$ResultFile,
          [string]$OutputFile
      )
      
      $results = Get-Content $ResultFile | ConvertFrom-Json
      
      $html = @"
  <!DOCTYPE html>
  <html>
  <head>
      <title>テスト結果レポート</title>
      <style>
          body { font-family: Arial, sans-serif; }
          .success { color: green; }
          .failure { color: red; }
      </style>
  </head>
  <body>
      <h1>テスト結果レポート</h1>
      <p>実行日時: $($results.timestamp)</p>
      <p class="$(if($results.success){'success'}else{'failure'})">
          結果: $(if($results.success){'成功'}else{'失敗'})
      </p>
      <!-- 詳細情報 -->
  </body>
  </html>
  "@
      
      $html | Out-File $OutputFile -Encoding utf8
  }
  ```

## 実装計画

1. **基本的なテスト実行スクリプトの作成**
   - UTF-8 with BOMエンコーディングで保存
   - クロスプラットフォーム対応の実装
   - 基本的なエラーハンドリングの追加

2. **テスト結果収集機能の実装**
   - JSON形式でのテスト結果保存
   - テスト実行時間、成功/失敗状態の記録
   - エラー情報の詳細な記録

3. **レポート生成機能の実装**
   - HTML形式のレポート生成
   - テスト結果の視覚的表示
   - エラー詳細の表示

4. **CI/CD統合の準備**
   - GitHub Actionsなどのワークフロー定義
   - 自動テスト実行の設定
   - 結果通知の仕組み

## 今後の展望

- **テストカバレッジの測定と報告**
  - Jestのカバレッジレポート機能の活用
  - カバレッジ目標の設定と監視

- **パフォーマンステストの追加**
  - 処理時間の測定と閾値設定
  - ボトルネックの特定と改善

- **E2Eテストの自動化**
  - ユーザーシナリオに基づくE2Eテスト
  - 実際の環境に近い条件でのテスト実行 