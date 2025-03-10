import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { SearchResult as AppSearchResult, SourceType } from '../utils/types';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';
import { getConfigLoader } from '../config/config-loader';
import { getModelSelector } from '../models/selector';
import { SearchService } from '../search/search-service';
import { SearchResult as ServiceSearchResult } from '../search/interfaces/search-provider';

/**
 * 検索エージェント
 * クエリに基づいてWeb検索を行い、関連情報を収集するエージェント
 */
export class SearchAgent {
  private config = getConfigLoader().getConfig();
  private modelSelector = getModelSelector();
  private searchService: SearchService;
  
  // 検索エージェントを初期化
  constructor() {
    this.searchService = new SearchService();
  }

  /**
   * 指定した検索クエリでWeb検索を実行
   * @param query 検索クエリ
   * @param providerName 検索プロバイダー名 (オプション)
   * @param maxResults 最大結果数 (デフォルト: config.search.maxResults)
   */
  public async search(
    query: string,
    providerName?: string,
    maxResults?: number
  ): Promise<AppSearchResult[]> {
    try {
      logger.info('Web検索を開始します', { query, providerName });
      
      // 最大結果数を設定
      const resultsLimit = maxResults || this.config.search.maxResults || 5;
      
      // 利用可能なプロバイダーを確認
      const availableProviders = this.searchService.getAvailableProviders();
      
      if (providerName && !availableProviders.includes(providerName)) {
        throw new AppError(
          `利用できない検索プロバイダーです: ${providerName}`,
          ErrorCode.INVALID_PARAMETER,
          { provider: providerName, availableProviders }
        );
      }
      
      // 実際の検索サービスを使用して検索を実行
      let serviceResults: ServiceSearchResult[];
      
      if (providerName) {
        serviceResults = await this.searchService.search(query, providerName, { limit: resultsLimit });
      } else {
        serviceResults = await this.searchService.search(query, { limit: resultsLimit });
      }
      
      // サービス結果をアプリケーション形式に変換
      const results = this.convertSearchResults(serviceResults, query);
      
      logger.info('検索が完了しました', { 
        query,
        provider: providerName || 'all',
        resultCount: results.length 
      });
      
      return results;
    } catch (error) {
      if (error instanceof AppError) {
        logger.error('検索中にエラーが発生しました', { error });
        throw error;
      }
      
      const appError = new AppError(
        '検索処理中にエラーが発生しました',
        ErrorCode.SEARCH_ERROR,
        { error, query }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }
  
  /**
   * 検索結果からURLのコンテンツを取得
   * @param url 取得するURL
   * @param options 取得オプション
   */
  public async fetchContent(
    url: string, 
    options: { timeout?: number } = {}
  ): Promise<string> {
    try {
      logger.info('コンテンツ取得を開始します', { url, timeout: options.timeout });
      
      if (!this.isValidUrl(url)) {
        throw new AppError(
          `無効なURL形式です: ${url}`,
          ErrorCode.INVALID_URL,
          { url }
        );
      }
      
      // SearchServiceのfetchContentを使用
      const content = await this.searchService.fetchContent(url, options);
      
      if (!content) {
        throw new AppError(
          `URL ${url} からコンテンツを取得できませんでした`,
          ErrorCode.NETWORK_ERROR,
          { url }
        );
      }
      
      logger.info('コンテンツ取得が完了しました', { 
        url,
        contentLength: content.length 
      });
      
      return content;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // エラーメッセージを取得
      const errorMessage = 
        error instanceof Error ? error.message : '不明なエラーが発生しました';
      
      const appError = new AppError(
        `URL ${url} からのコンテンツ取得中にエラーが発生しました: ${errorMessage}`,
        ErrorCode.NETWORK_ERROR,
        { error, url }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }
  
  /**
   * 検索結果の情報から関連するコンテキストを抽出
   * @param query 元の検索クエリ
   * @param searchResults 検索結果の配列
   * @param maxContextLength 最大コンテキスト長 (デフォルト: 2000)
   */
  public async extractRelevantContext(
    query: string,
    searchResults: AppSearchResult[],
    maxContextLength: number = 2000
  ): Promise<string> {
    try {
      logger.info('関連コンテキストの抽出を開始します', { 
        query, 
        resultCount: searchResults.length 
      });
      
      // 検索結果が空の場合
      if (searchResults.length === 0) {
        return '関連情報は見つかりませんでした。';
      }
      
      // 検索結果からスニペットを結合
      let context = '';
      let sources = '';
      
      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        const snippet = result.snippet || result.content.substring(0, 200) + '...';
        const resultText = `[${i+1}] ${snippet}\n\n`;
        
        // 最大長を超えないようにコンテキストを構築
        if ((context + resultText).length <= maxContextLength) {
          context += resultText;
          sources += `[${i+1}] ${result.title}: ${result.url}\n`;
        } else {
          break;
        }
      }
      
      // ソース情報を追加
      const finalContext = `${context}\n出典情報:\n${sources}`;
      
      logger.info('コンテキスト抽出が完了しました', { 
        contextLength: finalContext.length,
        sourcesCount: searchResults.length 
      });
      
      return finalContext;
    } catch (error) {
      const appError = new AppError(
        'コンテキスト抽出中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error, query, results: searchResults.length }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }
  
  /**
   * HTMLからテキストを抽出
   * @param document HTMLドキュメント
   */
  private extractTextFromHtml(document: Document): string {
    // 不要な要素を削除
    const elementsToRemove = [
      'script', 'style', 'noscript', 'iframe', 'nav', 'footer', 
      'header', 'aside', 'svg', 'form', 'button', 'img'
    ];
    
    elementsToRemove.forEach(tag => {
      const elements = document.getElementsByTagName(tag);
      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    });
    
    // 本文を取得
    const body = document.querySelector('body');
    if (!body) return '';
    
    // テキストコンテンツを取得して整形
    let text = body.textContent || '';
    
    // 余分な空白と改行を削除
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
  
  /**
   * 検索レート制限の状態を確認
   */
  public getRateLimitStatus(): Record<string, number> {
    return this.searchService.getRateLimitStatus();
  }
  
  /**
   * 期限切れの検索キャッシュをクリア
   */
  public clearExpiredCache(): void {
    this.searchService.clearExpiredCache();
  }
  
  /**
   * URLが有効な形式かを検証
   * @param url 検証するURL
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * SearchServiceの検索結果をアプリケーション形式に変換
   * @param serviceResults サービスの検索結果
   * @param query 検索クエリ
   */
  private convertSearchResults(
    serviceResults: ServiceSearchResult[],
    query: string
  ): AppSearchResult[] {
    return serviceResults.map(result => {
      return {
        title: result.title,
        url: result.url,
        content: result.snippet || "", // contentを代用
        snippet: result.snippet,
        source: {
          type: SourceType.WEB,
          url: result.url
        },
        metadata: {
          title: result.title,
          date: result.publishedDate,
          description: result.snippet
        },
        content2: {
          fullText: result.snippet || "",
          summary: result.snippet || ""
        },
        score: result.relevanceScore || 1.0,
        relevance: result.relevanceScore || 1.0,
        timestamp: new Date().toISOString()
      };
    });
  }
}

/**
 * 検索エージェントのシングルトンインスタンス
 */
let searchAgentInstance: SearchAgent | null = null;

/**
 * 検索エージェントのインスタンスを取得
 */
export function getSearchAgent(): SearchAgent {
  if (!searchAgentInstance) {
    searchAgentInstance = new SearchAgent();
  }
  return searchAgentInstance;
}

export default { SearchAgent, getSearchAgent }; 