/**
 * 設定ファイルテスト用スクリプト
 */
import { getConfigLoader } from './config/config-loader';
import logger from './utils/logger';

async function main() {
  try {
    console.log('設定ファイルの読み込みテストを開始します...');
    
    // 設定ローダーを取得
    const configLoader = getConfigLoader();
    
    // 設定を取得
    const config = configLoader.getConfig();
    
    console.log('\n--- 設定ファイル読み込み結果 ---\n');
    
    // 一般設定の確認
    console.log('一般設定:');
    console.log(`  - ワークスペース: ${config.general.workspace}`);
    console.log(`  - キャッシュディレクトリ: ${config.general.cacheDir}`);
    console.log(`  - レポートディレクトリ: ${config.general.reportDir}`);
    console.log(`  - 最大同時タスク数: ${config.general.maxConcurrentTasks}`);
    
    // モデル設定の確認
    console.log('\nモデル設定:');
    console.log(`  - デフォルトモデル: ${config.models.default}`);
    console.log(`  - 利用可能なモデル数: ${config.models.available.length}`);
    
    // 最初のモデル情報を表示
    if (config.models.available.length > 0) {
      const firstModel = config.models.available[0];
      console.log('\n  最初のモデル情報:');
      console.log(`    - 名前: ${firstModel.name}`);
      console.log(`    - プロバイダー: ${firstModel.provider}`);
      console.log(`    - APIキー環境変数: ${firstModel.apiKeyEnv}`);
      console.log(`    - 最大トークン数: ${firstModel.maxTokens}`);
      console.log(`    - 温度: ${firstModel.temperature}`);
    }
    
    // 検索設定の確認
    console.log('\n検索設定:');
    console.log(`  - 最大結果数: ${config.search.maxResults}`);
    console.log(`  - デフォルト深度: ${config.search.defaultDepth}`);
    console.log(`  - UserAgent: ${config.search.userAgent}`);
    console.log(`  - 毎分リクエスト数: ${config.search.rateLimit.requestsPerMinute}`);
    console.log(`  - 並列リクエスト数: ${config.search.rateLimit.parallelRequests}`);
    
    // ロギング設定の確認
    console.log('\nロギング設定:');
    console.log(`  - レベル: ${config.logging.level}`);
    console.log(`  - ファイル: ${config.logging.file}`);
    console.log(`  - 最大サイズ: ${config.logging.maxSize}`);
    console.log(`  - 最大ファイル数: ${config.logging.maxFiles}`);
    console.log(`  - チャットログ: ${config.logging.chatLog}`);
    
    console.log('\n設定ファイルの読み込みテストが完了しました。');
    
    // 成功時にプロセスを終了
    process.exit(0);
  } catch (error) {
    console.error('設定ファイルの読み込み中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 