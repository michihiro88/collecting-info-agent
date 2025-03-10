import { OpenAIModel } from '../../../src/models/providers/openai-model';
import { ModelProvider } from '../../../src/utils/types';
import { TestStreamHandler } from '../../mocks/models';

/**
 * OpenAIモデルのテスト
 * 
 * このテストでは実際のAPIキーが必要です。
 * 環境変数OPENAI_API_KEYが定義されていない場合、テストをスキップします。
 */
describe('OpenAIModel', () => {
  const originalEnv = process.env;
  const modelId = 'gpt-3.5-turbo';
  const apiKeyEnv = 'OPENAI_API_KEY';
  let model: OpenAIModel;

  beforeEach(() => {
    // 各テスト前に環境変数を復元
    process.env = { ...originalEnv };
    model = new OpenAIModel(modelId, apiKeyEnv);
  });

  afterEach(() => {
    // テスト後に環境変数を元に戻す
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    test('APIキーが設定されていない場合はfalseを返す', () => {
      delete process.env[apiKeyEnv];
      expect(model.isConfigured()).toBe(false);
    });

    test('APIキーが設定されている場合はtrueを返す', () => {
      process.env[apiKeyEnv] = 'test-api-key';
      expect(model.isConfigured()).toBe(true);
    });
  });

  describe('モデル名の自動修正', () => {
    test('モデル名が基本形式の場合は変更なし', () => {
      const model = new OpenAIModel('gpt-4', apiKeyEnv);
      expect(model.id).toBe('gpt-4');
    });

    test('モデル名が短縮形の場合は正式名に修正', () => {
      const model = new OpenAIModel('gpt4', apiKeyEnv);
      expect(model.id).toBe('gpt-4');
    });

    test('モデル名にturboが含まれる場合は正式名に修正', () => {
      const model = new OpenAIModel('gpt4-turbo', apiKeyEnv);
      expect(model.id).toBe('gpt-4-turbo');
    });
  });

  describe('generateText', () => {
    test('APIキーが設定されていない場合はエラーをスロー', async () => {
      delete process.env[apiKeyEnv];
      await expect(model.generateText('テストプロンプト')).rejects.toThrow();
    });

    test('APIが設定されていればテキスト生成が実行される（統合テスト）', async () => {
      // テストをスキップするためのチェック
      if (!process.env[apiKeyEnv]) {
        console.log('⚠️ OpenAI APIキーが設定されていないため、このテストをスキップします');
        return;
      }

      try {
        const prompt = 'これは何ですか？短く答えてください。';
        const response = await model.generateText(prompt);
        
        // レスポンスの形式を検証
        expect(response).toHaveProperty('text');
        expect(typeof response.text).toBe('string');
        expect(response).toHaveProperty('usage');
        expect(response).toHaveProperty('metadata');
        expect(response.metadata.model).toBe(modelId);
        expect(response.metadata.provider).toBe(ModelProvider.OPENAI);
        
        console.log(`📝 OpenAI APIレスポンス: ${response.text.substring(0, 50)}...`);
      } catch (error) {
        console.error('❌ OpenAI APIエラー:', error);
        throw error;
      }
    }, 30000); // タイムアウトを30秒に設定
  });

  describe('generateTextStream', () => {
    test('ストリーミングレスポンスが正しく処理される（統合テスト）', async () => {
      // テストをスキップするためのチェック
      if (!process.env[apiKeyEnv]) {
        console.log('⚠️ OpenAI APIキーが設定されていないため、このテストをスキップします');
        return;
      }

      try {
        const prompt = 'これは何ですか？短く答えてください。';
        const handler = new TestStreamHandler();
        
        await model.generateTextStream(prompt, handler);
        
        // ストリーミングレスポンスの検証
        expect(handler.chunks.length).toBeGreaterThan(0);
        expect(handler.completeResponse).not.toBeNull();
        expect(handler.completeResponse?.metadata.model).toBe(modelId);
        expect(handler.completeResponse?.metadata.provider).toBe(ModelProvider.OPENAI);
        
        console.log(`📝 OpenAI ストリーミングレスポンス: ${handler.getFullText().substring(0, 50)}...`);
      } catch (error) {
        console.error('❌ OpenAI ストリーミングエラー:', error);
        throw error;
      }
    }, 30000); // タイムアウトを30秒に設定
  });
}); 