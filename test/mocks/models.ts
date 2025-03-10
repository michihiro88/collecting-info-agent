import { ModelProvider, ModelResponse, SearchResult, SourceType, Content, ContentMetadata, Source } from '../../src/utils/types';
import { IAIModel, StreamResponseHandler } from '../../src/models/interfaces/ai-model';
import { ModelOptions } from '../../src/utils/types';

/**
 * モックモデルレスポンス
 */
export const MOCK_MODEL_RESPONSE: ModelResponse = {
  text: 'これはテスト回答です。AIモデルからの応答をシミュレートしています。',
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  },
  metadata: {
    model: 'mock-model',
    provider: ModelProvider.ANTHROPIC,
    processingTime: 500,
  },
};

// エクスポート変数を追加
export const mockModelResponse = MOCK_MODEL_RESPONSE;

/**
 * モック検索結果
 */
export const MOCK_SEARCH_RESULTS: SearchResult[] = [
  {
    title: 'テスト記事1',
    url: 'https://example.com/article1',
    content: 'これはテスト記事1の内容です。検索結果の例として使用されています。',
    snippet: 'これはテスト記事1のスニペットです。',
    score: 0.95,
    timestamp: new Date().toISOString(),
    // SearchResultインターフェースに必要なプロパティを追加
    source: { 
      type: SourceType.WEB, 
      url: 'https://example.com/article1' 
    },
    metadata: {
      title: 'テスト記事1',
      author: 'テスト著者',
      date: new Date().toISOString(),
      description: 'テスト記事1の説明'
    },
    content2: {
      fullText: 'これはテスト記事1の内容です。検索結果の例として使用されています。',
      summary: 'テスト記事1のサマリー'
    },
    relevance: 0.95
  },
  {
    title: 'テスト記事2',
    url: 'https://example.com/article2',
    content: 'これはテスト記事2の内容です。検索結果の別の例です。',
    snippet: 'これはテスト記事2のスニペットです。',
    score: 0.85,
    timestamp: new Date().toISOString(),
    // SearchResultインターフェースに必要なプロパティを追加
    source: { 
      type: SourceType.WEB, 
      url: 'https://example.com/article2' 
    },
    metadata: {
      title: 'テスト記事2',
      author: 'テスト著者2',
      date: new Date().toISOString(),
      description: 'テスト記事2の説明'
    },
    content2: {
      fullText: 'これはテスト記事2の内容です。検索結果の別の例です。',
      summary: 'テスト記事2のサマリー'
    },
    relevance: 0.85
  },
];

// エクスポート変数を追加
export const mockSearchResults = MOCK_SEARCH_RESULTS;

/**
 * モックAIモデルクラス
 * テスト用に一貫した応答を提供
 */
export class MockAIModel implements IAIModel {
  // IAIModelインターフェースの必須プロパティ
  public id: string;
  public provider: ModelProvider;
  
  private mockResponse: ModelResponse;
  
  constructor(
    id: string = 'mock-model',
    provider: ModelProvider = ModelProvider.ANTHROPIC,
    mockResponse: ModelResponse = MOCK_MODEL_RESPONSE
  ) {
    this.id = id;
    this.provider = provider;
    this.mockResponse = mockResponse;
  }
  
  /**
   * APIキーが設定されているかどうかをチェック
   */
  isConfigured(): boolean {
    return true;
  }
  
  /**
   * テキスト生成（非ストリーミング）
   */
  async generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
    // タイミングをシミュレート
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      ...this.mockResponse,
      metadata: {
        ...this.mockResponse.metadata,
        model: this.id,
        provider: this.provider
      }
    };
  }
  
  /**
   * コンテキスト付きテキスト生成
   */
  async generateWithContext(prompt: string, context: any[], options?: ModelOptions): Promise<ModelResponse> {
    // タイミングをシミュレート
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      ...this.mockResponse,
      metadata: {
        ...this.mockResponse.metadata,
        model: this.id,
        provider: this.provider
      }
    };
  }
  
  /**
   * ストリーミングレスポンス
   */
  async generateTextStream(prompt: string, handler: StreamResponseHandler, options?: ModelOptions): Promise<void> {
    // ストリーミングをシミュレート
    const chunks = this.mockResponse.text.split(' ');
    
    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 50));
      handler.onChunk(chunk + ' ');
    }
    
    // 完了イベント
    handler.onComplete({
      ...this.mockResponse,
      metadata: {
        ...this.mockResponse.metadata,
        model: this.id,
        provider: this.provider
      }
    });
  }
  
  /**
   * エラー処理
   */
  async handleError(error: unknown): Promise<ModelResponse | null> {
    // エラーの場合はnullを返す
    if (error instanceof Error) {
      console.error(`MockAIModel エラー: ${error.message}`);
    }
    return null;
  }
}

// エクスポート変数を追加
export const mockAIModel = new MockAIModel();

/**
 * テスト用のストリームハンドラ
 */
export class TestStreamHandler implements StreamResponseHandler {
  chunks: string[] = [];
  completeResponse: ModelResponse | null = null;
  error: Error | null = null;
  
  onChunk(chunk: string): void {
    this.chunks.push(chunk);
  }
  
  onComplete(response: ModelResponse): void {
    this.completeResponse = response;
  }
  
  onError(error: Error): void {
    this.error = error;
  }
  
  getFullText(): string {
    return this.chunks.join('');
  }
} 