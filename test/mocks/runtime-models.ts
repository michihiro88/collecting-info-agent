/**
 * 実行時用のモデルモック (jest非依存)
 */
import { ModelProvider, ModelResponse, SearchResult, SourceType } from '../../src/utils/types';
import { IAIModel, StreamResponseHandler } from '../../src/models/interfaces/ai-model';

// モックモデルレスポンス
export const mockModelResponse: ModelResponse = {
  text: 'テスト回答です。これはモックレスポンスとして生成されたテキストです。',
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150
  },
  metadata: {
    model: 'test-model',
    provider: ModelProvider.ANTHROPIC,
    processingTime: 1000
  }
};

// 拡張された検索結果のモック
export const mockSearchResults: SearchResult[] = [
  {
    title: 'テスト結果1',
    url: 'https://example.com/1',
    content: 'これはテスト結果1のコンテンツです。テストに関する情報が含まれています。',
    snippet: 'これはテスト結果1のスニペットです。',
    source: {
      type: SourceType.WEB,
      url: 'https://example.com/1'
    },
    metadata: {
      title: 'テスト結果1のタイトル',
      author: 'テスト著者1',
      date: '2023-01-01',
      description: 'テスト結果1の説明',
      keywords: ['テスト', 'モック', '結果1']
    },
    content2: {
      fullText: 'これはテスト結果1の完全なテキストです。テストに関する詳細情報が含まれています。',
      summary: 'テスト結果1の要約',
      keyPoints: ['テスト結果1のポイント1', 'テスト結果1のポイント2']
    },
    score: 0.95,
    relevance: 0.95,
    timestamp: new Date().toISOString()
  },
  {
    title: 'テスト結果2',
    url: 'https://example.com/2',
    content: 'これはテスト結果2のコンテンツです。テストの詳細情報が含まれています。',
    snippet: 'これはテスト結果2のスニペットです。',
    source: {
      type: SourceType.WEB,
      url: 'https://example.com/2'
    },
    metadata: {
      title: 'テスト結果2のタイトル',
      author: 'テスト著者2',
      date: '2023-01-02',
      description: 'テスト結果2の説明',
      keywords: ['テスト', 'モック', '結果2']
    },
    content2: {
      fullText: 'これはテスト結果2の完全なテキストです。テストに関する詳細情報が含まれています。',
      summary: 'テスト結果2の要約',
      keyPoints: ['テスト結果2のポイント1', 'テスト結果2のポイント2']
    },
    score: 0.85,
    relevance: 0.85,
    timestamp: new Date().toISOString()
  },
  {
    title: 'テスト結果3',
    url: 'https://example.com/3',
    content: 'これはテスト結果3のコンテンツです。テストの追加情報が含まれています。',
    snippet: 'これはテスト結果3のスニペットです。',
    source: {
      type: SourceType.WEB,
      url: 'https://example.com/3'
    },
    metadata: {
      title: 'テスト結果3のタイトル',
      author: 'テスト著者3',
      date: '2023-01-03',
      description: 'テスト結果3の説明',
      keywords: ['テスト', 'モック', '結果3']
    },
    content2: {
      fullText: 'これはテスト結果3の完全なテキストです。テストに関する詳細情報が含まれています。',
      summary: 'テスト結果3の要約',
      keyPoints: ['テスト結果3のポイント1', 'テスト結果3のポイント2']
    },
    score: 0.75,
    relevance: 0.75,
    timestamp: new Date().toISOString()
  }
];

// モックAIモデル (jest非依存バージョン)
export const mockAIModel: IAIModel = {
  id: 'mock-model',
  provider: ModelProvider.ANTHROPIC,
  isConfigured: () => true,
  generateText: async () => mockModelResponse,
  generateTextStream: async (
    prompt: string, 
    handler: StreamResponseHandler
  ) => {
    // チャンクを模倣して送信
    handler.onChunk('テスト回答');
    handler.onChunk('です。これはモック');
    handler.onChunk('レスポンスとして生成された');
    handler.onChunk('テキストです。');
    
    // 完了時にコールバックを呼び出し
    handler.onComplete(mockModelResponse);
  },
  generateWithContext: async () => mockModelResponse,
  handleError: async (error: unknown) => {
    // エラーを再スロー
    throw error;
  }
}; 