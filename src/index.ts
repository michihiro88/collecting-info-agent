import * as dotenv from 'dotenv';
import { getConfigLoader } from './config/config-loader';
import logger from './utils/logger';
import { AppError, ErrorCode } from './utils/error-handler';
import { getMainAgent } from './agents/main-agent';
import { getSearchAgent } from './agents/search-agent';
import { getInfoProcessorAgent } from './agents/info-processor';
import { OutputFormat } from './utils/types';

// 環境変数を読み込む
dotenv.config();

/**
 * コマンドライン引数を解析
 */
function parseArgs(): { query: string; modelName?: string; outputFormat: OutputFormat } {
  const args = process.argv.slice(2);
  let query = '';
  let modelName: string | undefined = undefined;
  let outputFormat: OutputFormat = OutputFormat.MARKDOWN;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' || args[i] === '-q') {
      query = args[i + 1] || '';
      i++;
    } else if (args[i] === '--model' || args[i] === '-m') {
      modelName = args[i + 1];
      i++;
    } else if (args[i] === '--format' || args[i] === '-f') {
      const format = args[i + 1]?.toUpperCase();
      if (format && Object.values(OutputFormat).includes(format as OutputFormat)) {
        outputFormat = format as OutputFormat;
      }
      i++;
    } else if (!query) {
      // 引数が指定されていない場合は、最初の引数をクエリとして扱う
      query = args[i];
    }
  }
  
  return { query, modelName, outputFormat };
}

/**
 * 標準的な情報収集処理
 * @param query 検索クエリ
 * @param modelName 使用するモデル名 (オプション)
 * @param outputFormat 出力形式
 */
async function standardProcessing(
  query: string,
  modelName?: string,
  outputFormat: OutputFormat = OutputFormat.MARKDOWN
): Promise<string> {
  const searchAgent = getSearchAgent();
  const infoProcessor = getInfoProcessorAgent();
  
  // Web検索の実行
  logger.info('Web検索を実行します', { query });
  const searchResults = await searchAgent.search(query);
  
  // 情報の処理と回答の生成
  logger.info('検索結果を処理します', { resultsCount: searchResults.length });
  const answer = await infoProcessor.processResults(
    query,
    searchResults,
    modelName,
    outputFormat
  );
  
  return answer;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    // 設定の読み込み
    const config = getConfigLoader().getConfig();
    const { query, modelName, outputFormat } = parseArgs();
    
    logger.info('情報収集エージェントを起動しています...', {
      modelName: modelName || '(デフォルト)',
      outputFormat
    });
    
    if (!query) {
      console.log('使用方法: npm start -- --query "検索クエリ" [--model モデル名] [--format 出力形式]');
      console.log('または:    npm start -- "検索クエリ" [--model モデル名] [--format 出力形式]');
      console.log('\n例: npm start -- "東京の天気予報"');
      console.log('例: npm start -- --query "量子コンピュータの最新動向" --model claude-3-sonnet --format markdown');
      process.exit(1);
    }
    
    // デモ実行: 標準的な処理フロー
    console.log(`\n検索クエリ: "${query}"\n`);
    console.log('情報を収集しています...\n');
    
    const result = await standardProcessing(query, modelName, outputFormat);
    
    console.log('=== 検索結果 ===\n');
    console.log(result);
    console.log('\n=== 処理完了 ===');
    
  } catch (error) {
    if (error instanceof AppError) {
      logger.error('アプリケーションエラー:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      console.error(`エラー: ${error.message}`);
    } else {
      logger.error('予期せぬエラー:', { error });
      console.error('予期せぬエラーが発生しました。ログを確認してください。');
    }
    process.exit(1);
  }
}

// アプリケーション起動
if (require.main === module) {
  main().catch(error => {
    console.error('予期せぬエラーが発生しました:', error);
    process.exit(1);
  });
} 