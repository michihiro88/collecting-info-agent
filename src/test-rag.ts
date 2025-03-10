/**
 * RAG機能テスト用スクリプト
 */
import { getMainAgent } from './agents/main-agent';
import logger from './utils/logger';
import { OutputFormat } from './utils/types';

async function main() {
  try {
    // コマンドライン引数を取得
    const query = process.argv[2];
    const modelName = process.argv[3];
    
    if (!query) {
      console.error('使用方法: node dist/test-rag.js "検索クエリ" [モデル名]');
      process.exit(1);
    }
    
    console.log(`クエリ: ${query}`);
    console.log(`モデル: ${modelName || 'デフォルト'}`);
    
    // メインエージェントを取得
    const mainAgent = getMainAgent();
    
    console.log('RAG処理を開始します...');
    
    // RAG処理を実行
    const startTime = Date.now();
    const result = await mainAgent.processWithRAG(query, modelName, OutputFormat.MARKDOWN);
    const endTime = Date.now();
    
    console.log('\n--- 処理結果 ---\n');
    console.log(result);
    console.log('\n-----------------\n');
    
    console.log(`処理時間: ${(endTime - startTime) / 1000}秒`);
    
  } catch (error) {
    logger.error('RAGテスト中にエラーが発生しました', { error });
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 