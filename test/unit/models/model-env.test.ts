import { EnvManager } from '../../../src/config/env-manager';
import { OpenAIModel } from '../../../src/models/providers/openai-model';
import { AnthropicModel } from '../../../src/models/providers/anthropic-model';
import { GoogleModel } from '../../../src/models/providers/google-model';
import { AppError, ErrorCode } from '../../../src/utils/error-handler';

describe('Model Environment Variables Integration', () => {
  let envManager: EnvManager;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    envManager = EnvManager.getInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OpenAI Model', () => {
    test('APIキーが未設定の場合はエラーが発生する', async () => {
      // APIキーを削除
      delete process.env.OPENAI_API_KEY;
      
      const openaiModel = new OpenAIModel('gpt-4', 'OPENAI_API_KEY');
      
      // isConfiguredメソッドがfalseを返すことを確認
      expect(openaiModel.isConfigured()).toBe(false);
      
      // テキスト生成を試みるとエラーが発生することを確認
      await expect(openaiModel.generateText('test', {})).rejects.toThrow();
    });

    test('APIキーが設定されている場合は正常に初期化される', () => {
      // テスト用APIキーを設定
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const openaiModel = new OpenAIModel('gpt-4', 'OPENAI_API_KEY');
      
      // isConfiguredメソッドがtrueを返すことを確認
      expect(openaiModel.isConfigured()).toBe(true);
      // モデルIDが正しく設定されていることを確認
      expect(openaiModel.id).toBe('gpt-4');
    });
  });

  describe('Anthropic Model', () => {
    test('APIキーが未設定の場合はエラーが発生する', async () => {
      // APIキーを削除
      delete process.env.ANTHROPIC_API_KEY;
      
      const anthropicModel = new AnthropicModel('claude-3-sonnet-20240229', 'ANTHROPIC_API_KEY');
      
      // isConfiguredメソッドがfalseを返すことを確認
      expect(anthropicModel.isConfigured()).toBe(false);
      
      // テキスト生成を試みるとエラーが発生することを確認
      await expect(anthropicModel.generateText('test', {})).rejects.toThrow();
    });

    test('APIキーが設定されている場合は正常に初期化される', () => {
      // テスト用APIキーを設定
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      
      const anthropicModel = new AnthropicModel('claude-3-sonnet-20240229', 'ANTHROPIC_API_KEY');
      
      // isConfiguredメソッドがtrueを返すことを確認
      expect(anthropicModel.isConfigured()).toBe(true);
      // モデルIDが正しく設定されていることを確認
      expect(anthropicModel.id).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('Google Model', () => {
    test('APIキーが未設定の場合はエラーが発生する', async () => {
      // APIキーを削除
      delete process.env.GOOGLE_API_KEY;
      
      const googleModel = new GoogleModel('gemini-pro', 'GOOGLE_API_KEY');
      
      // isConfiguredメソッドがfalseを返すことを確認
      expect(googleModel.isConfigured()).toBe(false);
      
      // テキスト生成を試みるとエラーが発生することを確認
      await expect(googleModel.generateText('test', {})).rejects.toThrow();
    });

    test('APIキーが設定されている場合は正常に初期化される', () => {
      // テスト用APIキーを設定
      process.env.GOOGLE_API_KEY = 'google-test-key';
      
      const googleModel = new GoogleModel('gemini-pro', 'GOOGLE_API_KEY');
      
      // isConfiguredメソッドがtrueを返すことを確認
      expect(googleModel.isConfigured()).toBe(true);
      // モデルIDが正しく設定されていることを確認
      expect(googleModel.id).toBe('gemini-pro');
    });
  });
}); 