import { HtmlProcessor } from '../../../../src/processors/html/html-processor';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

// テスト環境を設定
process.env.NODE_ENV = 'test';

jest.mock('jsdom', () => {
  return {
    JSDOM: jest.fn()
  };
});

jest.mock('turndown', () => {
  return jest.fn().mockImplementation(() => {
    return {
      remove: jest.fn(),
      turndown: jest.fn().mockImplementation((html) => {
        // 簡易的なHTMLからMarkdownへの変換をシミュレート
        return html
          .replace(/<h1>(.*?)<\/h1>/g, '# $1')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1')
          .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
          .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
          .replace(/<.*?>/g, '');
      })
    };
  });
});

describe('HtmlProcessor', () => {
  let processor: HtmlProcessor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    processor = new HtmlProcessor();
    
    // JSの戻り値をモック
    (JSDOM as unknown as jest.Mock).mockImplementation(html => {
      const mockDocument = {
        querySelector: jest.fn().mockImplementation(selector => {
          if (selector === 'title') {
            return { textContent: 'Test Page Title' };
          } else if (selector === 'html') {
            return { getAttribute: jest.fn().mockReturnValue('ja') };
          } else if (selector === 'article, main, #content, .content') {
            return {
              innerHTML: '<h1>Main Content</h1><p>This is the main content.</p>'
            };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockImplementation(selector => {
          if (selector === 'meta') {
            return [
              {
                getAttribute: jest.fn().mockImplementation(attr => {
                  if (attr === 'name') return 'author';
                  if (attr === 'content') return 'Test Author';
                  return null;
                })
              },
              {
                getAttribute: jest.fn().mockImplementation(attr => {
                  if (attr === 'property') return 'og:locale';
                  if (attr === 'content') return 'ja_JP';
                  return null;
                })
              },
              {
                getAttribute: jest.fn().mockImplementation(attr => {
                  if (attr === 'name') return 'date';
                  if (attr === 'content') return '2023-04-01';
                  return null;
                })
              }
            ];
          } else if (selector === 'script' || selector === 'style') {
            return [
              { remove: jest.fn() }
            ];
          }
          return [];
        }),
        body: {
          childNodes: [],
          hasChildNodes: () => false
        }
      };
      
      return {
        window: {
          document: mockDocument
        }
      };
    });
  });
  
  it('should initialize properly', () => {
    expect(processor).toBeDefined();
    expect(TurndownService).toHaveBeenCalled();
  });
  
  describe('process', () => {
    it('should process HTML content with all options', async () => {
      const html = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
      const url = 'https://example.com';
      
      const result = await processor.process(html, url, {
        extractMetadata: true,
        cleanContent: true,
        generateSummary: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBe(html);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('Test Page Title');
      expect(result.cleanedContent).toBeDefined();
      expect(result.summary).toBeDefined();
    });
    
    it('should process HTML content with minimal options', async () => {
      const html = '<html><body><p>Minimal Content</p></body></html>';
      const url = 'https://example.com/minimal';
      
      const result = await processor.process(html, url, {
        extractMetadata: false,
        cleanContent: false,
        generateSummary: false
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBe(html);
      expect(result.metadata.source).toBe(url);
      expect(result.cleanedContent).toBeUndefined();
      expect(result.summary).toBeUndefined();
    });
  });
  
  describe('extractMetadata', () => {
    it('should extract metadata from HTML', async () => {
      const html = '<html><head><title>Test Page</title><meta name="author" content="Test Author"></head></html>';
      const url = 'https://example.com/test';
      
      const metadata = await processor.extractMetadata(html, url);
      
      expect(metadata).toBeDefined();
      expect(metadata.title).toBe('Test Page Title');
      expect(metadata.author).toBe('Test Author');
      expect(metadata.language).toBe('ja_JP');
      expect(metadata.publishedDate).toBe('2023-04-01');
      expect(metadata.source).toBe(url);
      expect(metadata.contentType).toBe('text/html');
    });
    
    it('should handle errors during metadata extraction', async () => {
      (JSDOM as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('JSDOM error');
      });
      
      const html = '<invalid>html</>';
      const url = 'https://example.com/invalid';
      
      const metadata = await processor.extractMetadata(html, url);
      
      expect(metadata).toBeDefined();
      expect(metadata.source).toBe(url);
      expect(metadata.contentType).toBe('text/html');
      // エラー時にはタイトルなどが抽出されない
      expect(metadata.title).toBeUndefined();
    });
  });
  
  describe('cleanContent', () => {
    it('should clean HTML content and convert to markdown', async () => {
      const html = '<html><body><script>alert("bad");</script><div><h1>Title</h1><p>Content</p></div></body></html>';
      
      const cleaned = await processor.cleanContent(html);
      
      expect(cleaned).toBeDefined();
      expect(cleaned).toContain('# Main Content');
      expect(cleaned).toContain('This is the main content.');
      expect(cleaned).not.toContain('<script>');
    });
    
    it('should handle errors during content cleaning', async () => {
      (JSDOM as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('JSDOM error');
      });
      
      const html = '<invalid>html</>';
      
      const cleaned = await processor.cleanContent(html);
      
      // エラー時には元のコンテンツを返す
      expect(cleaned).toBe(html);
    });
  });
  
  describe('summarize', () => {
    beforeEach(() => {
      // AISummarizer モックを作成（エラーを投げるように設定）
      jest.mock('../../../../src/processors/ai/summarizer', () => ({
        AISummarizer: jest.fn().mockImplementation(() => ({
          summarize: jest.fn().mockRejectedValue(new Error('AI summarization error'))
        }))
      }));
    });
    
    it('should generate a fallback summary when content is short', async () => {
      const content = 'This is a short content.';
      const maxLength = 100;
      
      const summary = await processor.summarize(content, maxLength);
      
      expect(summary).toBe(content);
    });
    
    it('should generate a fallback summary when content is long', async () => {
      const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFourth paragraph.';
      const maxLength = 30;
      
      const summary = await processor.summarize(content, maxLength);
      
      expect(summary.length).toBeLessThanOrEqual(maxLength + 3); // 3は「...」の長さ
      expect(summary).toContain('First paragraph');
    });
  });
}); 