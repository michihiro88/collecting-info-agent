import { ISearchProvider, SearchOptions, SearchResult } from '../interfaces/search-provider';
import { EnvManager } from '../../config/env-manager';
import axios from 'axios';

export class GoogleSearchProvider implements ISearchProvider {
  private readonly apiKey: string;
  private readonly searchEngineId: string;
  
  constructor() {
    const envManager = EnvManager.getInstance();
    const apiKey = envManager.get('GOOGLE_SEARCH_API_KEY');
    const searchEngineId = envManager.get('GOOGLE_SEARCH_ENGINE_ID');
    
    if (!apiKey || !searchEngineId) {
      throw new Error('Google Search API key or Search Engine ID is not set');
    }
    
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }
  
  getName(): string {
    return 'Google';
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1';
      const response = await axios.get(url, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: query,
          num: options?.maxResults || 10,
          safe: options?.safeSearch ? 'active' : 'off',
          lr: options?.language ? `lang_${options.language}` : undefined
        }
      });
      
      return this.parseResults(response.data);
    } catch (error: any) {
      console.error('Google search error:', error);
      throw new Error(`Google search failed: ${error.message}`);
    }
  }
  
  private parseResults(data: any): SearchResult[] {
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }
    
    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'Google',
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time']
    }));
  }
} 