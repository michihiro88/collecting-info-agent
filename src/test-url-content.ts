/**
 * URLからコンテンツを取得するテスト用スクリプト
 */
import { SearchService } from './search/search-service';
import logger from './utils/logger';

async function main() {
  try {
    // コマンドライン引数を取得
    const url = process.argv[2];
    
    if (!url) {
      console.error('使用方法: node dist/test-url-content.js "URL"');
      process.exit(1);
    }
    
    console.log(`URL: ${url}`);
    
    // 検索サービスのインスタンスを作成
    const searchService = new SearchService();
    
    console.log('コンテンツ取得を開始します...');
    
    // URLからコンテンツを取得
    const startTime = Date.now();
    const content = await searchService.fetchContent(url);
    const endTime = Date.now();
    
    if (content) {
      const contentLength = content.length;
      console.log(`コンテンツ取得成功: ${contentLength} 文字`);
      
      // 最初の500文字を表示
      const preview = content.substring(0, 500);
      console.log('\nコンテンツプレビュー:');
      console.log('-------------------');
      console.log(preview);
      console.log('-------------------');
    } else {
      console.log('コンテンツを取得できませんでした。');
    }
    
    console.log(`\n処理時間: ${(endTime - startTime) / 1000}秒`);
    
    // 成功時にプロセスを終了
    process.exit(0);
  } catch (error) {
    logger.error('URLコンテンツ取得テスト中にエラーが発生しました', { error });
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 