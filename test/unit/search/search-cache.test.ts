import { SearchCache } from '../../../src/search/cache/search-cache';
import fs from 'fs';
import path from 'path';

// fsモジュールのモック
jest.mock('fs');
jest.mock('path');

describe('SearchCache', () => {
  let cache: SearchCache;
  const mockCacheDir = '/mock/cache/dir';
  
  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    // パスモックの設定
    (path.join as jest.Mock).mockImplementation((...paths) => paths.join('/'));
    (path.dirname as jest.Mock).mockImplementation((filePath) => {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/');
    });
    
    // fsモックの設定
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    
    // 基本的に空の配列を返すが、テスト内で上書き可能
    (fs.readFileSync as jest.Mock).mockImplementation(() => '[]');
    
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
    
    // 正しいオブジェクト構造で初期化
    cache = new SearchCache({ cachePath: mockCacheDir });
  });
  
  test('get returns null if cache file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    const result = await cache.get('test query', 'google');
    
    expect(result).toBeNull();
  });
  
  test('get returns cached results if cache is valid', async () => {
    const mockResults = [
      { title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet', source: 'google', relevanceScore: 0.8 }
    ];
    
    // キャッシュデータの準備
    const cacheKey = 'test query:google:{}';
    const mockCacheData = [{
      results: mockResults,
      timestamp: Date.now(),
      query: 'test query',
      providerName: 'google'
    }];
    
    // モック関数を設定し直す
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockCacheData));
    
    // テスト実行前にキャッシュを再ロード
    (cache as any).loadCache();
    
    const result = await cache.get('test query', 'google');
    
    expect(result).toEqual(mockResults);
  });
  
  test('get returns null if cache is expired', async () => {
    const mockResults = [
      { title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet', source: 'google', relevanceScore: 0.8 }
    ];
    
    // 期限切れのキャッシュデータを準備
    const mockCacheData = [{
      results: mockResults,
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25時間前（有効期限24時間）
      query: 'test query',
      providerName: 'google'
    }];
    
    // モック関数を設定し直す
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockCacheData));
    
    // テスト実行前にキャッシュを再ロード
    (cache as any).loadCache();
    
    const result = await cache.get('test query', 'google');
    
    expect(result).toBeNull();
    // このテストでは unlinkSync は期待されない（期限切れのキャッシュはメモリから削除されるだけ）
  });
  
  test('set writes cache data to file', async () => {
    const mockResults = [
      { title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet', source: 'google', relevanceScore: 0.8 }
    ];
    
    await cache.set('test query', 'google', mockResults);
    
    // persistCache メソッドを明示的に呼び出す
    (cache as any).persistCache();
    
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenData = JSON.parse(writeCall[1]);
    
    expect(writtenData[0].query).toBe('test query');
    expect(writtenData[0].providerName).toBe('google');
    expect(writtenData[0].results).toEqual(mockResults);
  });
}); 