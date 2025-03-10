export interface ISearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getName(): string;
}

export interface SearchOptions {
  maxResults?: number;
  safeSearch?: boolean;
  language?: string;
  limit?: number; // 最大結果数（maxResultsの別名）
  // その他必要なオプション
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
  relevanceScore?: number; // 関連性スコア（0-1）
  // その他の検索結果情報
} 