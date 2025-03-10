import { getModelSelector } from '../models/selector';
import { getConfigLoader } from '../config/config-loader';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';
import { OutputFormat } from '../utils/types';
import { getSearchAgent } from './search-agent';
import { InfoProcessorAgent } from './info-processor';
import { ContentProcessorService } from '../processors/content-processor-service';
import MultiStageRAG from '../processors/rag/multi-stage-rag';
import { SearchService } from '../search/search-service';

/**
 * メインエージェント
 * ユーザーからの入力を受け取り、適切な処理を行うエージェント
 */
export class MainAgent {
  private config = getConfigLoader().getConfig();
  private modelSelector = getModelSelector();
  private searchAgent = getSearchAgent();
  private infoProcessor = new InfoProcessorAgent();
  private contentProcessor = new ContentProcessorService();
  private searchService = new SearchService();
  private ragProcessor: MultiStageRAG;

  constructor() {
    this.ragProcessor = new MultiStageRAG(this.searchService, this.contentProcessor);
  }

  /**
   * 指定されたモデル名またはデフォルトモデルを使用して処理を実行
   * @param input ユーザー入力
   * @param modelName モデル名 (オプション)
   * @param outputFormat 出力形式 (オプション)
   */
  public async process(
    input: string,
    modelName?: string,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): Promise<string> {
    try {
      logger.info('情報収集を開始します', { input, modelName, outputFormat });

      // 検索エージェントを使用して情報を収集
      const searchResults = await this.searchAgent.search(input);
      
      if (searchResults.length === 0) {
        logger.warn('検索結果が見つかりませんでした', { input });
        
        // 検索結果がない場合はモデルに直接問い合わせる
        const model = modelName
          ? this.modelSelector.getModel(modelName)
          : this.modelSelector.getDefaultModel();
        
        const response = await model.generateText(
          `以下の質問に対する回答を${outputFormat}形式で提供してください。
          インターネット検索結果は利用できませんが、あなたの知識を使って回答してください: ${input}`
        );
        
        return response.text;
      }
      
      // 情報処理エージェントを使用して結果を処理
      const result = await this.infoProcessor.processResults(
        input,
        searchResults,
        modelName,
        outputFormat
      );

      logger.info('処理が完了しました', { resultsCount: searchResults.length });

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        logger.error('エージェント処理中にエラーが発生しました', { error });
        throw error;
      }

      // アプリケーションエラーでない場合はラップする
      const appError = new AppError(
        '情報収集処理中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * 高度なRAG処理を使用して情報を収集・処理
   * @param input ユーザー入力
   * @param modelName モデル名 (オプション)
   * @param outputFormat 出力形式 (オプション)
   * @param options RAGプロセッサーオプション (オプション)
   */
  public async processWithRAG(
    input: string,
    modelName?: string,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN,
    options?: {
      maxStages?: number;
      useQueryExpansion?: boolean;
      maxResultsPerStage?: number;
      integrationOptions?: any;
    }
  ): Promise<string> {
    try {
      logger.info('RAGを使用した情報収集を開始します', { input, modelName, outputFormat });

      // RAGプロセッサーを使用して処理
      const integratedContent = await this.ragProcessor.process(input, {
        maxStages: options?.maxStages ?? 2,
        useQueryExpansion: options?.useQueryExpansion ?? true,
        queryExpansionModel: modelName,
        maxResultsPerStage: options?.maxResultsPerStage,
        integrationOptions: options?.integrationOptions
      });
      
      // 出力形式に応じて結果を整形
      if (outputFormat === OutputFormat.MARKDOWN) {
        return integratedContent.mergedContent;
      } else if (outputFormat === OutputFormat.JSON) {
        return JSON.stringify(integratedContent, null, 2);
      } else {
        return integratedContent.summary || integratedContent.mergedContent;
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        'RAG処理中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error, input }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * ファイルからの情報収集
   * @param filePath ファイルパス
   * @param modelName モデル名 (オプション)
   * @param outputFormat 出力形式 (オプション)
   */
  public async processFile(
    filePath: string,
    modelName?: string,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): Promise<string> {
    try {
      logger.info('ファイルからの情報収集を開始します', { filePath });
      
      // TODO: ファイル読み込み処理を実装
      // 現在は仮の実装としてファイルパスを入力とした処理を行う
      return this.process(`ファイル ${filePath} の内容を分析してください`, modelName, outputFormat);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        `ファイル ${filePath} の処理中にエラーが発生しました`,
        ErrorCode.PROCESS_ERROR,
        { error, filePath }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * URLからの情報収集
   * @param url URL
   * @param modelName モデル名 (オプション)
   * @param outputFormat 出力形式 (オプション)
   */
  public async processUrl(
    url: string,
    modelName?: string,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): Promise<string> {
    try {
      logger.info('URLからの情報収集を開始します', { url });
      
      // URLの形式を検証
      if (!this.isValidUrl(url)) {
        throw new AppError(
          `無効なURL形式です: ${url}`,
          ErrorCode.INVALID_URL,
          { url }
        );
      }

      // URLからコンテンツを取得
      const content = await this.searchAgent.fetchContent(url);
      
      if (!content) {
        throw new AppError(
          `URL ${url} からコンテンツを取得できませんでした`,
          ErrorCode.NETWORK_ERROR,
          { url }
        );
      }
      
      // コンテンツを処理
      const processedContent = await this.contentProcessor.processContent(
        content,
        url,
        undefined,
        { extractMetadata: true, cleanContent: true, generateSummary: true }
      );
      
      // モデルの選択
      const model = modelName
        ? this.modelSelector.getModel(modelName)
        : this.modelSelector.getDefaultModel();
      
      // プロンプトを作成
      const prompt = `以下のURLから取得した情報を分析し、重要なポイントをまとめて${outputFormat}形式で提供してください。

URL: ${url}
タイトル: ${processedContent.metadata.title || 'タイトルなし'}

コンテンツ:
${processedContent.cleanedContent || processedContent.content.substring(0, 5000)}

${processedContent.summary ? `要約:\n${processedContent.summary}` : ''}

分析結果:`;
      
      // AIモデルを使用して分析
      const response = await model.generateText(prompt);
      
      logger.info('URL処理が完了しました', { 
        url, 
        contentLength: content.length,
        processedLength: processedContent.cleanedContent?.length || 0
      });
      
      return response.text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        `URL ${url} の処理中にエラーが発生しました`,
        ErrorCode.PROCESS_ERROR,
        { error, url }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * スケジュール実行のための処理
   * @param input ユーザー入力または以前のクエリ
   */
  public async scheduledProcess(input: string): Promise<void> {
    try {
      logger.info('スケジュール実行を開始します', { input });
      
      // RAG処理を使用
      const result = await this.processWithRAG(input);
      
      // TODO: 結果の保存や通知処理を実装
      logger.info('スケジュール実行が完了しました', { 
        resultLength: result.length,
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      logger.error('スケジュール実行中にエラーが発生しました', { error, input });
      // スケジュール実行ではエラーをスローせず、ログに記録するだけ
    }
  }

  /**
   * URLが有効な形式かを検証
   * @param url 検証するURL
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }
}

/**
 * メインエージェントのシングルトンインスタンス
 */
let mainAgentInstance: MainAgent | null = null;

/**
 * メインエージェントのインスタンスを取得
 */
export function getMainAgent(): MainAgent {
  if (!mainAgentInstance) {
    mainAgentInstance = new MainAgent();
  }
  return mainAgentInstance;
}

export default { MainAgent, getMainAgent }; 