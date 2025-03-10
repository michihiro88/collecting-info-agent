// test/unit/processors/content-processor-service.test.ts
process.env.NODE_ENV = 'test';

import { ContentProcessorService } from '../../../src/processors/content-processor-service';
import { HtmlProcessor } from '../../../src/processors/html/html-processor';
import { PdfProcessor } from '../../../src/processors/pdf/pdf-processor';
import { ContentIntegrator } from '../../../src/processors/integration/content-integrator';
import { SearchResult } from '../../../src/search/interfaces/search-provider';
import { ProcessedContent } from '../../../src/processors/interfaces/content-processor';

// HTMLプロセッサーとPDFプロセッサーのモック
jest.mock('../../../src/processors/html/html-processor');
jest.mock('../../../src/processors/pdf/pdf-processor');
jest.mock('../../../src/processors/integration/content-integrator');

describe('ContentProcessorService', () => {
  let processorService: ContentProcessorService;
  let MockHtmlProcessor: jest.MockedClass<typeof HtmlProcessor>;
  let MockPdfProcessor: jest.MockedClass<typeof PdfProcessor>;
  let MockIntegrator: jest.MockedClass<typeof ContentIntegrator>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // モックのキャスト
    MockHtmlProcessor = HtmlProcessor as unknown as jest.MockedClass<typeof HtmlProcessor>;
    MockPdfProcessor = PdfProcessor as unknown as jest.MockedClass<typeof PdfProcessor>;
    MockIntegrator = ContentIntegrator as unknown as jest.MockedClass<typeof ContentIntegrator>;

    // HTMLプロセッサーのモック設定
    (MockHtmlProcessor.prototype.process as jest.Mock).mockImplementation(async (content, sourceUrl) => {
      return {
        content,
        metadata: {
          title: 'HTML Document',
          source: sourceUrl,
          contentType: 'text/html'
        },
        cleanedContent: 'Cleaned HTML content',
        summary: 'HTML summary'
      };
    });

    // PDFプロセッサーのモック設定
    (MockPdfProcessor.prototype.process as jest.Mock).mockImplementation(async (content, sourceUrl) => {
      return {
        content,
        metadata: {
          title: 'PDF Document',
          source: sourceUrl,
          contentType: 'application/pdf'
        },
        cleanedContent: 'Cleaned PDF content',
        summary: 'PDF summary'
      };
    });

    // インテグレーターのモック設定
    (MockIntegrator.prototype.integrate as jest.Mock).mockImplementation(async (searchResults, processedContents, query) => {
      return {
        title: `Information about: ${query}`,
        summary: 'Integrated summary',
        sources: searchResults.map((r: SearchResult) => ({ title: r.title, url: r.url })),
        contentSections: processedContents.map((c: ProcessedContent) => ({
          title: c.metadata.title || 'Untitled',
          content: c.cleanedContent || c.content,
          source: c.metadata.source
        })),
        mergedContent: 'Merged content'
      };
    });

    // サービスのインスタンス化
    processorService = new ContentProcessorService();
  });

  test('should select appropriate processor based on content type', async () => {
    // HTMLコンテンツ処理のテスト
    await processorService.processContent('<html><body>Test</body></html>', 'https://example.com/page.html', 'text/html');
    expect(MockHtmlProcessor.prototype.process).toHaveBeenCalled();
    expect(MockPdfProcessor.prototype.process).not.toHaveBeenCalled();

    // PDFコンテンツ処理のテスト
    jest.clearAllMocks();
    await processorService.processContent('%PDF-1.5 test', 'https://example.com/document.pdf', 'application/pdf');
    expect(MockHtmlProcessor.prototype.process).not.toHaveBeenCalled();
    expect(MockPdfProcessor.prototype.process).toHaveBeenCalled();
  });

  test('should select appropriate processor based on URL extension', async () => {
    // HTML拡張子のテスト
    await processorService.processContent('<html><body>Test</body></html>', 'https://example.com/page.html');
    expect(MockHtmlProcessor.prototype.process).toHaveBeenCalled();
    expect(MockPdfProcessor.prototype.process).not.toHaveBeenCalled();

    // PDF拡張子のテスト
    jest.clearAllMocks();
    await processorService.processContent('%PDF-1.5 test', 'https://example.com/document.pdf');
    expect(MockHtmlProcessor.prototype.process).not.toHaveBeenCalled();
    expect(MockPdfProcessor.prototype.process).toHaveBeenCalled();
  });

  test('should integrate contents from search results', async () => {
    // 検索結果とコンテンツのモック
    const mockSearchResults: SearchResult[] = [
      {
        title: 'Test Result 1',
        url: 'https://example.com/page1.html',
        snippet: 'This is test result 1',
        source: 'Google'
      },
      {
        title: 'Test Result 2',
        url: 'https://example.com/page2.pdf',
        snippet: 'This is test result 2',
        source: 'Google'
      }
    ];

    const contentMap = new Map<string, string>();
    contentMap.set('https://example.com/page1.html', '<html><body>Test HTML</body></html>');
    contentMap.set('https://example.com/page2.pdf', '%PDF-1.5 Test PDF');

    // 処理と統合の実行
    const result = await processorService.processAndIntegrateSearchResults(
      mockSearchResults,
      contentMap,
      'test query'
    );

    // 2つのコンテンツが処理されることを確認
    expect(MockHtmlProcessor.prototype.process).toHaveBeenCalledTimes(1);
    expect(MockPdfProcessor.prototype.process).toHaveBeenCalledTimes(1);
    
    // 統合が行われたことを確認
    expect(MockIntegrator.prototype.integrate).toHaveBeenCalledTimes(1);
    expect(result.title).toContain('test query');
    expect(result.sources).toHaveLength(2);
  });

  test('should handle partial content processing errors', async () => {
    // HTMLプロセッサーがエラーを投げるように設定
    (MockHtmlProcessor.prototype.process as jest.Mock).mockRejectedValueOnce(new Error('HTML processing error'));

    // 検索結果とコンテンツのモック
    const mockSearchResults: SearchResult[] = [
      {
        title: 'Test Result 1',
        url: 'https://example.com/page1.html',
        snippet: 'This is test result 1',
        source: 'Google'
      },
      {
        title: 'Test Result 2',
        url: 'https://example.com/page2.pdf',
        snippet: 'This is test result 2',
        source: 'Google'
      }
    ];

    const contentMap = new Map<string, string>();
    contentMap.set('https://example.com/page1.html', '<html><body>Test HTML</body></html>');
    contentMap.set('https://example.com/page2.pdf', '%PDF-1.5 Test PDF');

    // 処理と統合の実行（エラーがあっても続行する）
    const result = await processorService.processAndIntegrateSearchResults(
      mockSearchResults,
      contentMap,
      'test query'
    );

    // HTMLプロセッサーはエラーになるが、PDFプロセッサーは正常に処理されるはず
    expect(MockHtmlProcessor.prototype.process).toHaveBeenCalledTimes(1);
    expect(MockPdfProcessor.prototype.process).toHaveBeenCalledTimes(1);
    
    // 統合処理は1つのコンテンツのみで行われる
    expect(MockIntegrator.prototype.integrate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
}); 