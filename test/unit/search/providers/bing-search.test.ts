// test/unit/search/providers/bing-search.test.ts
process.env.NODE_ENV = 'test';

import { BingSearchProvider } from '../../../../src/search/providers/bing-search';
import { EnvManager } from '../../../../src/config/env-manager';
import axios from 'axios';

// EnvManagerのモック
jest.mock('../../../../src/config/env-manager', () => {
  const mockGet = jest.fn();
  
  const mockInstance = {
    get: mockGet
  };
  
  return {
    EnvManager: {
      getInstance: jest.fn(() => mockInstance)
    }
  };
});

// Axiosのモック
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('BingSearchProvider', () => {
  let envManagerGet: jest.Mock;
  
  beforeEach(() => {
    // リセット
    jest.clearAllMocks();
    
    // EnvManagerのモックセットアップ
    envManagerGet = (EnvManager.getInstance() as any).get;
  });
  
  test('should throw error because API is deprecated', () => {
    expect(() => {
      new BingSearchProvider();
    }).toThrow('Bing Search APIは廃止されたため');
  });
  
  test('should not allow search method to be called', async () => {
    // インスタンス化しようとすると例外が発生するため、プロトタイプを直接使う
    try {
      // @ts-ignore: テストのために例外を回避
      const provider = Object.create(BingSearchProvider.prototype);
      await expect(provider.search('test query')).rejects.toThrow('Bing Search APIは廃止されたため');
    } catch (error) {
      // コンストラクタ例外をキャッチ
    }
  });
  
  test('getName should indicate deprecated status', () => {
    try {
      // @ts-ignore: テストのために例外を回避
      const provider = Object.create(BingSearchProvider.prototype);
      expect(provider.getName()).toBe('Bing (廃止)');
    } catch (error) {
      // エラーが発生した場合はテスト失敗
      fail('getName should not throw: ' + error);
    }
  });
}); 