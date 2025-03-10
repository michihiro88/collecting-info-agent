import { ModelSelector, getModelSelector } from '../../../src/models/selector';
import { ModelProvider } from '../../../src/utils/types';
import { jest } from '@jest/globals';
import * as configLoaderModule from '../../../src/config/config-loader';
import { ConfigLoader } from '../../../src/config/config-loader';
import { AppError } from '../../../src/utils/error-handler';

// 環境変数のモック
const originalEnv = process.env;

// 設定ローダーのモック
jest.mock('../../../src/config/config-loader', () => {
  const mockConfigLoader = {
    getConfig: jest.fn()
  };
  
  return {
    getConfigLoader: jest.fn(() => mockConfigLoader),
    ConfigLoader: jest.fn(() => mockConfigLoader)
  };
});

describe('ModelSelector', () => {
  // テスト用のモック設定
  const mockConfig = {
    models: {
      default: 'test-model',
      available: [
        { 
          name: 'test-model', 
          provider: ModelProvider.ANTHROPIC, 
          apiKeyEnv: 'TEST_API_KEY',
          maxTokens: 1000,
          temperature: 0.7
        },
        { 
          name: 'test-model-2', 
          provider: ModelProvider.OPENAI, 
          apiKeyEnv: 'TEST_API_KEY_2',
          maxTokens: 2000,
          temperature: 0.5
        }
      ]
    }
  };

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    process.env.TEST_API_KEY = 'test-key';
    process.env.TEST_API_KEY_2 = 'test-key-2';
    
    // 設定をモック
    const getConfigLoaderMock = configLoaderModule.getConfigLoader as jest.Mock;
    getConfigLoaderMock.mockReturnValue({
      getConfig: jest.fn().mockReturnValue(mockConfig)
    });
    
    // シングルトンインスタンスをリセット
    // @ts-ignore: private属性にアクセス
    jest.spyOn(ModelSelector.prototype, 'initializeModels').mockImplementation(function(this: any) {
      // モデルの初期化をスキップ
      this.models = new Map();
      this.models.set('test-model', {
        id: 'test-model',
        provider: ModelProvider.ANTHROPIC,
        isConfigured: () => true,
        generateText: jest.fn(),
        generateTextStream: jest.fn(),
        generateWithContext: jest.fn(),
        handleError: jest.fn()
      });
      this.models.set('test-model-2', {
        id: 'test-model-2',
        provider: ModelProvider.OPENAI,
        isConfigured: () => true,
        generateText: jest.fn(),
        generateTextStream: jest.fn(),
        generateWithContext: jest.fn(),
        handleError: jest.fn()
      });
    });
  });

  afterEach(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('getDefaultModelはデフォルトモデルを返す', () => {
    const modelSelector = new ModelSelector();
    const model = modelSelector.getDefaultModel();
    
    expect(model).toBeDefined();
    expect(model.id).toBe('test-model');
    expect(model.provider).toBe(ModelProvider.ANTHROPIC);
  });

  test('getModelは指定されたモデルを返す', () => {
    const modelSelector = new ModelSelector();
    const model = modelSelector.getModel('test-model-2');
    
    expect(model).toBeDefined();
    expect(model.id).toBe('test-model-2');
    expect(model.provider).toBe(ModelProvider.OPENAI);
  });

  test('存在しないモデルを要求するとエラーが発生する', () => {
    const modelSelector = new ModelSelector();
    
    // モックモデルマップから'test-model'を削除して、デフォルトモデルも存在しない状況を作る
    // @ts-ignore: private属性にアクセス
    modelSelector.models.clear();
    
    // エラーが発生することを確認
    expect(() => {
      modelSelector.getModel('non-existent-model');
    }).toThrow();
  });

  test('getAvailableModelNamesは全てのモデル名を返す', () => {
    const modelSelector = new ModelSelector();
    const modelNames = modelSelector.getAvailableModelNames();
    
    expect(modelNames).toContain('test-model');
    expect(modelNames).toContain('test-model-2');
    expect(modelNames.length).toBe(2);
  });

  test('getModelsByProviderは指定したプロバイダのモデルのみを返す', () => {
    const modelSelector = new ModelSelector();
    
    const anthropicModels = modelSelector.getModelsByProvider(ModelProvider.ANTHROPIC);
    expect(anthropicModels.length).toBe(1);
    expect(anthropicModels[0].id).toBe('test-model');
    
    const openaiModels = modelSelector.getModelsByProvider(ModelProvider.OPENAI);
    expect(openaiModels.length).toBe(1);
    expect(openaiModels[0].id).toBe('test-model-2');
  });

  test('getModelSelectorはシングルトンインスタンスを返す', () => {
    const selector1 = getModelSelector();
    const selector2 = getModelSelector();
    
    expect(selector1).toBe(selector2);
  });
}); 