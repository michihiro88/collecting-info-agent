import { IContentProcessor, ProcessedContent, ContentProcessorOptions } from './interfaces/content-processor';
import { HtmlProcessor } from './html/html-processor';
import { PdfProcessor } from './pdf/pdf-processor';
import { ContentIntegrator, IntegratedContent, IntegrationOptions } from './integration/content-integrator';
import { SearchResult } from '../search/interfaces/search-provider';
import * as path from 'path';

/**
 * コンテンツプロセッサーサービス
 * 適切なプロセッサーを選択して各種コンテンツを処理するサービスクラス
 */
export class ContentProcessorService {
  private processors: Map<string, IContentProcessor> = new Map();
  private integrator: ContentIntegrator;
  
  constructor() {
    this.registerProcessors();
    this.integrator = new ContentIntegrator();
  }
  
  /**
   * サポートするコンテンツプロセッサーを登録
   */
  private registerProcessors(): void {
    // HTMLプロセッサーを登録
    this.processors.set('text/html', new HtmlProcessor());
    this.processors.set('application/html', new HtmlProcessor());
    
    // PDFプロセッサーを登録
    this.processors.set('application/pdf', new PdfProcessor());
    
    // 将来的に他のプロセッサーも登録
  }
  
  /**
   * URLとコンテンツタイプからプロセッサーを自動選択
   */
  private selectProcessor(contentType: string, url: string): IContentProcessor | null {
    // コンテンツタイプが指定されている場合はそれを優先
    if (contentType && this.processors.has(contentType)) {
      return this.processors.get(contentType) || null;
    }
    
    // URLの拡張子からコンテンツタイプを推測
    const ext = path.extname(url).toLowerCase();
    
    if (ext === '.html' || ext === '.htm') {
      return this.processors.get('text/html') || null;
    } else if (ext === '.pdf') {
      return this.processors.get('application/pdf') || null;
    }
    
    // デフォルトはHTMLプロセッサー
    return this.processors.get('text/html') || null;
  }
  
  /**
   * コンテンツを処理する
   * 
   * @param content 処理対象のコンテンツ
   * @param sourceUrl コンテンツのソースURL
   * @param contentType コンテンツタイプ（省略可、URLから推測）
   * @param options 処理オプション
   */
  async processContent(
    content: string,
    sourceUrl: string,
    contentType?: string,
    options?: ContentProcessorOptions
  ): Promise<ProcessedContent> {
    // プロセッサーを選択
    const processor = this.selectProcessor(contentType || '', sourceUrl);
    
    if (!processor) {
      throw new Error(`サポートされていないコンテンツタイプです: ${contentType || '不明'}`);
    }
    
    // コンテンツ処理を実行
    return processor.process(content, sourceUrl, options);
  }
  
  /**
   * 複数のコンテンツを統合する
   * 
   * @param searchResults 検索結果
   * @param processedContents 処理済みコンテンツ
   * @param query 元の検索クエリ
   * @param options 統合オプション
   */
  async integrateContents(
    searchResults: SearchResult[],
    processedContents: ProcessedContent[],
    query: string,
    options?: IntegrationOptions
  ): Promise<IntegratedContent> {
    return this.integrator.integrate(searchResults, processedContents, query, options);
  }
  
  /**
   * 検索結果からコンテンツを処理および統合する便利なメソッド
   * 
   * @param searchResults 検索結果
   * @param contentMap 検索結果URLとコンテンツのマップ
   * @param query 検索クエリ
   * @param processorOptions プロセッサーオプション
   * @param integrationOptions 統合オプション
   */
  async processAndIntegrateSearchResults(
    searchResults: SearchResult[],
    contentMap: Map<string, string>,
    query: string,
    processorOptions?: ContentProcessorOptions,
    integrationOptions?: IntegrationOptions
  ): Promise<IntegratedContent> {
    // 各検索結果に対してコンテンツを処理
    const processPromises = searchResults
      .filter(result => contentMap.has(result.url))
      .map(async (result) => {
        const content = contentMap.get(result.url);
        if (!content) return null;
        
        try {
          // URLとソースからプロセッサーを自動選択
          return await this.processContent(content, result.url, undefined, processorOptions);
        } catch (error) {
          console.error(`Error processing content from ${result.url}:`, error);
          return null;
        }
      });
    
    // すべての処理を並列実行
    const processedResults = await Promise.all(processPromises);
    
    // nullの結果を除外
    const validProcessedContents = processedResults.filter(
      (content): content is ProcessedContent => content !== null
    );
    
    // 統合処理を実行
    return this.integrateContents(
      searchResults,
      validProcessedContents,
      query,
      integrationOptions
    );
  }
  
  /**
   * メタデータの抽出のみを行う
   * 
   * @param content コンテンツ
   * @param sourceUrl ソースURL
   * @param contentType コンテンツタイプ
   */
  async extractMetadataOnly(
    content: string,
    sourceUrl: string,
    contentType?: string
  ): Promise<ProcessedContent> {
    return this.processContent(content, sourceUrl, contentType, {
      extractMetadata: true,
      cleanContent: false,
      generateSummary: false
    });
  }
  
  /**
   * コンテンツのクリーニングのみを行う
   * 
   * @param content コンテンツ
   * @param sourceUrl ソースURL
   * @param contentType コンテンツタイプ
   */
  async cleanContentOnly(
    content: string,
    sourceUrl: string,
    contentType?: string
  ): Promise<string> {
    const result = await this.processContent(content, sourceUrl, contentType, {
      extractMetadata: false,
      cleanContent: true,
      generateSummary: false
    });
    
    return result.cleanedContent || content;
  }
  
  /**
   * 要約のみを生成する
   * 
   * @param content コンテンツ
   * @param sourceUrl ソースURL
   * @param contentType コンテンツタイプ
   * @param maxLength 最大長
   */
  async summarizeOnly(
    content: string,
    sourceUrl: string,
    contentType?: string,
    maxLength?: number
  ): Promise<string> {
    const result = await this.processContent(content, sourceUrl, contentType, {
      extractMetadata: false,
      cleanContent: true,
      generateSummary: true,
      maxSummaryLength: maxLength
    });
    
    return result.summary || '';
  }
} 