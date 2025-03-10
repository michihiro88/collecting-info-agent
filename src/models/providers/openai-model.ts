import { BaseModel } from '../interfaces/base-model';
import { ModelOptions, ModelProvider, ModelResponse } from '../../utils/types';
import { StreamResponseHandler } from '../interfaces/ai-model';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

/**
 * OpenAI GPT モデルの実装
 */
export class OpenAIModel extends BaseModel {
  private client: ChatOpenAI | null = null;

  /**
   * コンストラクタ
   * @param id モデルID
   * @param apiKeyEnv APIキー環境変数名
   */
  constructor(id: string, apiKeyEnv: string) {
    super(id, ModelProvider.OPENAI, apiKeyEnv);
    
    // モデル名を正しい形式に修正
    this.validateAndCorrectModelId();
    
    this.initClient();
  }

  /**
   * モデル名を検証して必要に応じて修正
   */
  private validateAndCorrectModelId(): void {
    // OpenAIモデルの正式名称マッピング
    const modelMap: Record<string, string> = {
      'gpt4': 'gpt-4',
      'gpt4-turbo': 'gpt-4-turbo',
      'gpt35': 'gpt-3.5-turbo',
      'gpt35-turbo': 'gpt-3.5-turbo',
      'gpt3': 'gpt-3.5-turbo',
      'gpt3-turbo': 'gpt-3.5-turbo'
    };

    // モデル名が短縮形の場合は正式名に修正
    if (modelMap[this.id]) {
      logger.debug(`OpenAIモデル名を修正: ${this.id} → ${modelMap[this.id]}`);
      (this as any).id = modelMap[this.id];
    }
  }

  /**
   * OpenAI クライアントの初期化
   */
  private initClient(): void {
    if (!this.isConfigured()) {
      logger.warn(`OpenAI APIキーが設定されていません (環境変数: ${this.apiKeyEnv})`);
      return;
    }

    try {
      this.client = new ChatOpenAI({
        apiKey: this.apiKey,
        modelName: this.id,
      });
      logger.debug(`OpenAI クライアントを初期化しました (モデル: ${this.id})`);
    } catch (error) {
      logger.error('OpenAI クライアントの初期化に失敗しました', { error });
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
          'OpenAI クライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('OpenAIモデルへのリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });

    // 計測開始
    const { result, processingTime } = await this.measureTime(async () => {
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
        if (options?.topP !== undefined) {
          modelOptions.topP = options.topP;
        }
        if (options?.frequencyPenalty !== undefined) {
          modelOptions.frequencyPenalty = options.frequencyPenalty;
        }
        if (options?.presencePenalty !== undefined) {
          modelOptions.presencePenalty = options.presencePenalty;
        }
        
        // クライアントの呼び出し
        const response = await this.client!.invoke([message], modelOptions);
        
        logger.debug('OpenAI APIからレスポンスを受信しました', {
          modelId: this.id,
        });

        return response;
      } catch (error) {
        logger.error('OpenAI API呼び出しエラー', { error, modelId: this.id });
        throw error;
      }
    });

    const responseText = result.content.toString();
    
    // 使用トークン数を推定
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(responseText.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // レスポンスをModelResponse形式に変換
    const response: ModelResponse = {
      text: responseText,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
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
          'OpenAI クライアントが初期化されていません',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
      }
    }

    // プロンプトの前にログを記録
    logger.debug('OpenAIモデルへのストリーミングリクエスト', { 
      modelId: this.id,
      promptLength: prompt.length
    });

    const startTime = Date.now();
    let fullText = '';

    try {
      // メッセージの準備
      const message = new HumanMessage(prompt);
      
      // モデルオプションの準備
      const modelOptions: any = {
        streaming: true
      };
      if (options?.temperature !== undefined) {
        modelOptions.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        modelOptions.maxTokens = options.maxTokens;
      }
      if (options?.topP !== undefined) {
        modelOptions.topP = options.topP;
      }
      if (options?.frequencyPenalty !== undefined) {
        modelOptions.frequencyPenalty = options.frequencyPenalty;
      }
      if (options?.presencePenalty !== undefined) {
        modelOptions.presencePenalty = options.presencePenalty;
      }
      
      // ストリーミング処理
      const stream = await this.client.stream([message], modelOptions);

      for await (const chunk of stream) {
        if (chunk.content) {
          const chunkText = chunk.content.toString();
          fullText += chunkText;
          handler.onChunk(chunkText);
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

      handler.onComplete(response);

      // ログにチャットを記録
      logger.debug('OpenAIストリーミングレスポンス完了', { 
        modelId: this.id, 
        prompt, 
        response: fullText 
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error('OpenAI ストリーミングエラー', { error });
        handler.onError(error);
      } else {
        const wrappedError = new AppError(
          'OpenAI 不明なストリーミングエラー',
          ErrorCode.MODEL_ERROR,
          { modelId: this.id }
        );
        logger.error('OpenAI 不明なストリーミングエラー', { error });
        handler.onError(wrappedError);
      }
    }
  }
}

export default OpenAIModel; 