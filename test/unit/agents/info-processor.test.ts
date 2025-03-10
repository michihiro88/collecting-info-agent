// モックを先にインポート
import { mockAIModel, mockModelResponse, mockSearchResults } from '../../mocks/models';
import { mockConfig, mockConfigLoader } from '../../mocks/config';

// 次に依存モジュールをモック化
jest.mock('../../../src/config/config-loader', () => ({
  getConfigLoader: jest.fn().mockReturnValue(mockConfigLoader)
}));

jest.mock('../../../src/models/selector', () => ({
  getModelSelector: jest.fn().mockReturnValue({
    getDefaultModel: jest.fn().mockReturnValue(mockAIModel),
    getModel: jest.fn().mockImplementation((modelName: string) => {
      if (modelName === 'test-model') {
        return mockAIModel;
      }
      throw new Error(`モデル ${modelName} が見つかりません`);
    })
  })
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// 最後に実際のモジュールをインポート
import { InfoProcessorAgent, getInfoProcessorAgent } from '../../../src/agents/info-processor';
import { OutputFormat } from '../../../src/utils/types';

describe('InfoProcessorAgent', () => {
  let infoProcessor: InfoProcessorAgent;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // モックAIモデルのメソッドをスパイ化
    jest.spyOn(mockAIModel, 'generateText');
    infoProcessor = getInfoProcessorAgent();
  });
  
  afterEach(() => {
    // シングルトンインスタンスをリセット
    (InfoProcessorAgent as any).infoProcessorAgentInstance = null;
  });
  
  describe('getInfoProcessorAgent', () => {
    test('常に同じインスタンスを返す', () => {
      const agent1 = getInfoProcessorAgent();
      const agent2 = getInfoProcessorAgent();
      expect(agent1).toBe(agent2);
    });
  });
  
  describe('processResults', () => {
    test('デフォルトモデルで処理を実行する', async () => {
      const query = 'テスト質問';
      const result = await infoProcessor.processResults(query, mockSearchResults);
      
      expect(result).toBe(mockModelResponse.text);
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining(query)
      );
    });
    
    test('検索結果が空の場合は適切なメッセージを返す', async () => {
      const result = await infoProcessor.processResults('テスト質問', []);
      
      expect(result).toContain('検索結果はありませんでした');
      expect(mockAIModel.generateText).not.toHaveBeenCalled();
    });
    
    test('指定されたモデルで処理を実行する', async () => {
      await infoProcessor.processResults('テスト質問', mockSearchResults, 'test-model');
      
      expect(mockAIModel.generateText).toHaveBeenCalled();
    });
    
    test('指定された出力形式でプロンプトを構築する', async () => {
      await infoProcessor.processResults('テスト質問', mockSearchResults, undefined, OutputFormat.HTML);
      
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining('HTML形式で')
      );
    });
  });
  
  describe('summarize', () => {
    test('コンテンツを要約する', async () => {
      const content = '要約するための長いテキスト'.repeat(20);
      const result = await infoProcessor.summarize(content);
      
      expect(result).toBe(mockModelResponse.text);
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining(content)
      );
    });
    
    test('コンテンツが空の場合は適切なメッセージを返す', async () => {
      const result = await infoProcessor.summarize('');
      
      expect(result).toContain('要約するコンテンツがありません');
      expect(mockAIModel.generateText).not.toHaveBeenCalled();
    });
    
    test('指定された最大長を反映したプロンプトを作成する', async () => {
      const maxLength = 500;
      await infoProcessor.summarize('長いテキスト', undefined, maxLength);
      
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining(`最大${maxLength}文字程度に要約`)
      );
    });
  });
  
  describe('extractKeyFacts', () => {
    test('重要な事実を抽出する', async () => {
      // JSONレスポンスをモック
      const jsonResponse = {
        text: '```json\n{"facts":["事実1 [出典: 1]","事実2 [出典: 2]"],"reliability":"高"}\n```',
        usage: mockModelResponse.usage,
        metadata: mockModelResponse.metadata
      };
      
      const originalGenerateText = mockAIModel.generateText;
      mockAIModel.generateText = jest.fn().mockResolvedValueOnce(jsonResponse);
      
      const result = await infoProcessor.extractKeyFacts('テスト質問', mockSearchResults);
      
      expect(result).toEqual({
        facts: ["事実1 [出典: 1]", "事実2 [出典: 2]"],
        sources: mockSearchResults.map(r => r.url)
      });
      
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining('テスト質問')
      );
      
      // モックを元に戻す
      mockAIModel.generateText = originalGenerateText;
    });
    
    test('JSON解析エラーの場合はテキストをそのまま返す', async () => {
      // 不正なJSONレスポンスをモック
      const invalidJsonResponse = {
        text: '不正なJSON形式の回答',
        usage: mockModelResponse.usage,
        metadata: mockModelResponse.metadata
      };
      
      const originalGenerateText = mockAIModel.generateText;
      mockAIModel.generateText = jest.fn().mockResolvedValueOnce(invalidJsonResponse);
      
      const result = await infoProcessor.extractKeyFacts('テスト質問', mockSearchResults);
      
      expect(result).toEqual({
        facts: [invalidJsonResponse.text],
        sources: mockSearchResults.map(r => r.url)
      });
      
      // モックを元に戻す
      mockAIModel.generateText = originalGenerateText;
    });
    
    test('検索結果が空の場合は空の配列を返す', async () => {
      const result = await infoProcessor.extractKeyFacts('テスト質問', []);
      
      expect(result).toEqual({
        facts: [],
        sources: []
      });
      
      expect(mockAIModel.generateText).not.toHaveBeenCalled();
    });
  });
  
  describe('buildContext', () => {
    test('検索結果からコンテキストを構築する', () => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const context = infoProcessor.buildContext(mockSearchResults);
      
      mockSearchResults.forEach((result, index) => {
        expect(context).toContain(`[${index + 1}]`);
        expect(context).toContain(result.title);
        expect(context).toContain(result.url);
        expect(context).toContain(result.snippet || result.content.substring(0, 50));
      });
    });
  });
  
  describe('createPrompt', () => {
    test('Markdown形式のプロンプトを作成する', () => {
      const query = 'テスト質問';
      const context = 'テストコンテキスト';
      
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const prompt = infoProcessor.createPrompt(query, context, OutputFormat.MARKDOWN);
      
      expect(prompt).toContain(query);
      expect(prompt).toContain(context);
      expect(prompt).toContain('Markdown形式で');
    });
    
    test('HTML形式のプロンプトを作成する', () => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const prompt = infoProcessor.createPrompt('質問', 'コンテキスト', OutputFormat.HTML);
      
      expect(prompt).toContain('HTML形式で');
      expect(prompt).toContain('適切なタグ');
    });
    
    test('JSON形式のプロンプトを作成する', () => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const prompt = infoProcessor.createPrompt('質問', 'コンテキスト', OutputFormat.JSON);
      
      expect(prompt).toContain('JSON形式で');
      expect(prompt).toContain('{"answer": "...", "sources": [...]}');
    });
    
    test('テキスト形式のプロンプトを作成する', () => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const prompt = infoProcessor.createPrompt('質問', 'コンテキスト', OutputFormat.TEXT);
      
      expect(prompt).toContain('プレーンテキスト形式');
    });
  });
}); 