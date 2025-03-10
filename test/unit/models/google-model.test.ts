import { GoogleModel } from '../../../src/models/providers/google-model';
import { ModelProvider } from '../../../src/utils/types';
import { TestStreamHandler } from '../../mocks/models';

// ChatGoogleGenerativeAIをモック
jest.mock('@langchain/google-genai', () => {
  return {
    ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
        text: () => 'モックされたレスポンス',
        content: 'モックされたレスポンス'
      })
    }))
  };
});

/**
 * Google AIモデル（Gemini）のテスト
 * 
 * このテストはモック化されています。
 */
describe('GoogleModel', () => {
  const originalEnv = process.env;
  const modelId = 'gemini-pro';
  const apiKeyEnv = 'GOOGLE_API_KEY';
  let model: GoogleModel;

  beforeEach(() => {
    // 各テスト前に環境変数を復元
    process.env = { ...originalEnv };
    process.env[apiKeyEnv] = 'test-api-key'; // テスト用にダミーのAPIキーを設定
    model = new GoogleModel(modelId, apiKeyEnv);
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
      const model = new GoogleModel('gemini-pro', apiKeyEnv);
      expect(model.id).toBe('gemini-pro');
    });

    test('モデル名にmodels/プレフィックスがある場合は削除', () => {
      const model = new GoogleModel('models/gemini-pro', apiKeyEnv);
      expect(model.id).toBe('gemini-pro');
    });

    test('gemini-1.0-proのような形式にも対応', () => {
      const model = new GoogleModel('gemini-1.0-pro', apiKeyEnv);
      expect(model.id).toBe('gemini-1.0-pro');
    });
  });

  describe('generateText', () => {
    test('APIキーが設定されていない場合はエラーをスロー', async () => {
      delete process.env[apiKeyEnv];
      await expect(model.generateText('テストプロンプト')).rejects.toThrow();
    });

    test('APIが設定されていればテキスト生成が実行される', async () => {
      const result = await model.generateText('テストプロンプト');
      expect(typeof result).toBe('object');
    });
  });

  describe('generateTextStream', () => {
    test.skip('ストリーミングレスポンスが正しく処理される（統合テスト）', async () => {
      // このテストはスキップします
      /**
       * スキップ理由：
       * 1. このテストはストリーミングレスポンスの処理を検証する統合テストです
       * 2. ストリーミングAPIは単体テスト環境でのモックが技術的に難しい処理を含みます
       * 3. 実際のGoogleのAPIとの連携が必要であり、テスト環境では適切に再現できません
       * 4. リアルタイムのイベント処理やストリーミングの非同期処理は、Jest環境での検証が複雑です
       * 5. 単体テスト環境では、ストリーミングの動作を正確に検証するのは難しいため、
       *    将来的により適切な統合テスト環境で実装することを想定しています
       */
    });
  });
}); 