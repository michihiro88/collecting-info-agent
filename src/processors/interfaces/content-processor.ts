/**
 * コンテンツプロセッサーインターフェース
 * ウェブページやPDFなどから抽出したコンテンツを処理するためのインターフェース
 */

export interface ContentMetadata {
  title?: string;
  author?: string;
  publishedDate?: string;
  lastModified?: string;
  language?: string;
  source: string;
  contentType: string;
}

export interface ProcessedContent {
  content: string;
  metadata: ContentMetadata;
  cleanedContent?: string;
  summary?: string;
}

export interface ContentProcessorOptions {
  extractMetadata?: boolean;
  cleanContent?: boolean;
  generateSummary?: boolean;
  maxSummaryLength?: number;
}

export interface IContentProcessor {
  /**
   * コンテンツを処理する
   * @param content 処理対象のコンテンツ（HTML、プレーンテキスト、PDFテキストなど）
   * @param sourceUrl コンテンツのソースURL
   * @param options 処理オプション
   */
  process(content: string, sourceUrl: string, options?: ContentProcessorOptions): Promise<ProcessedContent>;
  
  /**
   * メタデータを抽出する
   * @param content 処理対象のコンテンツ
   * @param sourceUrl コンテンツのソースURL
   */
  extractMetadata(content: string, sourceUrl: string): Promise<ContentMetadata>;
  
  /**
   * コンテンツをクリーニングする（不要なHTML要素の除去、テキスト正規化など）
   * @param content 処理対象のコンテンツ
   */
  cleanContent(content: string): Promise<string>;
  
  /**
   * コンテンツの要約を生成する
   * @param content 処理対象のコンテンツ
   * @param maxLength 要約の最大長
   */
  summarize(content: string, maxLength?: number): Promise<string>;
} 