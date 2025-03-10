import { BaseModel } from '../interfaces/base-model';
import { ModelOptions, ModelProvider, ModelResponse } from '../../utils/types';
import { StreamResponseHandler } from '../interfaces/ai-model';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';

/**
 * レスポンス型を扱うためのユーティリティタイプ
 */
type ContentType = string | { text?: string; toString?: () => string } | any;

/**
 * Google AI (Gemini) モデルの実装
 */
export class GoogleModel extends BaseModel {
  private client: ChatGoogleGenerativeAI | null = null;
  private apiVersion: string = 'v1'; // v1betaからv1に更新

  /**
   * コンストラクタ
   * @param id モデルID
   * @param apiKeyEnv APIキー環境変数名
   */
  constructor(id: string, apiKeyEnv: string) {
    super(id, ModelProvider.GOOGLE, apiKeyEnv);
    
    // モデル名を正しい形式に修正
    this.validateAndCorrectModelId();
    
    this.initClient();
  }

  /**
   * モデル名を検証して必要に応じて修正
   */
  private validateAndCorrectModelId(): void {
    // Googleモデルの正式名称マッピング
    // v1では'models/'プレフィックスは不要
    const modelMap: Record<string, string> = {
      'gemini-pro': 'gemini-pro',
      'gemini-pro-vision': 'gemini-pro-vision',
      'gemini-1.0-pro': 'gemini-1.0-pro',
      'gemini-1.0-pro-vision': 'gemini-1.0-pro-vision',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'models/gemini-pro': 'gemini-pro',
      'models/gemini-pro-vision': 'gemini-pro-vision'
    };
    
    if (modelMap[this.id]) {
      if (this.id !== modelMap[this.id]) {
        logger.debug(`Google AIモデル名を "${this.id}" から "${modelMap[this.id]}" に更新します。`);
        (this as any).id = modelMap[this.id];
      }
    } else if (this.id.startsWith('models/')) {
      // 'models/'プレフィックスを削除（v1では不要）
      const updatedId = this.id.replace('models/', '');
      logger.warn(`Google AIモデル名 "${this.id}" から "${updatedId}" に変更します（v1ではprefix不要）。`);
      (this as any).id = updatedId;
    }
  }

  /**
   * レスポンスのコンテンツを文字列に変換するユーティリティメソッド
   */
  private extractContentAsString(content: any): string {
    if (typeof content === 'string') {
      return content;
    } else if (content && typeof content === 'object') {
      // オブジェクト形式の場合は文字列に変換
      if (Array.isArray(content)) {
        return content.map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
            return item.text;
          }
          return JSON.stringify(item);
        }).join('');
      } else if (typeof (content as any).toString === 'function' && (content as any).toString !== Object.prototype.toString) {
        return (content as any).toString();
      } else if ('text' in content && typeof (content as any).text === 'string') {
        return (content as any).text;
      }
      return JSON.stringify(content);
    }
    return String(content);
  }

  /**
   * Google AI クライアントの初期化
   */
  private initClient(): void {
    if (!this.isConfigured()) {
      logger.warn(`Google AI APIキーが設定されていません (環境変数: ${this.apiKeyEnv})`);
      return;
    }

    try {
      // APIバージョンをv1に指定（デフォルトからの変更）
      this.client = new ChatGoogleGenerativeAI({
        apiKey: this.apiKey as string,
        modelName: this.id,
        maxOutputTokens: 1024, // デフォルト値を設定
        temperature: 0.7,
        // v1に対応するための追加設定
        apiVersion: this.apiVersion,
        // safetySettingsは必要に応じて追加
      });
      
      logger.debug(`Google AI クライアントを初期化しました (モデル: ${this.id}, APIバージョン: ${this.apiVersion})`);
    } catch (error) {
      logger.error('Google AI クライアントの初期化に失敗しました', { error, modelId: this.id });
      this.client = null;
    }
  }

  /**
   * テキスト生成の実装
   */
  public async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    this.checkApiKey();

    if (!this.client) {
      this.initClient();
      if (!this.client) {
        throw new AppError(
          'Google AI クライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('Google AIモデルへのリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });
    
    // チャットログ記録はコメントアウト（設定オブジェクトが存在しないため）
    // if (this.config?.logging?.chatHistory) {
    //   logger.chatLog(prompt, '');
    // }

    // 計測開始
    const { result, processingTime } = await this.measureTime(async () => {
      // 最大6回のリトライ
      let attempt = 0;
      const maxRetries = 5;

      while (true) {
        try {
          // メッセージの準備
          const message = new HumanMessage(prompt);
          
          // モデルオプションの準備
          const modelOptions: any = {};
          if (options?.temperature !== undefined) {
            modelOptions.temperature = options.temperature;
          }
          if (options?.maxTokens !== undefined) {
            modelOptions.maxOutputTokens = options.maxTokens;
          }

          // クライアントの呼び出し
          const response = await this.client!.invoke([message], modelOptions);
          
          // レスポンスの内容を文字列に変換
          const content = this.extractContentAsString(response.content);

          logger.debug('Google AIからレスポンスを受信しました', {
            modelId: this.id,
            responseLength: content.length
          });

          return content;
        } catch (error) {
          attempt++;
          
          // 特定のエラーに対しては再試行
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // レート制限エラーや一時的なエラーの場合は再試行
          if (attempt <= maxRetries && (
            errorMessage.includes('rate limit') || 
            errorMessage.includes('429') ||
            errorMessage.includes('500') ||
            errorMessage.includes('503') ||
            errorMessage.includes('timeout')
          )) {
            // 指数バックオフで待機（最大32秒）
            const waitTime = Math.min(Math.pow(2, attempt) * 1000, 32000);
            logger.warn(`Google API呼び出しでエラー発生。${waitTime}ms後に再試行します (${attempt}/${maxRetries})`, { error });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // 再試行回数を超えたかその他のエラーの場合
          logger.error('Google API呼び出しエラー', { error, modelId: this.id, attemptNumber: attempt, retriesLeft: maxRetries - attempt });
          throw error;
        }
      }
    });

    // ログにチャットを記録
    logger.debug('Google AI レスポンス', { 
      modelId: this.id, 
      prompt, 
      response: typeof result === 'string' ? result : JSON.stringify(result)
    });

    // 使用トークン数を推定（正確ではありませんがデモ目的）
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(result.length / 4);

    // レスポンスをModelResponse形式に変換
    const response: ModelResponse = {
      text: result,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      metadata: {
        model: this.id,
        provider: this.provider,
        processingTime,
      },
    };

    // チャットログ記録はコメントアウト
    // if (this.config?.logging?.chatHistory) {
    //   logger.chatLog(prompt, response.text);
    // }

    return response;
  }

  /**
   * ストリーミングレスポンスの実装
   */
  public async generateTextStream(
    prompt: string,
    handler: StreamResponseHandler,
    options?: ModelOptions
  ): Promise<void> {
    this.checkApiKey();

    if (!this.client) {
      this.initClient();
      if (!this.client) {
        throw new AppError(
          'Google AI クライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('Google AIモデル（ストリーミング）へのリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });
    
    // チャットログ記録はコメントアウト（設定オブジェクトが存在しないため）
    // if (this.config?.logging?.chatHistory) {
    //   logger.chatLog(prompt, '');
    // }

    const startTime = Date.now();
    let fullText = '';

    try {
      // メッセージの準備
      const message = new HumanMessage(prompt);
      
      // モデルオプションの準備
      const modelOptions: any = {};
      if (options?.temperature !== undefined) {
        modelOptions.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        modelOptions.maxOutputTokens = options.maxTokens;
      }
      
      // ストリーミング実行
      const stream = await this.client.stream([message], modelOptions);

      for await (const chunk of stream) {
        try {
          // チャンクの内容を文字列に変換
          const content = this.extractContentAsString(chunk.content);

          if (content) {
            fullText += content;
            handler.onChunk(content);
          }
        } catch (error) {
          logger.warn('チャンク処理中にエラーが発生しました', { error });
          // エラーがあっても処理を続行
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 使用トークン数を推定
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(fullText.length / 4);

      // 完了時にハンドラを呼び出し
      const response: ModelResponse = {
        text: fullText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        metadata: {
          model: this.id,
          provider: this.provider,
          processingTime,
        },
      };

      // ログにチャットを記録
      logger.debug('Google AI ストリーミングレスポンス完了', { modelId: this.id, prompt, response: response.text });

      // チャットログ記録はコメントアウト
      // if (this.config?.logging?.chatHistory) {
      //   logger.chatLog(prompt, response.text);
      // }

      handler.onComplete(response);
    } catch (error) {
      // エラーハンドリング
      logger.error('Google ストリーミングエラー', { 
        error, 
        modelId: this.id,
        // エラーの詳細情報
        errorDetails: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      });
      
      if (error instanceof Error) {
        handler.onError(error);
      } else {
        const wrappedError = new AppError(
          'Google 不明なストリーミングエラー',
          ErrorCode.MODEL_ERROR,
          { error, modelId: this.id }
        );
        handler.onError(wrappedError);
      }
    }
  }
}

export default GoogleModel; 