import { EnvManager } from '../../../src/config/env-manager';

describe('EnvManager', () => {
  let envManager: EnvManager;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test'; // テスト環境に設定
    envManager = EnvManager.getInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('環境変数が正しく取得できる', () => {
    process.env.TEST_ENV_VAR = 'test-value';
    expect(envManager.get('TEST_ENV_VAR')).toBe('test-value');
  });

  test('存在しない環境変数はundefinedが返る', () => {
    delete process.env.NONEXISTENT_VAR;
    expect(envManager.get('NONEXISTENT_VAR')).toBeUndefined();
  });

  test('必須環境変数が未設定の場合はエラー', () => {
    delete process.env.REQUIRED_VAR;
    expect(() => envManager.getRequired('REQUIRED_VAR')).toThrow();
  });

  test('デフォルト値が正しく使用される', () => {
    delete process.env.DEFAULT_TEST_VAR;
    expect(envManager.getWithDefault('DEFAULT_TEST_VAR', 'default-value')).toBe('default-value');

    process.env.DEFAULT_TEST_VAR = 'custom-value';
    expect(envManager.getWithDefault('DEFAULT_TEST_VAR', 'default-value')).toBe('custom-value');
  });

  test('数値環境変数が正しく変換される', () => {
    process.env.NUMBER_VAR = '123';
    expect(envManager.getNumber('NUMBER_VAR', 0)).toBe(123);

    process.env.INVALID_NUMBER = 'not-a-number';
    expect(envManager.getNumber('INVALID_NUMBER', 42)).toBe(42);
  });

  test('真偽値環境変数が正しく変換される', () => {
    process.env.BOOL_TRUE = 'true';
    process.env.BOOL_FALSE = 'false';
    process.env.BOOL_INVALID = 'not-a-boolean';

    expect(envManager.getBoolean('BOOL_TRUE', false)).toBe(true);
    expect(envManager.getBoolean('BOOL_FALSE', true)).toBe(false);
    expect(envManager.getBoolean('BOOL_INVALID', true)).toBe(true);
  });

  test('APIキーが正しく取得できる', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    expect(envManager.getApiKey('OPENAI')).toBe('sk-test-key');
  });

  test('テスト用メソッドが正しく動作する', () => {
    envManager.setForTesting('TEST_VAR', 'test-value');
    expect(process.env.TEST_VAR).toBe('test-value');

    envManager.unsetForTesting('TEST_VAR');
    expect(process.env.TEST_VAR).toBeUndefined();
  });
}); 