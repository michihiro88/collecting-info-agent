/**
 * 高度なRAG機能のテスト用スクリプト
 * クエリ拡張機能と複数ステージを有効にしたバージョン
 */
import { getMainAgent } from './agents/main-agent';
import logger from './utils/logger';
import { OutputFormat } from './utils/types';

// タイムアウト処理用
const TIMEOUT_MS = 120000; // 120秒

async function main() {
  // タイムアウト処理
  const timeout = setTimeout(() => {
    logger.error('処理がタイムアウトしました');
    console.error('処理が120秒を超えたためタイムアウトしました');
    process.exit(1);
  }, TIMEOUT_MS);

  try {
    // コマンドライン引数を取得
    const query = process.argv[2];
    
    if (!query) {
      console.error('使用方法: node dist/test-advanced-rag.js "検索クエリ"');
      clearTimeout(timeout);
      process.exit(1);
    }
    
    console.log(`クエリ: ${query}`);
    
    // メインエージェントを取得
    const mainAgent = getMainAgent();
    
    console.log('高度なRAG処理を開始します...');
    console.log('クエリ拡張機能: 有効');
    console.log('ステージ数: 2');
    
    // RAG処理を実行（高度なオプションで）
    const startTime = Date.now();
    
    // 処理実行：最大2ステージ、クエリ拡張あり
    const result = await mainAgent.processWithRAG(query, undefined, OutputFormat.MARKDOWN, {
      maxStages: 2,
      useQueryExpansion: true,
      maxResultsPerStage: 5,
      integrationOptions: {
        maxContentLength: 6000,
        removeDuplicates: true
      }
    });
    
    const endTime = Date.now();
    
    console.log('\n--- 処理結果 ---\n');
    console.log(result);
    console.log('\n-----------------\n');
    
    console.log(`処理時間: ${(endTime - startTime) / 1000}秒`);
    
    // タイムアウト解除
    clearTimeout(timeout);
    // 成功時にプロセスを終了
    process.exit(0);
  } catch (error) {
    // タイムアウト解除
    clearTimeout(timeout);
    
    logger.error('高度なRAGテスト中にエラーが発生しました', { error });
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// グローバルなエラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise rejection:', reason);
  process.exit(1);
});

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 