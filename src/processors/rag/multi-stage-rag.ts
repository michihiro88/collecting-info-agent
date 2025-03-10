import { SearchResult } from '../../search/interfaces/search-provider';
import { ProcessedContent } from '../interfaces/content-processor';
import { IntegratedContent, IntegrationOptions } from '../integration/content-integrator';
import { SearchService } from '../../search/search-service';
import { ContentProcessorService } from '../content-processor-service';
import { RelevanceScorer, ScoringOptions } from '../relevance/relevance-scorer';
import { getModelSelector } from '../../models/selector';
import { ModelResponse } from '../../utils/types';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';

export interface RAGOptions {
  /**
   * 多段階検索の最大ステージ数
   */
  maxStages?: number;
  
  /**
   * 各ステージで使用する検索結果の最大数
   */
  maxResultsPerStage?: number;
  
  /**
   * 次のステージに進むための最小スコアしきい値
   */
  minScoreThreshold?: number;
  
  /**
   * 各ステージでのクエリ拡張にAIを使用するかどうか
   */
  useQueryExpansion?: boolean;
  
  /**
   * クエリ拡張に使用するAIモデル名
   */
  queryExpansionModel?: string;
  
  /**
   * コンテンツ統合オプション
   */
  integrationOptions?: IntegrationOptions;
  
  /**
   * 関連性スコアリングオプション
   */
  scoringOptions?: ScoringOptions;
}

/**
 * 多段階RAG（Retrieval-Augmented Generation）プロセッサー
 * 段階的に検索と知識の拡張を行う
 */
export class MultiStageRAG {
  private searchService: SearchService;
  private processorService: ContentProcessorService;
  private relevanceScorer: RelevanceScorer;
  
  /**
   * コンストラクタ
   */
  constructor(
    searchService: SearchService,
    processorService: ContentProcessorService
  ) {
    this.searchService = searchService;
    this.processorService = processorService;
    this.relevanceScorer = new RelevanceScorer();
  }
  
  /**
   * 多段階RAG処理を実行
   * 
   * @param initialQuery 初期検索クエリ
   * @param options RAGオプション
   * @returns 統合されたコンテンツ
   */
  public async process(
    initialQuery: string,
    options: RAGOptions = {}
  ): Promise<IntegratedContent> {
    // デフォルトオプション
    const defaultOptions: RAGOptions = {
      maxStages: 2,
      maxResultsPerStage: 5,
      minScoreThreshold: 0.6,
      useQueryExpansion: true,
      integrationOptions: {
        removeDuplicates: true,
        formatOutput: 'markdown',
        maxContentLength: 8000
      },
      scoringOptions: {
        method: 'hybrid',
        minThreshold: 0.4
      }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // ステージ0: 初期検索を実行
    logger.info(`多段階RAG処理を開始: 初期クエリ "${initialQuery}"`);
    
    let currentQuery = initialQuery;
    let allSearchResults: SearchResult[] = [];
    let allProcessedContents: ProcessedContent[] = [];
    
    // 段階的に処理
    for (let stage = 0; stage < (finalOptions.maxStages || 2); stage++) {
      logger.info(`ステージ ${stage + 1}: クエリ "${currentQuery}"`);
      
      // 現在のクエリで検索を実行
      let stageResults: SearchResult[] = [];
      try {
        stageResults = await this.searchService.search(currentQuery, {
          limit: finalOptions.maxResultsPerStage || 5
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        logger.error(`検索実行中にエラーが発生: ${errorMessage}`, { error, stage, query: currentQuery });
        
        if (stage === 0) {
          // 初期ステージでのエラーは致命的なので、エラーをスロー
          if (error instanceof AppError) {
            throw error;
          }
          throw new AppError(
            `検索実行中にエラーが発生しました: ${errorMessage}`,
            ErrorCode.SEARCH_ERROR,
            { originalError: error, query: currentQuery }
          );
        }
        // 2回目以降のステージでのエラーは、既存の結果で処理を続行
        break;
      }
      
      if (stageResults.length === 0) {
        logger.info(`ステージ ${stage + 1}: 検索結果が見つかりませんでした`);
        break;
      }
      
      // 検索結果からコンテンツを取得
      const contentMap = new Map<string, string>();
      const contentFetchPromises = stageResults.map(async result => {
        try {
          // タイムアウト設定を追加（15秒）
          const content = await this.searchService.fetchContent(result.url, {
            timeout: 15000 // 15秒タイムアウト
          });
          if (content) {
            contentMap.set(result.url, content);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          logger.error(`コンテンツ取得中にエラーが発生: ${result.url} - ${errorMessage}`, { 
            error, 
            url: result.url,
            title: result.title
          });
          // 個別のコンテンツ取得エラーは無視して処理を続行
        }
      });
      
      // すべてのコンテンツ取得を完了まで待機
      await Promise.all(contentFetchPromises);
      
      // コンテンツを処理
      const stageProcessedContents: ProcessedContent[] = [];
      for (const [url, content] of contentMap.entries()) {
        try {
          const processedContent = await this.processorService.processContent(
            content,
            url,
            undefined,
            { extractMetadata: true, cleanContent: true, generateSummary: false }
          );
          stageProcessedContents.push(processedContent);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          logger.error(`コンテンツ処理中にエラーが発生: ${url} - ${errorMessage}`, { 
            error, 
            url,
            contentLength: content.length 
          });
          // 個別のコンテンツ処理エラーは無視して処理を続行
        }
      }
      
      // 関連性スコアリング
      let scoredResults: SearchResult[] = [];
      try {
        scoredResults = await this.relevanceScorer.scoreResults(
          stageResults,
          stageProcessedContents,
          currentQuery,
          finalOptions.scoringOptions
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        logger.error(`関連性スコアリング中にエラーが発生: ${errorMessage}`, { 
          error, 
          stage,
          query: currentQuery
        });
        
        // スコアリングに失敗した場合は、元の検索結果をそのまま使用
        scoredResults = stageResults.map(result => ({
          ...result,
          relevanceScore: 0.5 // デフォルトスコア
        }));
      }
      
      // 最小しきい値を超える結果のみを保持
      const filteredResults = scoredResults.filter(
        result => (result.relevanceScore || 0) >= (finalOptions.minScoreThreshold || 0.6)
      );
      
      logger.info(`ステージ ${stage + 1}: ${filteredResults.length} 件の関連結果を取得`);
      
      // 結果を累積
      allSearchResults = [...allSearchResults, ...filteredResults];
      allProcessedContents = [...allProcessedContents, ...stageProcessedContents];
      
      // 最終ステージでなければ、次のクエリを拡張
      if (stage < (finalOptions.maxStages || 2) - 1 && finalOptions.useQueryExpansion) {
        // トップの結果からクエリを拡張
        const topResults = filteredResults.slice(0, 2);
        if (topResults.length > 0) {
          const newQuery = await this.expandQuery(
            initialQuery,
            currentQuery,
            topResults,
            stageProcessedContents,
            finalOptions.queryExpansionModel
          );
          
          if (newQuery && newQuery !== currentQuery) {
            currentQuery = newQuery;
            logger.info(`クエリを拡張: "${newQuery}"`);
          } else {
            logger.info('クエリ拡張なし、処理を終了します');
            break;
          }
        } else {
          // 十分な結果がない場合は終了
          break;
        }
      }
    }
    
    // 最終統合
    if (allSearchResults.length === 0) {
      logger.warn('関連する検索結果が見つかりませんでした');
      return {
        title: `Information about: ${initialQuery}`,
        summary: `No relevant information found for: ${initialQuery}`,
        sources: [],
        contentSections: [],
        mergedContent: `No relevant information found for: ${initialQuery}`
      };
    }
    
    // 統合
    logger.info(`コンテンツを統合: ${allSearchResults.length} 件の検索結果`);
    try {
      const integratedContent = await this.processorService.integrateContents(
        allSearchResults,
        allProcessedContents,
        initialQuery,
        finalOptions.integrationOptions
      );
      
      return integratedContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      logger.error(`コンテンツ統合中にエラーが発生: ${errorMessage}`, { error });
      
      // 統合に失敗した場合は最低限の結果を返す
      return {
        title: `Information about: ${initialQuery}`,
        summary: `Failed to properly integrate information for: ${initialQuery}`,
        sources: allSearchResults.map(result => ({
          url: result.url,
          title: result.title || result.url
        })),
        contentSections: allProcessedContents.map(content => ({
          title: content.metadata.title || 'Untitled Section',
          content: content.cleanedContent || content.content.substring(0, 500),
          source: content.metadata.source || 'Unknown Source'
        })),
        mergedContent: `Failed to integrate information properly. Please try again or refine your query: ${initialQuery}`
      };
    }
  }
  
  /**
   * 検索結果からクエリを拡張
   * AIモデルを使用して、より具体的または関連性の高いクエリに拡張する
   */
  private async expandQuery(
    initialQuery: string,
    currentQuery: string,
    topResults: SearchResult[],
    processedContents: ProcessedContent[],
    modelName?: string
  ): Promise<string | null> {
    try {
      // テスト/開発環境では単純な拡張を行う
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        const randomPrefix = Math.random() > 0.5 ? "詳細 " : "関連 ";
        return `${randomPrefix}${currentQuery}`;
      }
      
      // トップ結果に対応するコンテンツを取得
      const contentMap = new Map<string, ProcessedContent>();
      processedContents.forEach(content => {
        contentMap.set(content.metadata.source, content);
      });
      
      // クエリ拡張用の情報を収集
      const summaries = topResults
        .map(result => {
          const content = contentMap.get(result.url);
          if (!content) return null;
          
          // 概要または内容の先頭部分を使用
          return {
            title: result.title,
            content: content.summary || content.cleanedContent?.substring(0, 200) || content.content.substring(0, 200),
            relevanceScore: result.relevanceScore
          };
        })
        .filter(item => item !== null);
      
      // AIモデルを取得
      const modelSelector = getModelSelector();
      const model = modelName 
        ? modelSelector.getModel(modelName) 
        : modelSelector.getDefaultModel();
      
      // クエリ拡張のプロンプトを作成
      const prompt = this.createQueryExpansionPrompt(initialQuery, currentQuery, summaries);
      
      // AIからの応答を取得
      const response: ModelResponse = await model.generateText(prompt, { temperature: 0.7, maxTokens: 100 });
      
      // ModelResponseオブジェクトからテキストを取得
      if (response && response.text && typeof response.text === 'string') {
        const trimmedText = response.text.trim();
        if (trimmedText) {
          return trimmedText;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('クエリ拡張中にエラーが発生しました', { error });
      return null;
    }
  }
  
  /**
   * クエリ拡張のためのプロンプトを作成
   */
  private createQueryExpansionPrompt(
    initialQuery: string,
    currentQuery: string,
    summaries: Array<{ title: string; content: string; relevanceScore?: number } | null>
  ): string {
    // 関連コンテンツから情報を抽出
    const summaryText = summaries
      .filter(summary => summary !== null)
      .map(summary => `### ${summary?.title}\n${summary?.content}`)
      .join('\n\n');
    
    return `
現在の検索クエリを深掘りするための、より具体的な新しいクエリを作成してください。
初期クエリから大きく外れないように注意してください。

初期クエリ: ${initialQuery}
現在のクエリ: ${currentQuery}

以下は現在のクエリで見つかった関連情報です:
${summaryText}

上記の情報をもとに、より具体的で関連性の高い検索クエリを1つだけ作成してください。
クエリは短く具体的にして、検索エンジンに直接入力できる形式にしてください。
検索クエリのみを出力し、余分な説明は不要です。

新しいクエリ:
`;
  }
}

export default MultiStageRAG; 