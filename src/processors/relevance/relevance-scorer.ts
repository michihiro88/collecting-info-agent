import { SearchResult } from '../../search/interfaces/search-provider';
import { ProcessedContent } from '../interfaces/content-processor';
import { getModelSelector } from '../../models/selector';
import logger from '../../utils/logger';

export interface ScoringOptions {
  /**
   * スコアリング方法
   * - 'keyword': キーワードベースの一致
   * - 'semantic': 意味的類似性（AIモデルを使用）
   * - 'hybrid': キーワードと意味的類似性の組み合わせ
   */
  method?: 'keyword' | 'semantic' | 'hybrid';
  
  /**
   * 正規化スコアの最小しきい値（0-1）
   */
  minThreshold?: number;
  
  /**
   * 意味的スコアリングに使用するAIモデル名
   */
  modelName?: string;
  
  /**
   * スコアリングのキャッシュを有効にするかどうか
   */
  enableCache?: boolean;
  
  /**
   * ハイブリッドスコアリングでのキーワードの重み（0-1）
   */
  keywordWeight?: number;
}

/**
 * 検索結果と処理済みコンテンツの関連性をスコアリングするクラス
 */
export class RelevanceScorer {
  private scoreCache: Map<string, number> = new Map();
  
  /**
   * 検索結果と元のクエリに基づいて関連性スコアを計算する
   * 
   * @param searchResults 検索結果
   * @param processedContents 処理済みコンテンツ
   * @param query 元のクエリ
   * @param options スコアリングオプション
   * @returns スコア付けされた検索結果
   */
  public async scoreResults(
    searchResults: SearchResult[],
    processedContents: ProcessedContent[],
    query: string,
    options: ScoringOptions = {}
  ): Promise<SearchResult[]> {
    // デフォルトオプション
    const defaultOptions: ScoringOptions = {
      method: 'hybrid',
      minThreshold: 0.3,
      enableCache: true,
      keywordWeight: 0.4
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // コンテンツマップを作成（URL→処理済みコンテンツ）
    const contentMap = new Map<string, ProcessedContent>();
    processedContents.forEach(content => {
      contentMap.set(content.metadata.source, content);
    });
    
    // スコア計算とフィルタリング
    const scoredResults = await Promise.all(
      searchResults.map(async result => {
        const content = contentMap.get(result.url);
        if (!content) return { ...result, relevanceScore: 0 };
        
        // キャッシュキー
        const cacheKey = `${query}|${result.url}|${finalOptions.method}`;
        
        // キャッシュから取得（有効の場合）
        if (finalOptions.enableCache && this.scoreCache.has(cacheKey)) {
          const cachedScore = this.scoreCache.get(cacheKey) || 0;
          return { ...result, relevanceScore: cachedScore };
        }
        
        // スコアを計算
        let score = 0;
        switch (finalOptions.method) {
          case 'keyword':
            score = this.calculateKeywordScore(content, query);
            break;
          case 'semantic':
            score = await this.calculateSemanticScore(content, query, finalOptions.modelName);
            break;
          case 'hybrid':
          default:
            const keywordScore = this.calculateKeywordScore(content, query);
            const semanticScore = await this.calculateSemanticScore(content, query, finalOptions.modelName);
            
            // 重み付き平均
            score = (keywordScore * (finalOptions.keywordWeight || 0.4)) + 
                   (semanticScore * (1 - (finalOptions.keywordWeight || 0.4)));
            break;
        }
        
        // スコアをキャッシュ（有効の場合）
        if (finalOptions.enableCache) {
          this.scoreCache.set(cacheKey, score);
        }
        
        return { ...result, relevanceScore: score };
      })
    );
    
    // スコアでソート
    return scoredResults
      .filter(result => result.relevanceScore !== undefined && result.relevanceScore >= (finalOptions.minThreshold || 0))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }
  
  /**
   * キーワードベースのスコアを計算
   * シンプルなTF-IDFアプローチを使用
   */
  private calculateKeywordScore(content: ProcessedContent, query: string): number {
    try {
      const textToScore = content.cleanedContent || content.content;
      
      // クエリをキーワードに分割
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .map(kw => kw.replace(/[^\w\s]/g, ''))
        .filter(kw => kw.length > 2); // 短すぎる単語を除外
      
      if (keywords.length === 0) return 0.5; // 有効なキーワードがない場合
      
      // 各キーワードの出現回数をカウント
      const contentLower = textToScore.toLowerCase();
      let matchCount = 0;
      let totalWeight = 0;
      
      keywords.forEach(keyword => {
        // 単純な単語頻度
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = contentLower.match(regex);
        const count = matches ? matches.length : 0;
        
        // 単語の長さに比例した重み
        const weight = Math.min(1, keyword.length / 10);
        matchCount += count * weight;
        totalWeight += weight;
      });
      
      // テキストの長さで正規化
      const normalizedScore = Math.min(1, matchCount / Math.sqrt(textToScore.length / 100));
      
      return normalizedScore;
    } catch (error) {
      logger.error('キーワードスコア計算中にエラーが発生しました', { error });
      return 0.5; // エラー時はデフォルトスコア
    }
  }
  
  /**
   * 意味的類似性スコアを計算
   * AIモデルを使用してクエリとコンテンツの意味的類似性を評価
   */
  private async calculateSemanticScore(
    content: ProcessedContent, 
    query: string,
    modelName?: string
  ): Promise<number> {
    try {
      // テスト/開発環境ではランダムスコアを返す
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        return 0.5 + (Math.random() * 0.5); // 0.5-1.0のランダムスコア
      }
      
      // 実際の実装ではAIモデルを使用
      const modelSelector = getModelSelector();
      const model = modelName ? modelSelector.getModel(modelName) : modelSelector.getDefaultModel();
      
      // スコアリングのためのプロンプトを作成
      const prompt = this.createScoringPrompt(content, query);
      
      // AIモデルからのレスポンスを取得
      const response = await model.generateText(prompt, { temperature: 0.1, maxTokens: 50 });
      
      // レスポンスからスコアを抽出（0-1の値を想定）
      // レスポンスがstring型である場合の処理（モデルの戻り値タイプに応じて調整）
      let responseText = '';
      if (typeof response === 'string') {
        responseText = response;
      } else if (response && typeof response === 'object' && 'text' in response) {
        // オブジェクトでtextプロパティがある場合
        responseText = String(response.text);
      } else {
        // その他の場合は文字列化を試みる
        responseText = String(response);
      }
      
      const scoreMatch = responseText.match(/([0-9](\.[0-9]+)?)/);
      if (scoreMatch && scoreMatch[0]) {
        const score = parseFloat(scoreMatch[0]);
        return Math.min(1, Math.max(0, score)); // 0-1の範囲に制限
      }
      
      return 0.7; // パース失敗時のデフォルトスコア
    } catch (error) {
      logger.error('意味的スコア計算中にエラーが発生しました', { error });
      return 0.5; // エラー時はデフォルトスコア
    }
  }
  
  /**
   * スコアリングのためのプロンプトを作成
   */
  private createScoringPrompt(content: ProcessedContent, query: string): string {
    const textToScore = content.cleanedContent || content.content;
    const truncatedContent = textToScore.length > 500 
      ? textToScore.substring(0, 500) + '...' 
      : textToScore;
    
    return `
検索クエリと文書内容の関連性を評価してください。0から1までの数値スコアを返してください。
1が最も関連性が高く、0が関連性がないことを意味します。

検索クエリ: ${query}

文書内容:
${truncatedContent}

関連性スコア (0から1の数値のみ):
`;
  }
  
  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.scoreCache.clear();
  }
}

export default RelevanceScorer; 