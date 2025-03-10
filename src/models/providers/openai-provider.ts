/**
 * OpenAI API プロバイダー
 */
import { IAIModel, StreamResponseHandler } from '../interfaces/ai-model';
import { ModelProvider, ModelResponse, ModelOptions } from '../../utils/types';
import { AppError, ErrorCode } from '../../utils/error-handler';
import { EnvManager } from '../../config/env-manager';
import { info, error } from '../../utils/logger';
import OpenAI from 'openai';

// メタデータ拡張型
interface ExtendedMetadata {
  model: string;
  provider: ModelProvider;
  processingTime: number;
  isError?: boolean;
  errorCode?: ErrorCode;
}

export class OpenAIProvider implements IAIModel {
  public id: string;
  public provider: ModelProvider = ModelProvider.OPENAI;
  
  private client: OpenAI | null = null;
  private apiKey: string | null = null;
  
  constructor(id: string) {
    this.id = id;
    
    // 環境変数からAPIキーを取得
    try {
      const envManager = EnvManager.getInstance();
      const apiKey = envManager.get('OPENAI_API_KEY');
      
      if (apiKey) {
        this.apiKey = apiKey;
        this.client = new OpenAI({
          apiKey: this.apiKey
        });
        info(`OpenAIプロバイダーを初期化しました: ${id}`);
      } else {
        error('OpenAI APIキーが設定されていません');
      }
    } catch (err) {
      error('OpenAIプロバイダーの初期化中にエラーが発生しました', { error: err });
      this.client = null;
    }
  }
  
  /**
   * APIキーが設定されているかどうかをチェック
   */
  isConfigured(): boolean {
    return !!this.client && !!this.apiKey;
  }
  
  /**
   * テキスト生成（非ストリーミング）
   */
  async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    if (!this.isConfigured()) {
      throw new AppError('OpenAI APIキーが設定されていません', ErrorCode.API_KEY_ERROR);
    }
    
    try {
      const startTime = Date.now();
      
      const response = await this.client!.chat.completions.create({
        model: this.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        n: 1,
        stream: false
      });
      
      const processingTime = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';
      
      return {
        text: content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        metadata: {
          model: this.id,
          provider: this.provider,
          processingTime
        }
      };
    } catch (err: any) {
      const errorResponse = await this.handleError(err);
      return errorResponse as ModelResponse;
    }
  }
  
  /**
   * コンテキスト付きテキスト生成
   */
  async generateWithContext(prompt: string, context: any[], options?: ModelOptions): Promise<ModelResponse> {
    if (!this.isConfigured()) {
      throw new AppError('OpenAI APIキーが設定されていません', ErrorCode.API_KEY_ERROR);
    }
    
    try {
      const startTime = Date.now();
      
      // メッセージの構築
      const messages = [
        ...context.map(ctx => {
          if (typeof ctx === 'string') {
            return { role: 'system', content: ctx };
          }
          return ctx;
        }),
        { role: 'user', content: prompt }
      ];
      
      const response = await this.client!.chat.completions.create({
        model: this.id,
        messages: messages as any[], // TODO: 型を適切に修正
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        n: 1,
        stream: false
      });
      
      const processingTime = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';
      
      return {
        text: content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        metadata: {
          model: this.id,
          provider: this.provider,
          processingTime
        }
      };
    } catch (err: any) {
      const errorResponse = await this.handleError(err);
      return errorResponse as ModelResponse;
    }
  }
  
  /**
   * ストリーミングレスポンス
   */
  async generateTextStream(prompt: string, handler: StreamResponseHandler, options?: ModelOptions): Promise<void> {
    if (!this.isConfigured()) {
      throw new AppError('OpenAI APIキーが設定されていません', ErrorCode.API_KEY_ERROR);
    }
    
    const startTime = Date.now();
    let totalContent = '';
    let promptTokens = 0;
    let completionTokens = 0;
    
    try {
      const stream = await this.client!.chat.completions.create({
        model: this.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        n: 1,
        stream: true
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        totalContent += content;
        
        if (content) {
          handler.onChunk(content);
        }
        
        // TODO: トークン数の追跡は現在は正確ではない
        completionTokens += content.length / 4; // 大まかな見積もり
      }
      
      // トークン数の大まかな見積もり
      promptTokens = prompt.length / 4;
      
      const processingTime = Date.now() - startTime;
      
      // 完了イベント
      handler.onComplete({
        text: totalContent,
        usage: {
          promptTokens: Math.ceil(promptTokens),
          completionTokens: Math.ceil(completionTokens),
          totalTokens: Math.ceil(promptTokens + completionTokens)
        },
        metadata: {
          model: this.id,
          provider: this.provider,
          processingTime
        }
      });
    } catch (err: any) {
      const errorResponse = await this.handleError(err);
      handler.onError(new Error(errorResponse.text));
    }
  }
  
  /**
   * エラー処理
   */
  async handleError(err: any): Promise<ModelResponse> {
    error('OpenAIプロバイダーでエラーが発生しました', { error: err });
    
    // エラーメッセージの初期化
    let errorMessage = 'OpenAI APIでエラーが発生しました';
    let errorCode = ErrorCode.MODEL_ERROR;
    
    // OpenAIのエラーオブジェクトの処理
    if (err.status) {
      switch (err.status) {
        case 401:
          errorMessage = 'OpenAI API認証エラー: APIキーが無効または期限切れです';
          errorCode = ErrorCode.AUTHENTICATION_ERROR;
          break;
        case 429:
          errorMessage = 'OpenAI APIレート制限エラー: リクエスト制限を超えました';
          errorCode = ErrorCode.MODEL_LIMIT_EXCEEDED;
          break;
        case 500:
        case 503:
          errorMessage = 'OpenAI APIサーバーエラー: サービスが一時的に利用できません';
          errorCode = ErrorCode.MODEL_UNAVAILABLE;
          break;
        case 400:
          if (err.error?.code === 'content_filter') {
            errorMessage = 'OpenAI APIコンテンツポリシー違反: 入力または出力がポリシーに違反しています';
          } else {
            errorMessage = `OpenAI APIリクエストエラー: ${err.error?.message || '無効なリクエスト'}`;
          }
          break;
      }
    }
    
    // エラーが発生した場合、エラーメッセージを含むレスポンスを返す
    return {
      text: errorMessage,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        model: this.id,
        provider: this.provider,
        processingTime: 0,
        isError: true,
        errorCode: errorCode
      } as ExtendedMetadata
    };
  }
} 