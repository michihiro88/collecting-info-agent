import { ISearchProvider, SearchOptions, SearchResult } from './interfaces/search-provider';
import { GoogleSearchProvider } from './providers/google-search';
// Bing検索は廃止されたためインポートを削除
import { SearchCache } from './cache/search-cache';
import { RateLimiter } from './rate-limiter';
import { EnvManager } from '../config/env-manager';
import axios from 'axios';
import logger from '../utils/logger';

export class SearchService {
  private providers: Map<string, ISearchProvider> = new Map();
  private cache: SearchCache;
  private rateLimiter: RateLimiter;
  private envManager: EnvManager;
  
  constructor() {
    this.envManager = EnvManager.getInstance();
    this.cache = new SearchCache();
    this.rateLimiter = new RateLimiter();
    this.registerProviders();
  }
  
  private registerProviders(): void {
    try {
      // Google検索プロバイダーを登録
      if (this.envManager.get('GOOGLE_SEARCH_API_KEY')) {
        const googleProvider = new GoogleSearchProvider();
        this.providers.set('google', googleProvider);
      }
      
      // Bing検索は廃止されたため登録コードを削除
      
      // 他の検索プロバイダーも追加予定
    } catch (error: any) {
      console.error('Error registering search providers:', error);
    }
  }
  
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async search(query: string, providerName?: string, options?: SearchOptions): Promise<SearchResult[]>;
  async search(
    query: string, 
    providerNameOrOptions?: string | SearchOptions, 
    optionsParam?: SearchOptions
  ): Promise<SearchResult[]> {
    // パラメータの解析
    let providerName: string | undefined;
    let options: SearchOptions | undefined;
    
    if (typeof providerNameOrOptions === 'string') {
      providerName = providerNameOrOptions;
      options = optionsParam;
    } else {
      options = providerNameOrOptions;
    }
    
    // キャッシュをチェック
    const cachedResults = await this.cache.get(query, providerName || 'all', options);
    if (cachedResults) {
      return cachedResults;
    }
    
    let results: SearchResult[] = [];
    
    if (providerName && this.providers.has(providerName)) {
      // レート制限をチェック
      await this.rateLimiter.acquirePermission(providerName);
      
      // 指定されたプロバイダーで検索
      const provider = this.providers.get(providerName)!;
      results = await provider.search(query, options);
    } else {
      // すべての利用可能なプロバイダーで検索
      const searchPromises = [];
      
      for (const [name, provider] of this.providers.entries()) {
        try {
          // レート制限をチェック
          await this.rateLimiter.acquirePermission(name);
          searchPromises.push(provider.search(query, options));
        } catch (error) {
          console.warn(`Skipping provider ${name} due to rate limiting: ${error}`);
        }
      }
      
      const allResults = await Promise.all(searchPromises);
      results = allResults.flat();
    }
    
    // 結果をキャッシュに保存
    if (results.length > 0) {
      await this.cache.set(query, providerName || 'all', results, options);
    }
    
    return results;
  }
  
  /**
   * URLからコンテンツを取得する
   * @param url 取得するコンテンツのURL
   * @param options 取得オプション
   * @returns 取得したコンテンツ（HTMLまたはテキスト）
   */
  async fetchContent(
    url: string, 
    options: { timeout?: number } = {}
  ): Promise<string | null> {
    try {
      const timeout = options.timeout || 10000; // デフォルト10秒タイムアウト
      
      logger.debug(`URLからコンテンツを取得します`, { 
        url, 
        timeout 
      });
      
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
        }
      });
      
      const contentLength = response.data ? String(response.data).length : 0;
      logger.debug(`コンテンツ取得完了`, { 
        url, 
        contentLength,
        status: response.status
      });
      
      return response.data;
    } catch (error) {
      // エラーの種類を識別
      let errorType = 'UNKNOWN_ERROR';
      let errorMessage = '不明なエラー';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorType = 'TIMEOUT_ERROR';
          errorMessage = `リクエストがタイムアウトしました (${options.timeout || 10000}ms)`;
        } else if (error.response) {
          // サーバーからのレスポンスがある場合 (4xx, 5xx)
          errorType = `HTTP_ERROR_${error.response.status}`;
          errorMessage = `HTTPエラー: ${error.response.status} ${error.response.statusText}`;
        } else if (error.request) {
          // リクエストは送信されたがレスポンスがない場合
          errorType = 'NETWORK_ERROR';
          errorMessage = 'ネットワークエラー: レスポンスが受信できませんでした';
        } else {
          // リクエストの設定中にエラーが発生した場合
          errorType = 'REQUEST_SETUP_ERROR';
          errorMessage = `リクエスト設定エラー: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      logger.error(`コンテンツの取得に失敗しました: ${url}`, { 
        error,
        errorType,
        errorMessage,
        url
      });
      
      return null;
    }
  }
  
  clearExpiredCache(): void {
    this.cache.clearExpiredCache();
  }
  
  // レート制限の状態を取得
  getRateLimitStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    
    for (const providerName of this.providers.keys()) {
      status[providerName] = this.rateLimiter.getRemainingRequests(providerName);
    }
    
    return status;
  }
} 