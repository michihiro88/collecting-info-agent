import { ISearchProvider, SearchOptions, SearchResult } from '../interfaces/search-provider';

/**
 * @deprecated Bing検索APIはマイクロソフト社により廃止されたため、このプロバイダーは使用できなくなりました。
 * 代替プロバイダーを検討中です。
 */
export class BingSearchProvider implements ISearchProvider {
  constructor() {
    throw new Error('Bing Search APIは廃止されたため、このプロバイダーは使用できなくなりました。');
  }
  
  getName(): string {
    return 'Bing (廃止)';
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    throw new Error('Bing Search APIは廃止されたため、このプロバイダーは使用できなくなりました。');
  }
} 