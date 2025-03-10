import { ModelProvider, ModelOptions, ModelResponse, SearchResult } from '../../utils/types';
import { IAIModel, StreamResponseHandler } from './ai-model';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AIモデルの基本抽象クラス
 */
export abstract class BaseModel implements IAIModel {
  public readonly id: string;
  public readonly provider: ModelProvider;
  protected apiKey: string | undefined;
  protected apiKeyEnv: string;

  /**
   * コンストラクタ
   * @param id モデルID
   * @param provider プロバイダ
   * @param apiKeyEnv APIキー環境変数名
   */
  constructor(id: string, provider: ModelProvider, apiKeyEnv: string) {
    this.id = id;
    this.provider = provider;
    this.apiKeyEnv = apiKeyEnv;
    this.apiKey = process.env[apiKeyEnv];
  }

  /**
   * APIキーが設定されているかを確認
   */
  public isConfigured(): boolean {
    // 環境変数の値を再取得（テスト中に変更される可能性があるため）
    this.apiKey = process.env[this.apiKeyEnv];
    return !!this.apiKey;
  }

  /**
   * キーが設定されていない場合にエラーをスロー
   */
  protected checkApiKey(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        `APIキーが設定されていません。環境変数 ${this.apiKeyEnv} を設定してください。`,
        ErrorCode.MODEL_ERROR,
        { provider: this.provider, model: this.id }
      );
    }
  }

  /**
   * テキスト生成の実装（サブクラスで実装）
   */
  public abstract generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;

  /**
   * ストリーミングレスポンスの実装（サブクラスで実装）
   */
  public abstract generateTextStream(
    prompt: string,
    handler: StreamResponseHandler,
    options?: ModelOptions
  ): Promise<void>;

  /**
   * コンテキスト付きテキスト生成のデフォルト実装
   */
  public async generateWithContext(
    prompt: string,
    context: SearchResult[],
    options?: ModelOptions
  ): Promise<ModelResponse> {
    // コンテキスト情報をプロンプトに追加
    const contextText = this.formatContextForPrompt(context);
    const fullPrompt = `${contextText}\n\n${prompt}`;
    
    logger.debug('コンテキスト付きプロンプトを生成しました', {
      modelId: this.id,
      contextSize: context.length,
      promptLength: fullPrompt.length,
    });

    // 通常の生成メソッドを呼び出し
    return this.generateText(fullPrompt, options);
  }

  /**
   * コンテキストをプロンプト用にフォーマット
   */
  protected formatContextForPrompt(context: SearchResult[]): string {
    // コンテキストの情報を文字列に変換
    let contextText = '以下の情報を参考にしてください：\n\n';
    
    // 関連性でソート
    const sortedContext = [...context].sort((a, b) => b.relevance - a.relevance);
    
    sortedContext.forEach((item, index) => {
      contextText += `[情報源 ${index + 1}] ${item.metadata.title || item.title || 'タイトルなし'}\n`;
      
      if (item.source && item.source.url) {
        contextText += `URL: ${item.source.url}\n`;
      } else if (item.url) {
        contextText += `URL: ${item.url}\n`;
      }
      
      if (item.metadata.author) {
        contextText += `著者: ${item.metadata.author}\n`;
      }
      
      if (item.metadata.date) {
        contextText += `日付: ${item.metadata.date}\n`;
      }
      
      // content2が存在する場合はそれを使用、そうでなければcontentを使用
      const contentText = item.content2 ? 
        (item.content2.summary || item.content2.fullText) : 
        item.content;
      
      contextText += `\n${contentText}\n\n`;
      
      if (item.content2 && item.content2.keyPoints && item.content2.keyPoints.length > 0) {
        contextText += '重要ポイント:\n';
        item.content2.keyPoints.forEach(point => {
          contextText += `- ${point}\n`;
        });
        contextText += '\n';
      }
      
      contextText += '---\n\n';
    });
    
    return contextText;
  }

  /**
   * エラー処理のデフォルト実装
   */
  public async handleError(error: unknown): Promise<ModelResponse | null> {
    let errorMessage = 'AI モデルでエラーが発生しました';
    let errorDetails: Record<string, any> = { modelId: this.id };
    
    if (error instanceof Error) {
      errorMessage = `AI モデルでエラーが発生しました: ${error.message}`;
      errorDetails.stack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = `AI モデルでエラーが発生しました: ${error}`;
    }
    
    logger.error(errorMessage, { ...errorDetails, provider: this.provider });
    
    throw new AppError(
      errorMessage,
      ErrorCode.MODEL_ERROR,
      errorDetails
    );
  }

  /**
   * レスポンス時間を計測するためのラッパー
   */
  protected async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; processingTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    return { result, processingTime };
  }
}

export default BaseModel; 