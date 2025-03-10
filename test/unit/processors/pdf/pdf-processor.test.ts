// テスト環境を設定
process.env.NODE_ENV = 'test'; 

import { PdfProcessor } from '../../../../src/processors/pdf/pdf-processor';
import * as fs from 'fs';

// pdfParseのモック
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      text: 'テストPDFのコンテンツ',
      info: {
        Title: 'テストPDF',
        Author: 'テスト作成者',
        CreationDate: new Date('2023-01-01'),
        Language: 'ja_JP'
      },
      metadata: {},
      version: '1.4',
      numPages: 5
    });
  });
});

// fsのモック
jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockImplementation(() => true),
    readFileSync: jest.fn().mockImplementation(() => Buffer.from('fake pdf data')),
    promises: {
      readFile: jest.fn().mockImplementation(() => Promise.resolve(Buffer.from('fake pdf data')))
    }
  };
});

// AISummarizerのモック
jest.mock('../../../../src/processors/ai/summarizer', () => {
  return {
    AISummarizer: jest.fn().mockImplementation(() => {
      return {
        summarize: jest.fn().mockImplementation((content, maxLength) => {
          return Promise.resolve('テストPDFのコンテンツ');
        })
      };
    })
  };
});

describe('PdfProcessor', () => {
  let processor: PdfProcessor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    processor = new PdfProcessor();
  });
  
  it('should initialize correctly', () => {
    expect(processor).toBeDefined();
  });
  
  describe('process', () => {
    it('should process PDF content from base64 data', async () => {
      const base64Content = Buffer.from('fake pdf data').toString('base64');
      const sourceUrl = 'http://example.com/test.pdf';
      
      const result = await processor.process(base64Content, sourceUrl);
      
      expect(result).toBeDefined();
      expect(result.content).toBe('テストPDFのコンテンツ');
      expect(result.metadata.source).toBe(sourceUrl);
      expect(result.metadata.contentType).toBe('application/pdf; version=1.4');
    });
    
    it('should process PDF content from local file', async () => {
      const content = 'local file content';
      const sourceUrl = '/path/to/local/file.pdf';
      
      const result = await processor.process(content, sourceUrl);
      
      expect(result).toBeDefined();
      expect(result.content).toBe('テストPDFのコンテンツ');
      expect(result.metadata.source).toBe(sourceUrl);
      expect(fs.existsSync).toHaveBeenCalledWith(sourceUrl);
      expect(fs.readFileSync).toHaveBeenCalledWith(sourceUrl);
    });
    
    it('should handle errors during processing', async () => {
      // pdfParseがエラーをスローするようにモックを変更
      const pdfParse = require('pdf-parse');
      pdfParse.mockImplementationOnce(() => {
        throw new Error('PDF処理エラー');
      });
      
      const content = 'error content';
      const sourceUrl = 'http://example.com/error.pdf';
      
      const result = await processor.process(content, sourceUrl);
      
      // エラー時は元のコンテンツが返されることを確認
      expect(result).toBeDefined();
      expect(result.content).toBe(content);
      expect(result.metadata.source).toBe(sourceUrl);
    });
    
    it('should extract metadata when option is enabled', async () => {
      const content = 'test content';
      const sourceUrl = 'http://example.com/test.pdf';
      
      const result = await processor.process(content, sourceUrl, { extractMetadata: true });
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('テストPDF');
      expect(result.metadata.author).toBe('テスト作成者');
      expect(result.metadata.language).toBe('ja_JP');
    });
    
    it('should clean content when option is enabled', async () => {
      const content = 'test content with formatting issues';
      const sourceUrl = 'http://example.com/test.pdf';
      
      const result = await processor.process(content, sourceUrl, { cleanContent: true });
      
      expect(result.cleanedContent).toBeDefined();
      // cleanContent関数のモックは難しいので、ここでは単純に存在確認のみ
    });
    
    it('should generate summary when option is enabled', async () => {
      const pdfContent = 'base64encodedpdf';
      const sourceUrl = 'http://example.com/test.pdf';
      const options = {
        extractMetadata: true,
        cleanContent: true,
        generateSummary: true
      };
      
      // モックの戻り値を設定
      const mockAISummarizer = require('../../../../src/processors/ai/summarizer');
      mockAISummarizer.AISummarizer.mockImplementation(() => {
        return {
          summarize: jest.fn().mockResolvedValueOnce('テストPDFのコンテンツ')
        };
      });
      
      const result = await processor.process(pdfContent, sourceUrl, options);
      
      expect(result.summary).toBeDefined();
      expect(result.summary).toBe('テストPDFのコンテンツ');
    });
  });
  
  describe('summarize', () => {
    it('should use AISummarizer when not skipped', async () => {
      // NODE_ENV=testの場合は既にスキップされるが、一時的に変更
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const content = 'テストコンテンツ';
      const maxLength = 100;
      
      const summary = await processor.summarize(content, maxLength);
      
      expect(summary).toBe('テストPDFのコンテンツ');
      
      // 環境を元に戻す
      process.env.NODE_ENV = oldEnv;
    });
    
    it('should fallback to simple extraction when AI is skipped', async () => {
      // 既にNODE_ENV=testになっているのでスキップされる
      const content = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const maxLength = 20;
      
      // AISummarizerのモックを一時的に変更して、テスト環境でもスキップされるようにする
      jest.resetModules();
      jest.mock('../../../../src/processors/ai/summarizer', () => ({
        AISummarizer: jest.fn().mockImplementation(() => ({
          summarize: jest.fn().mockImplementation(() => {
            throw new Error('AI summarization skipped in test');
          })
        }))
      }));
      
      // 新しいインスタンスを作成
      const tempProcessor = new PdfProcessor();
      const summary = await tempProcessor.summarize(content, maxLength);
      
      // フォールバック要約が生成され、長さ制限が守られていることを確認
      expect(summary.length).toBeLessThanOrEqual(maxLength);
      expect(summary).toBe('Paragraph 1.');
    });
    
    it('should return original content when shorter than max length', async () => {
      const content = 'Short content';
      const maxLength = 100;
      
      // AISummarizerのモックを一時的に変更して、テスト環境でもスキップされるようにする
      jest.resetModules();
      jest.mock('../../../../src/processors/ai/summarizer', () => ({
        AISummarizer: jest.fn().mockImplementation(() => ({
          summarize: jest.fn().mockImplementation(() => {
            throw new Error('AI summarization skipped in test');
          })
        }))
      }));
      
      // 新しいインスタンスを作成
      const tempProcessor = new PdfProcessor();
      const summary = await tempProcessor.summarize(content, maxLength);
      
      // コンテンツが短い場合は元のコンテンツが返される
      expect(summary).toBe(content);
    });
  });
}); 