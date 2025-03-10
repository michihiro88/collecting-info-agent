/**
 * エラーハンドリングのテスト用スクリプト
 * 様々なエラーシナリオをシミュレーションして、エラーハンドリングの挙動を確認
 */
import { getMainAgent } from './agents/main-agent';
import { SearchService } from './search/search-service';
import { ContentProcessorService } from './processors/content-processor-service';
import { MultiStageRAG } from './processors/rag/multi-stage-rag';
import { AppError, ErrorCode } from './utils/error-handler';
import logger from './utils/logger';
import axios from 'axios';
import { SourceType } from './utils/types';

// エラーをシミュレートするためのモック関数
function mockNetworkTimeout(): Promise<any> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error('リクエストタイムアウト');
      // @ts-ignore: カスタムプロパティの追加
      error.code = 'ETIMEDOUT';
      reject(error);
    }, 100);
  });
}

// HTTPエラーをシミュレート
function mockHttpError(status: number, statusText: string): Promise<any> {
  return new Promise((_, reject) => {
    const error = new Error(`HTTPエラー: ${status} ${statusText}`);
    // @ts-ignore: カスタムプロパティの追加
    error.response = { status, statusText };
    reject(error);
  });
}

// エラーハンドリングテスト：検索エラー
async function testSearchError() {
  logger.info('=== 検索エラーのテスト ===');
  
  const searchService = new SearchService();
  const contentProcessor = new ContentProcessorService();
  const ragProcessor = new MultiStageRAG(searchService, contentProcessor);
  
  // 検索メソッドをモックしてエラーをスロー
  const originalSearch = searchService.search;
  searchService.search = async () => {
    throw new AppError(
      '検索サービスでエラーが発生しました',
      ErrorCode.SEARCH_ERROR
    );
  };
  
  try {
    await ragProcessor.process('テストクエリ');
    logger.info('予期せぬ成功: エラーが発生しませんでした');
  } catch (error) {
    if (error instanceof AppError) {
      logger.info('期待通りのエラーが捕捉されました', { 
        code: error.code,
        message: error.message
      });
    } else {
      logger.error('予期せぬエラー型です', { error });
    }
  } finally {
    // 元のメソッドに戻す
    searchService.search = originalSearch;
  }
}

// エラーハンドリングテスト：コンテンツ取得エラー
async function testContentFetchError() {
  logger.info('=== コンテンツ取得エラーのテスト ===');
  
  const searchService = new SearchService();
  const contentProcessor = new ContentProcessorService();
  const ragProcessor = new MultiStageRAG(searchService, contentProcessor);
  
  // オリジナルのメソッドを保存
  const originalSearch = searchService.search;
  const originalFetchContent = searchService.fetchContent;
  
  // 検索結果を返すがコンテンツ取得でエラー
  searchService.search = async (query: string) => {
    return [
      { 
        url: 'https://example.com/1', 
        title: 'テスト1', 
        snippet: 'テスト1の内容', 
        source: 'google',
        relevanceScore: 0.9
      },
      { 
        url: 'https://example.com/2', 
        title: 'テスト2', 
        snippet: 'テスト2の内容', 
        source: 'google',
        relevanceScore: 0.8
      }
    ];
  };
  
  // fetchContentをモックしてエラーをスロー
  searchService.fetchContent = async () => {
    return await mockNetworkTimeout();
  };
  
  try {
    const result = await ragProcessor.process('テストクエリ');
    logger.info('コンテンツ取得エラーでも処理は続行されました', { 
      hasResult: !!result,
      message: result.mergedContent
    });
  } catch (error) {
    logger.error('予期せぬエラーが発生しました', { error });
  } finally {
    // 元のメソッドに戻す
    searchService.search = originalSearch;
    searchService.fetchContent = originalFetchContent;
  }
}

// エラーハンドリングテスト：コンテンツ統合エラー
async function testContentIntegrationError() {
  logger.info('=== コンテンツ統合エラーのテスト ===');
  
  const searchService = new SearchService();
  const contentProcessor = new ContentProcessorService();
  const ragProcessor = new MultiStageRAG(searchService, contentProcessor);
  
  // オリジナルのメソッドを保存
  const originalSearch = searchService.search;
  const originalFetchContent = searchService.fetchContent;
  const originalIntegrate = contentProcessor.integrateContents;
  
  // 検索とコンテンツ取得は成功するが、統合でエラー
  searchService.search = async (query: string) => {
    return [
      { 
        url: 'https://example.com/1', 
        title: 'テスト1', 
        snippet: 'テスト1の内容', 
        source: 'google',
        relevanceScore: 0.9
      },
      { 
        url: 'https://example.com/2', 
        title: 'テスト2', 
        snippet: 'テスト2の内容', 
        source: 'google',
        relevanceScore: 0.8
      }
    ];
  };
  
  // fetchContentは成功
  searchService.fetchContent = async () => {
    return '<html><body>テストコンテンツ</body></html>';
  };
  
  // integrateContentsでエラー
  contentProcessor.integrateContents = async () => {
    throw new Error('コンテンツ統合中にエラーが発生しました');
  };
  
  try {
    const result = await ragProcessor.process('テストクエリ');
    logger.info('コンテンツ統合エラーでもフォールバック結果が返されました', { 
      hasResult: !!result,
      title: result.title,
      hasSources: result.sources.length > 0
    });
  } catch (error) {
    logger.error('予期せぬエラーが発生しました', { error });
  } finally {
    // 元のメソッドに戻す
    searchService.search = originalSearch;
    searchService.fetchContent = originalFetchContent;
    contentProcessor.integrateContents = originalIntegrate;
  }
}

// メイン処理
async function main() {
  try {
    logger.info('エラーハンドリングテストを開始します');
    
    // テスト1: 検索エラー
    await testSearchError();
    
    // テスト2: コンテンツ取得エラー
    await testContentFetchError();
    
    // テスト3: コンテンツ統合エラー
    await testContentIntegrationError();
    
    logger.info('すべてのエラーハンドリングテストが完了しました');
  } catch (error) {
    logger.error('テスト実行中に予期せぬエラーが発生しました', { error });
    process.exit(1);
  }
}

// スクリプト実行
main(); 