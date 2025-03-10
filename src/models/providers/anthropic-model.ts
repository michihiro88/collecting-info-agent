import { BaseModel } from '../interfaces/base-model';
import { ModelOptions, ModelProvider, ModelResponse } from '../../utils/types';
import { StreamResponseHandler } from '../interfaces/ai-model';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';
import { ChatAnthropicMessages } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Anthropic AIモデル（Claude）の実装
 */
export class AnthropicModel extends BaseModel {
  private client: ChatAnthropicMessages | null = null;

  /**
   * コンストラクタ
   * @param id モデルID
   * @param apiKeyEnv APIキー環境変数名
   */
  constructor(id: string, apiKeyEnv: string) {
    super(id, ModelProvider.ANTHROPIC, apiKeyEnv);
    
    // モデル名を修正（必要に応じて）
    this.validateAndCorrectModelId();
    
    this.initClient();
  }

  /**
   * モデル名を検証して必要に応じて修正
   */
  private validateAndCorrectModelId(): void {
    // Anthropicモデルの正式名称マッピング
    const modelMap: Record<string, string> = {
      'claude': 'claude-3-opus-20240229',
      'claude-2': 'claude-2.1',
      'claude-3': 'claude-3-opus-20240229',
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
      'claude-instant': 'claude-instant-1.2'
    };
    
    if (modelMap[this.id]) {
      if (this.id !== modelMap[this.id]) {
        logger.debug(`Anthropicモデル名を "${this.id}" から "${modelMap[this.id]}" に更新します。`);
        (this as any).id = modelMap[this.id];
      }
    }
  }

  /**
   * Anthropic APIクライアントの初期化
   */
  private initClient(): void {
    if (!this.isConfigured()) {
      logger.warn(`Anthropic APIキーが設定されていません (環境変数: ${this.apiKeyEnv})`);
      return;
    }

    try {
      this.client = new ChatAnthropicMessages({
        apiKey: this.apiKey as string,
        modelName: this.id,
        maxTokens: 1024 // デフォルト値
      });
      
      logger.debug(`Anthropicクライアントを初期化しました (モデル: ${this.id})`);
    } catch (error) {
      logger.error('Anthropicクライアントの初期化に失敗しました', { error, modelId: this.id });
      this.client = null;
    }
  }

  /**
   * レスポンスからテキストを安全に抽出するヘルパーメソッド
   */
  private extractTextFromResponse(response: any): string {
    if (!response) return '';
    
    // 文字列の場合はそのまま返す
    if (typeof response === 'string') {
      return response;
    }
    
    try {
      // contentプロパティが存在する場合
      if (response.content !== undefined) {
        if (typeof response.content === 'string') {
          return response.content;
        }
        
        // 配列の場合（LangChain v0.3の形式）
        if (Array.isArray(response.content)) {
          return response.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item?.text) return item.text;
              if (item?.value) return item.value;
              return '';
            })
            .filter(Boolean)
            .join('');
        }
        
        // オブジェクトの場合
        if (typeof response.content === 'object' && response.content !== null) {
          if (response.content.text) return response.content.text;
          if (response.content.value) return response.content.value;
          return JSON.stringify(response.content);
        }
      }
      
      // text直接アクセス
      if (response.text !== undefined) {
        return typeof response.text === 'string' ? response.text : JSON.stringify(response.text);
      }
      
      // toString()メソッドを持つオブジェクト
      if (typeof response.toString === 'function' && 
          response.toString !== Object.prototype.toString) {
        return response.toString();
      }
      
      // valueプロパティ
      if (response.value !== undefined) {
        return typeof response.value === 'string' ? response.value : JSON.stringify(response.value);
      }
      
      // その他のケース
      return JSON.stringify(response);
    } catch (error) {
      logger.warn('レスポンスからテキスト抽出中にエラーが発生しました', { error });
      return String(response);
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
          'Anthropicクライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('Anthropicモデルへのリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });

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
            modelOptions.maxTokens = options.maxTokens;
          }

          // クライアントの呼び出し
          const response = await this.client!.invoke([message], modelOptions);
          
          // レスポンスの内容を抽出
          const content = this.extractTextFromResponse(response);

          logger.debug('Anthropicからレスポンスを受信しました', {
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
            logger.warn(`Anthropic API呼び出しでエラー発生。${waitTime}ms後に再試行します (${attempt}/${maxRetries})`, { error });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // 再試行回数を超えたかその他のエラーの場合
          logger.error('Anthropic API呼び出しエラー', { error, modelId: this.id, attemptNumber: attempt, retriesLeft: maxRetries - attempt });
          throw error;
        }
      }
    });

    // ログにチャットを記録
    logger.debug('Anthropicモデルからのレスポンス', {
      modelId: this.id,
      response: result
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
          'Anthropicクライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('Anthropicモデルへのストリーミングリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });

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
        modelOptions.maxTokens = options.maxTokens;
      }
      
      // ストリーミング実行
      const stream = await this.client.stream([message], modelOptions);

      for await (const chunk of stream) {
        try {
          // チャンクの内容を抽出
          const content = this.extractTextFromResponse(chunk);

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
      logger.debug('Anthropicストリーミングレスポンス完了', {
        modelId: this.id,
        response: fullText
      });

      handler.onComplete(response);
    } catch (error) {
      // エラーハンドリング
      logger.error('Anthropic ストリーミングエラー', { 
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
          'Anthropic 不明なストリーミングエラー',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id, rawError: error }
        );
        handler.onError(wrappedError);
      }
    }
  }
}

export default AnthropicModel; 