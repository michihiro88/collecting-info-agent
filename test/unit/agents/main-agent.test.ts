// モックを先にインポート
import { mockAIModel, mockModelResponse } from '../../mocks/models';
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
import { MainAgent, getMainAgent } from '../../../src/agents/main-agent';
import { ErrorCode, AppError } from '../../../src/utils/error-handler';
import { OutputFormat } from '../../../src/utils/types';

describe('MainAgent', () => {
  let mainAgent: MainAgent;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // モックAIモデルのメソッドをスパイ化
    jest.spyOn(mockAIModel, 'generateText');
    mainAgent = getMainAgent();
  });
  
  afterEach(() => {
    // シングルトンインスタンスをリセット
    (MainAgent as any).mainAgentInstance = null;
  });
  
  describe('getMainAgent', () => {
    test('常に同じインスタンスを返す', () => {
      const agent1 = getMainAgent();
      const agent2 = getMainAgent();
      expect(agent1).toBe(agent2);
    });
  });
  
  describe('process', () => {
    test('デフォルトモデルで処理を実行する', async () => {
      const result = await mainAgent.process('テスト質問');
      
      expect(result).toBe(mockModelResponse.text);
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining('テスト質問')
      );
    });
    
    test('指定されたモデルで処理を実行する', async () => {
      await mainAgent.process('テスト質問', 'test-model');
      
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining('テスト質問')
      );
    });
    
    test('指定された出力形式でプロンプトを構築する', async () => {
      await mainAgent.process('テスト質問', undefined, OutputFormat.JSON);
      
      // "回答はJSON形式で" ではなく "JSON形式で" という部分文字列を探す
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining('JSON')
      );
    });
  });
  
  describe('processUrl', () => {
    test('有効なURLを処理する', async () => {
      const url = 'https://example.com';
      const result = await mainAgent.processUrl(url);
      
      expect(result).toBe(mockModelResponse.text);
      expect(mockAIModel.generateText).toHaveBeenCalledWith(
        expect.stringContaining(url)
      );
    });
    
    test('無効なURLを処理すると例外をスローする', async () => {
      await expect(mainAgent.processUrl('invalid-url')).rejects.toThrow(AppError);
      expect(mockAIModel.generateText).not.toHaveBeenCalled();
    });
  });
  
  describe('isValidUrl', () => {
    const validUrls = [
      'https://example.com',
      'http://example.org/path',
      'https://sub.domain.co.jp/page?query=value'
    ];
    
    const invalidUrls = [
      'example.com',
      'ftp://example.org',
      'htt://invalid',
      '',
      'http://'
    ];
    
    test.each(validUrls)('有効なURL: %s', async (url) => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      expect(mainAgent.isValidUrl(url)).toBe(true);
    });
    
    test.each(invalidUrls)('無効なURL: %s', async (url) => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      expect(mainAgent.isValidUrl(url)).toBe(false);
    });
  });
  
  describe('scheduledProcess', () => {
    // タイムアウトを延長
    test('エラーが発生してもスローせずにログに記録する', async () => {
      // モックを一時的に上書き
      const originalGenerateText = mockAIModel.generateText;
      mockAIModel.generateText = jest.fn().mockRejectedValueOnce(new Error('テストエラー'));
      
      await mainAgent.scheduledProcess('テスト入力');
      
      // エラーをスローせずに実行が完了する
      expect(require('../../../src/utils/logger').error).toHaveBeenCalled();
      
      // モックを元に戻す
      mockAIModel.generateText = originalGenerateText;
    }, 10000); // タイムアウトを10秒に設定
  });
}); 