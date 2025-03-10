import { IContentProcessor, ContentMetadata, ProcessedContent, ContentProcessorOptions } from '../interfaces/content-processor';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { AISummarizer } from '../ai/summarizer';
import logger from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/error-handler';

/**
 * HTMLコンテンツを処理するプロセッサークラス
 */
export class HtmlProcessor implements IContentProcessor {
  private turndownService: TurndownService;
  
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // 特定の要素を無視するように設定
    this.turndownService.remove(['script', 'style', 'nav', 'footer', 'iframe']);
  }
  
  /**
   * HTMLコンテンツを処理する
   */
  async process(content: string, sourceUrl: string, options: ContentProcessorOptions = {}): Promise<ProcessedContent> {
    try {
      const result: ProcessedContent = {
        content,
        metadata: {
          source: sourceUrl,
          contentType: 'text/html'
        }
      };
      
      // メタデータの抽出（オプション）
      if (options.extractMetadata !== false) {
        try {
          result.metadata = await this.extractMetadata(content, sourceUrl);
        } catch (error) {
          logger.error('メタデータ抽出中にエラーが発生しました', {
            error,
            sourceUrl,
            contentLength: content.length
          });
          // メタデータ抽出エラーは致命的ではないので、基本的なメタデータで続行
        }
      }
      
      // コンテンツのクリーニング（オプション）
      if (options.cleanContent !== false) {
        try {
          result.cleanedContent = await this.cleanContent(content);
        } catch (error) {
          logger.error('コンテンツクリーニング中にエラーが発生しました', {
            error,
            sourceUrl,
            contentLength: content.length
          });
          // クリーニングエラーの場合は、元のコンテンツを使用
          result.cleanedContent = content;
        }
      }
      
      // 要約の生成（オプション）
      if (options.generateSummary) {
        try {
          const contentToSummarize = result.cleanedContent || content;
          result.summary = await this.summarize(contentToSummarize, options.maxSummaryLength);
        } catch (error) {
          logger.error('要約生成中にエラーが発生しました', {
            error,
            sourceUrl,
            contentLength: content.length
          });
          // 要約生成エラーは致命的ではないので、要約なしで続行
        }
      }
      
      return result;
    } catch (error) {
      throw new AppError(
        `HTMLコンテンツの処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        ErrorCode.CONTENT_EXTRACTION_ERROR,
        { error, sourceUrl, contentLength: content.length }
      );
    }
  }
  
  /**
   * HTMLからメタデータを抽出する
   */
  async extractMetadata(content: string, sourceUrl: string): Promise<ContentMetadata> {
    const metadata: ContentMetadata = {
      source: sourceUrl,
      contentType: 'text/html'
    };
    
    try {
      const dom = new JSDOM(content);
      const document = dom.window.document;
      
      try {
        // タイトルの抽出
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent) {
          metadata.title = titleElement.textContent.trim();
        }
        
        // メタタグからの情報抽出
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(meta => {
          try {
            const name = meta.getAttribute('name')?.toLowerCase();
            const property = meta.getAttribute('property')?.toLowerCase();
            const content = meta.getAttribute('content');
            
            if (content) {
              // 著者情報
              if (name === 'author' || property === 'og:author') {
                metadata.author = content;
              }
              
              // 言語
              if (name === 'language' || property === 'og:locale') {
                metadata.language = content;
              }
              
              // 公開日
              if (name === 'publication-date' || name === 'date' || property === 'article:published_time') {
                metadata.publishedDate = content;
              }
              
              // 最終更新日
              if (name === 'last-modified' || property === 'article:modified_time') {
                metadata.lastModified = content;
              }
            }
          } catch (metaError) {
            logger.debug('メタタグの処理中にエラーが発生しました', {
              metaError,
              tagName: meta.tagName,
              sourceUrl
            });
            // 個別のメタタグのエラーは無視して続行
          }
        });
        
        // 言語属性からの言語情報
        if (!metadata.language) {
          const htmlElement = document.querySelector('html');
          if (htmlElement) {
            const lang = htmlElement.getAttribute('lang');
            if (lang) {
              metadata.language = lang;
            }
          }
        }
      } catch (domError) {
        logger.error('DOMクエリ実行中にエラーが発生しました', {
          error: domError,
          sourceUrl
        });
        // DOM操作エラーの場合は、基本的なメタデータのみを返す
      }
    } catch (error) {
      logger.error('HTMLパース中にエラーが発生しました', {
        error,
        sourceUrl,
        contentLength: content.length
      });
      // パースエラーの場合は、基本的なメタデータのみを返す
    }
    
    return metadata;
  }
  
  /**
   * HTMLコンテンツをクリーニングする
   * 不要な要素を削除し、Markdownに変換
   */
  async cleanContent(content: string): Promise<string> {
    try {
      const dom = new JSDOM(content);
      const document = dom.window.document;
      
      // 不要な要素を削除
      const elementsToRemove = [
        'script', 'style', 'iframe', 'form', 'button', 'input',
        'aside', 'nav', 'footer', 'header', 'banner', 'advertisement'
      ];
      
      elementsToRemove.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
      
      // コメントノードを削除
      const removeComments = (node: Node) => {
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(child => {
          if (child.nodeType === 8) { // 8 = COMMENT_NODE
            child.remove();
          } else if (child.hasChildNodes()) {
            removeComments(child);
          }
        });
      };
      
      removeComments(document.body);
      
      // 主要なコンテンツ部分を特定（articleやmainを優先）
      let mainContent = document.querySelector('article, main, #content, .content');
      if (!mainContent) {
        mainContent = document.body;
      }
      
      // HTMLをMarkdownに変換
      const markdown = this.turndownService.turndown(mainContent.innerHTML);
      
      // 余分な空白行の削除と正規化
      const cleanedMarkdown = markdown
        .replace(/\n{3,}/g, '\n\n') // 3行以上の空行を2行に
        .replace(/^\s+|\s+$/g, ''); // 前後の空白を削除
        
      return cleanedMarkdown;
    } catch (error) {
      console.error('HTMLクリーニング中にエラーが発生しました:', error);
      return content; // エラー時は元のコンテンツを返す
    }
  }
  
  /**
   * コンテンツの要約を生成する
   * AI機能が有効な場合はAIモデルを使用、そうでない場合は単純な抽出を行う
   */
  async summarize(content: string, maxLength: number = 500): Promise<string> {
    // 環境変数SKIP_AI_SUMMARIZATION=trueの場合や、テスト環境ではAI要約をスキップ
    const skipAI = process.env.SKIP_AI_SUMMARIZATION === 'true' || process.env.NODE_ENV === 'test';
    
    if (!skipAI) {
      try {
        // AIを使った要約を試みる
        const summarizer = new AISummarizer();
        return await summarizer.summarize(content, {
          maxSummaryLength: maxLength,
          detailLevel: 'brief'
        });
      } catch (error) {
        console.warn('AI要約に失敗しました。フォールバック要約を使用します:', error);
      }
    }
    
    // AI要約に失敗した場合または環境変数でスキップ指定されている場合のフォールバック
    if (content.length <= maxLength) {
      return content;
    }
    
    // 段落単位で区切り、最大長まで抽出
    const paragraphs = content.split(/\n\n+/);
    let summary = '';
    
    for (const paragraph of paragraphs) {
      if ((summary + paragraph).length > maxLength) {
        break;
      }
      summary += paragraph + '\n\n';
    }
    
    return summary.trim() + (summary.length < content.length ? '...' : '');
  }
} 