import { ProcessedContent } from '../interfaces/content-processor';
import { SearchResult } from '../../search/interfaces/search-provider';

export interface IntegratedContent {
  title: string;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    relevance?: number;
  }>;
  contentSections: Array<{
    title: string;
    content: string;
    source: string;
  }>;
  mergedContent: string;
}

export interface IntegrationOptions {
  removeDuplicates?: boolean;
  scoreThreshold?: number;
  maxContentLength?: number;
  includeSourceRanking?: boolean;
  formatOutput?: 'markdown' | 'text' | 'html';
  chunkSize?: number;
  overlapSize?: number;
}

/**
 * 複数のコンテンツソースから情報を統合するクラス
 */
export class ContentIntegrator {
  /**
   * 検索結果と処理済みコンテンツを統合する
   * 
   * @param searchResults 検索結果の配列
   * @param processedContents 処理済みコンテンツの配列
   * @param query 検索クエリ（タイトル生成などに使用）
   * @param options 統合オプション
   * @returns 統合されたコンテンツ
   */
  async integrate(
    searchResults: SearchResult[],
    processedContents: ProcessedContent[],
    query: string,
    options: IntegrationOptions = {}
  ): Promise<IntegratedContent> {
    // デフォルトオプション
    const defaultOptions: IntegrationOptions = {
      removeDuplicates: true,
      scoreThreshold: 0.3,
      maxContentLength: 5000,
      includeSourceRanking: true,
      formatOutput: 'markdown',
      chunkSize: 1000,
      overlapSize: 200
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // 検索結果とコンテンツをURLで紐づける
    const contentMap = new Map<string, ProcessedContent>();
    processedContents.forEach(content => {
      contentMap.set(content.metadata.source, content);
    });
    
    // ソース情報を生成
    const sources = searchResults.map(result => ({
      title: result.title,
      url: result.url,
      relevance: 1.0 // 将来的には実際の関連性スコアを使用
    }));
    
    // 重複除去（オプション）
    let uniqueResults = searchResults;
    if (finalOptions.removeDuplicates) {
      const urlSet = new Set<string>();
      uniqueResults = searchResults.filter(result => {
        // すでに同じURLが存在する場合はスキップ
        if (urlSet.has(result.url)) {
          return false;
        }
        urlSet.add(result.url);
        return true;
      });
    }
    
    // スコアによるフィルタリング（オプション）
    if (finalOptions.scoreThreshold !== undefined && finalOptions.scoreThreshold > 0) {
      uniqueResults = uniqueResults.filter(result => {
        // 将来的には実際の関連性スコアとスコアしきい値を比較
        return true;
      });
    }
    
    // コンテンツセクションを生成
    const contentSections = uniqueResults
      .filter(result => contentMap.has(result.url))
      .map(result => {
        const content = contentMap.get(result.url);
        if (!content) return null;
        
        return {
          title: result.title,
          content: content.cleanedContent || content.content,
          source: result.url
        };
      })
      .filter(section => section !== null) as Array<{
        title: string;
        content: string;
        source: string;
      }>;
    
    // チャンキングを適用（オプション）
    let processedSections = contentSections;
    if (finalOptions.chunkSize && finalOptions.chunkSize > 0) {
      processedSections = this.applyChunking(contentSections, finalOptions.chunkSize, finalOptions.overlapSize || 0);
    }
    
    // コンテンツの重複を検出して統合（オプション）
    if (finalOptions.removeDuplicates) {
      processedSections = this.detectAndMergeDuplicates(processedSections);
    }
    
    // 統合コンテンツを生成
    const mergedContent = this.mergeContents(processedSections, finalOptions);
    
    // クエリを元にタイトルを生成
    const title = this.generateTitle(query, processedSections);
    
    // 要約を生成
    const summary = this.generateSummary(processedSections, query);
    
    return {
      title,
      summary,
      sources,
      contentSections: processedSections,
      mergedContent
    };
  }
  
  /**
   * 複数のコンテンツを1つに統合する
   */
  private mergeContents(
    contentSections: Array<{ title: string; content: string; source: string }>,
    options: IntegrationOptions
  ): string {
    let mergedContent = '';
    
    // 出力フォーマットに応じた処理
    const format = options.formatOutput || 'markdown';
    
    if (format === 'markdown') {
      mergedContent = contentSections.map(section => {
        return `## ${section.title}\n\n${section.content}\n\n*Source: ${section.source}*\n\n`;
      }).join('---\n\n');
    } else if (format === 'text') {
      mergedContent = contentSections.map(section => {
        return `${section.title}\n\n${section.content}\n\nSource: ${section.source}\n\n`;
      }).join('------------------------\n\n');
    } else if (format === 'html') {
      mergedContent = `<div class="integrated-content">
        ${contentSections.map(section => `
          <section>
            <h2>${section.title}</h2>
            <div class="content">${section.content}</div>
            <div class="source">Source: <a href="${section.source}">${section.source}</a></div>
          </section>
        `).join('<hr />')}
      </div>`;
    }
    
    // 最大コンテンツ長の制限（オプション）
    if (options.maxContentLength && mergedContent.length > options.maxContentLength) {
      mergedContent = mergedContent.substring(0, options.maxContentLength) + '...';
    }
    
    return mergedContent;
  }
  
  /**
   * クエリと結果からタイトルを生成
   * 注: 実際の実装ではAIを使ってクエリと結果から適切なタイトルを生成することが想定されます
   */
  private generateTitle(
    query: string,
    contentSections: Array<{ title: string; content: string; source: string }>
  ): string {
    // シンプルな実装: クエリをそのままタイトルとして使用
    // 実際の実装ではAIを使ってより適切なタイトルを生成することを想定
    return `Information about: ${query}`;
  }
  
  /**
   * コンテンツの要約を生成
   * 注: 実際の実装ではAIを使ってコンテンツの要約を生成することが想定されます
   */
  private generateSummary(
    contentSections: Array<{ title: string; content: string; source: string }>,
    query: string
  ): string {
    // シンプルな実装: 各セクションの最初の数文字を連結
    // 実際の実装ではAIを使ってより適切な要約を生成することを想定
    const maxSummaryLength = 200;
    
    if (contentSections.length === 0) {
      return `No information found for query: ${query}`;
    }
    
    const firstContent = contentSections[0].content;
    if (firstContent.length <= maxSummaryLength) {
      return firstContent;
    }
    
    // 最初の段落や文章を抽出する簡易的な処理
    const firstParagraph = firstContent.split('\n\n')[0];
    if (firstParagraph.length <= maxSummaryLength) {
      return firstParagraph;
    }
    
    return firstParagraph.substring(0, maxSummaryLength) + '...';
  }

  /**
   * コンテンツをチャンクに分割する
   * 長い文章を扱いやすい小さなチャンクに分割する
   */
  private applyChunking(
    sections: Array<{ title: string; content: string; source: string }>,
    chunkSize: number,
    overlapSize: number
  ): Array<{ title: string; content: string; source: string }> {
    // チャンキングが必要ない場合はそのまま返す
    if (chunkSize <= 0) {
      return sections;
    }

    const chunkedSections: Array<{ title: string; content: string; source: string }> = [];

    for (const section of sections) {
      // コンテンツが短い場合はチャンキングしない
      if (section.content.length <= chunkSize) {
        chunkedSections.push(section);
        continue;
      }

      // 段落単位でのチャンキングを試みる
      const paragraphs = section.content.split('\n\n');
      let currentChunk = '';
      let chunkIndex = 1;

      for (const paragraph of paragraphs) {
        // 追加すると長すぎる場合は、新しいチャンクを開始
        if (currentChunk.length + paragraph.length + 2 > chunkSize && currentChunk.length > 0) {
          chunkedSections.push({
            title: `${section.title} (Part ${chunkIndex})`,
            content: currentChunk,
            source: section.source
          });
          
          // 重複部分を含めて新しいチャンクを開始
          const overlapContent = currentChunk.length > overlapSize ? 
            currentChunk.substring(currentChunk.length - overlapSize) : currentChunk;
          currentChunk = overlapContent + '\n\n' + paragraph;
          chunkIndex++;
        } else {
          // 現在のチャンクに段落を追加
          if (currentChunk.length > 0) {
            currentChunk += '\n\n';
          }
          currentChunk += paragraph;
        }
      }

      // 最後のチャンクを追加
      if (currentChunk.length > 0) {
        chunkedSections.push({
          title: chunkIndex > 1 ? `${section.title} (Part ${chunkIndex})` : section.title,
          content: currentChunk,
          source: section.source
        });
      }
    }

    return chunkedSections;
  }

  /**
   * コンテンツの重複を検出して統合する
   */
  private detectAndMergeDuplicates(
    sections: Array<{ title: string; content: string; source: string }>
  ): Array<{ title: string; content: string; source: string }> {
    // セクションが1つ以下の場合は重複除去の必要なし
    if (sections.length <= 1) {
      return sections;
    }

    const uniqueSections: Array<{ title: string; content: string; source: string }> = [];
    const contentSet = new Set<string>();

    // シンプルな重複検出 - コンテンツの類似性で判断
    // 将来的には、より洗練された類似性検出アルゴリズムを実装可能
    for (const section of sections) {
      // コンテンツの簡易ハッシュとして最初の100文字を使用
      const contentSignature = section.content.substring(0, 100);
      
      if (!contentSet.has(contentSignature)) {
        contentSet.add(contentSignature);
        uniqueSections.push(section);
      }
    }

    return uniqueSections;
  }
} 