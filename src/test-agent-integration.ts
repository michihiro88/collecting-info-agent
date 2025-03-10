/**
 * エージェント連携機能のテスト用スクリプト
 * メインエージェント、検索エージェント、情報処理エージェントの連携をテストします
 */
import { getMainAgent } from './agents/main-agent';
import { getSearchAgent } from './agents/search-agent';
import { getInfoProcessorAgent } from './agents/info-processor';
import logger from './utils/logger';
import { OutputFormat } from './utils/types';

// タイムアウト処理用
const TIMEOUT_MS = 60000; // 60秒

async function main() {
  // タイムアウト処理
  const timeout = setTimeout(() => {
    logger.error('処理がタイムアウトしました');
    console.error('処理が60秒を超えたためタイムアウトしました');
    process.exit(1);
  }, TIMEOUT_MS);

  try {
    // コマンドライン引数を取得
    const query = process.argv[2];
    
    if (!query) {
      console.error('使用方法: node dist/test-agent-integration.js "検索クエリ"');
      clearTimeout(timeout);
      process.exit(1);
    }
    
    console.log(`クエリ: ${query}`);
    console.log('エージェント連携テストを開始します...');
    
    // 各エージェントのインスタンスを取得
    const mainAgent = getMainAgent();
    const searchAgent = getSearchAgent();
    const infoProcessorAgent = getInfoProcessorAgent();
    
    console.log('1. 検索エージェントによる検索を実行...');
    const startSearchTime = Date.now();
    const searchResults = await searchAgent.search(query);
    const endSearchTime = Date.now();
    
    console.log(`検索結果: ${searchResults.length}件`);
    console.log(`検索処理時間: ${(endSearchTime - startSearchTime) / 1000}秒`);
    
    // 検索結果の概要を表示
    if (searchResults.length > 0) {
      console.log('\n検索結果の概要:');
      searchResults.slice(0, 3).forEach((result, index) => {
        console.log(`[${index + 1}] ${result.title} - ${result.url.substring(0, 60)}...`);
      });
      console.log('...');
    }
    
    console.log('\n2. 情報処理エージェントによる結果処理を実行...');
    const startProcessTime = Date.now();
    const processedResult = await infoProcessorAgent.processResults(
      query,
      searchResults,
      undefined,
      OutputFormat.MARKDOWN
    );
    const endProcessTime = Date.now();
    
    console.log(`情報処理時間: ${(endProcessTime - startProcessTime) / 1000}秒`);
    
    console.log('\n3. メインエージェントによる標準処理を実行...');
    const startMainTime = Date.now();
    const mainResult = await mainAgent.process(query);
    const endMainTime = Date.now();
    
    console.log(`メインエージェント処理時間: ${(endMainTime - startMainTime) / 1000}秒`);
    
    console.log('\n--- 情報処理エージェント結果 ---\n');
    console.log(processedResult);
    console.log('\n--- メインエージェント結果 ---\n');
    console.log(mainResult);
    
    // 総合処理時間
    const totalTime = (endMainTime - startSearchTime) / 1000;
    console.log(`\n総合処理時間: ${totalTime}秒`);
    
    // タイムアウト解除
    clearTimeout(timeout);
    // 成功時にプロセスを終了
    process.exit(0);
  } catch (error) {
    console.error('エージェント連携テスト中にエラーが発生しました:', error);
    logger.error('エージェント連携テスト中にエラーが発生しました', { error });
    clearTimeout(timeout);
    process.exit(1);
  }
}

// プロセス終了時の未処理のプロミスエラーをハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のプロミス拒否:', reason);
  logger.error('未処理のプロミス拒否', { reason });
  process.exit(1);
});

// メイン関数を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  logger.error('予期しないエラーが発生しました', { error });
  process.exit(1);
}); 