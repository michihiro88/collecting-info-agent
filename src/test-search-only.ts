/**
 * 検索機能のテスト用スクリプト
 */
import { SearchService } from './search/search-service';
import logger from './utils/logger';

async function main() {
  try {
    // コマンドライン引数を取得
    const query = process.argv[2];
    
    if (!query) {
      console.error('使用方法: node dist/test-search-only.js "検索クエリ"');
      process.exit(1);
    }
    
    console.log(`クエリ: ${query}`);
    
    // 検索サービスのインスタンスを作成
    const searchService = new SearchService();
    
    // 利用可能な検索プロバイダーを確認
    const providers = searchService.getAvailableProviders();
    console.log(`利用可能な検索プロバイダー: ${providers.join(', ') || '利用可能なプロバイダーがありません'}`);
    
    if (providers.length === 0) {
      console.log('利用可能な検索プロバイダーがありません。.envファイルのAPIキー設定を確認してください。');
      process.exit(1);
    }
    
    console.log('検索を開始します...');
    
    // 検索を実行
    const startTime = Date.now();
    const results = await searchService.search(query);
    const endTime = Date.now();
    
    console.log(`検索結果: ${results.length}件`);
    
    if (results.length > 0) {
      console.log('\n最初の結果:');
      console.log(`タイトル: ${results[0].title}`);
      console.log(`URL: ${results[0].url}`);
      console.log(`スニペット: ${results[0].snippet}`);
    } else {
      console.log('検索結果はありませんでした。');
    }
    
    console.log(`\n検索処理時間: ${(endTime - startTime) / 1000}秒`);
    
    // 成功時にプロセスを終了
    process.exit(0);
  } catch (error) {
    logger.error('検索テスト中にエラーが発生しました', { error });
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 