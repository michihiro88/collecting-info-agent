// test/unit/search/search-service.test.ts
process.env.NODE_ENV = 'test';

import { SearchService } from '../../../src/search/search-service';
import { ISearchProvider, SearchOptions, SearchResult } from '../../../src/search/interfaces/search-provider';
import { EnvManager } from '../../../src/config/env-manager';

// EnvManagerのモック
jest.mock('../../../src/config/env-manager', () => {
  const mockInstance = {
    get: jest.fn((key: string) => {
      if (key === 'GOOGLE_SEARCH_API_KEY') return 'mock-google-api-key';
      if (key === 'GOOGLE_SEARCH_ENGINE_ID') return 'mock-search-engine-id';
      // Bing検索は廃止されたためキーを返さない
      return null;
    })
  };
  
  return {
    EnvManager: {
      getInstance: jest.fn(() => mockInstance)
    }
  };
});

// SearchService内で使用される実際のプロバイダークラスのモック
jest.mock('../../../src/search/providers/google-search', () => {
  // モックプロバイダークラスをここで直接定義
  return {
    GoogleSearchProvider: jest.fn().mockImplementation(() => {
      return {
        getName: jest.fn().mockReturnValue('google'),
        search: jest.fn().mockResolvedValue([
          {
            title: 'Google Result 1',
            url: 'https://example.com/google1',
            snippet: 'This is a mock Google search result',
            source: 'google',
            relevanceScore: 0.9
          },
          {
            title: 'Google Result 2',
            url: 'https://example.com/google2',
            snippet: 'Another mock Google search result',
            source: 'google',
            relevanceScore: 0.8
          }
        ])
      };
    })
  };
});

// キャッシュのメソッドをモック
jest.mock('../../../src/search/cache/search-cache', () => {
  return {
    SearchCache: jest.fn().mockImplementation(() => {
      return {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        clearExpiredCache: jest.fn()
      };
    })
  };
});

// レート制限のメソッドをモック
jest.mock('../../../src/search/rate-limiter', () => {
  return {
    RateLimiter: jest.fn().mockImplementation(() => {
      return {
        acquirePermission: jest.fn().mockResolvedValue(undefined),
        getRemainingRequests: jest.fn().mockReturnValue(100)
      };
    })
  };
});

describe('SearchService', () => {
  let searchService: SearchService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService();
  });
  
  test('should register available providers', () => {
    const providers = searchService.getAvailableProviders();
    expect(providers).toContain('google');
    // Bing検索は廃止されたため含まれていないことを確認
    expect(providers).not.toContain('bing');
  });
  
  test('should search with specified provider', async () => {
    const results = await searchService.search('test query', 'google');
    
    expect(results).toHaveLength(2);
    expect(results[0].source).toBe('google');
    expect(results[0].title).toBe('Google Result 1');
  });
  
  test('should search with all providers when no provider specified', async () => {
    const results = await searchService.search('test query');
    
    expect(results.length).toBeGreaterThan(0);
    // Google検索の結果のみ含まれていることを確認
    const googleResults = results.filter(r => r.source === 'google');
    
    expect(googleResults.length).toBeGreaterThan(0);
    // Bing検索の結果は含まれていないことを確認
    expect(results.filter(r => r.source === 'Bing').length).toBe(0);
  });
  
  test('should return rate limit status', () => {
    const status = searchService.getRateLimitStatus();
    
    expect(status).toHaveProperty('google');
    // Bing検索は廃止されたためステータスに含まれていないことを確認
    expect(status).not.toHaveProperty('bing');
    expect(status.google).toBe(100);
  });
  
  test('should handle search options', async () => {
    const options: SearchOptions = {
      maxResults: 5,
      safeSearch: true,
      language: 'en'
    };
    
    const results = await searchService.search('test query', 'google', options);
    expect(results.length).toBeGreaterThan(0);
  });
}); 