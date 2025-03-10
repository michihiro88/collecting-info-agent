// モックを先にインポート
import { mockConfig, mockConfigLoader } from '../../mocks/config';
import { mockSearchResults } from '../../mocks/models';

// mockedAxiosの定義
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 次に依存モジュールをモック化
jest.mock('../../../src/config/config-loader', () => ({
  getConfigLoader: jest.fn().mockReturnValue(mockConfigLoader)
}));

jest.mock('../../../src/models/selector', () => ({
  getModelSelector: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// 検索サービスのモック
const mockFetchContent = jest.fn();
jest.mock('../../../src/search/search-service', () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue([
      { 
        title: 'テスト検索結果1', 
        url: 'https://example.com/1', 
        snippet: 'これはテスト検索結果です。', 
        source: 'google',
        relevanceScore: 0.9
      },
      { 
        title: 'テスト検索結果2', 
        url: 'https://example.com/2', 
        snippet: 'これは別のテスト検索結果です。', 
        source: 'google',
        relevanceScore: 0.8
      }
    ]),
    getAvailableProviders: jest.fn().mockReturnValue(['google']),
    fetchContent: mockFetchContent
  }))
}));

// 最後に実際のモジュールをインポート
import { SearchAgent, getSearchAgent } from '../../../src/agents/search-agent';
import { ErrorCode, AppError } from '../../../src/utils/error-handler';
import { JSDOM } from 'jsdom';
import { SourceType } from '../../../src/utils/types';

describe('SearchAgent', () => {
  let searchAgent: SearchAgent;
  
  beforeEach(() => {
    jest.clearAllMocks();
    searchAgent = getSearchAgent();
  });
  
  afterEach(() => {
    // シングルトンインスタンスをリセット
    (SearchAgent as any).searchAgentInstance = null;
  });
  
  describe('getSearchAgent', () => {
    test('常に同じインスタンスを返す', () => {
      const agent1 = getSearchAgent();
      const agent2 = getSearchAgent();
      expect(agent1).toBe(agent2);
    });
  });
  
  describe('search', () => {
    test('検索結果を返す', async () => {
      // @ts-ignore: searchServiceをモックに置き換え
      searchAgent.searchService.search.mockResolvedValueOnce([
        { 
          title: 'テスト検索結果1', 
          url: 'https://example.com/1', 
          snippet: 'これはテスト検索結果です。', 
          source: 'google',
          relevanceScore: 0.9
        }
      ]);
      
      const results = await searchAgent.search('テスト検索');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('テスト検索結果1');
      expect(results[0].url).toContain('example.com');
    });
    
    test('指定された検索エンジンを使用する', async () => {
      // @ts-ignore: searchServiceをモックに置き換え
      searchAgent.searchService.search.mockResolvedValueOnce([
        { 
          title: 'テスト検索結果1', 
          url: 'https://example.com/1', 
          snippet: 'これはテスト検索結果です。', 
          source: 'google',
          relevanceScore: 0.9
        }
      ]);
      
      const results = await searchAgent.search('テスト検索', 'google');
      
      expect(results).toHaveLength(1);
      // @ts-ignore: searchServiceをモックに置き換え
      expect(searchAgent.searchService.search).toHaveBeenCalledWith('テスト検索', 'google', expect.anything());
    });
    
    test('無効な検索エンジンでエラーをスローする', async () => {
      // @ts-ignore: validEnginesを設定
      searchAgent.validEngines = ['google'];
      
      await expect(searchAgent.search('テスト検索', 'invalid-engine')).rejects.toThrow(AppError);
    });
  });
  
  describe('fetchContent', () => {
    const mockHtml = `
      <html>
        <head><title>テストページ</title></head>
        <body>
          <header>ヘッダー</header>
          <main>
            <h1>テストコンテンツ</h1>
            <p>これはテスト段落です。</p>
            <script>console.log("スクリプト");</script>
          </main>
          <footer>フッター</footer>
        </body>
      </html>
    `;
    
    beforeEach(() => {
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockFetchContent.mockResolvedValue(mockHtml);
    });
    
    test('URLからコンテンツを取得する', async () => {
      const url = 'https://example.com';
      const content = await searchAgent.fetchContent(url);
      
      expect(mockFetchContent).toHaveBeenCalledWith(
        url,
        expect.any(Object)
      );
      expect(content).toBe(mockHtml);
    });
    
    test('無効なURLでエラーをスローする', async () => {
      await expect(searchAgent.fetchContent('invalid-url')).rejects.toThrow(AppError);
    });
    
    test('ネットワークエラーを適切に処理する', async () => {
      mockFetchContent.mockRejectedValueOnce(new Error('ネットワークエラー'));
      
      await expect(searchAgent.fetchContent('https://example.com')).rejects.toThrow(AppError);
      expect(mockFetchContent).toHaveBeenCalled();
    });
  });
  
  describe('extractRelevantContext', () => {
    test('空の検索結果の場合、適切なメッセージを返す', async () => {
      const context = await searchAgent.extractRelevantContext('テスト検索', []);
      expect(context).toContain('関連情報は見つかりませんでした');
    });
    
    test('検索結果からコンテキストを抽出する', async () => {
      const context = await searchAgent.extractRelevantContext('テスト検索', mockSearchResults);
      
      expect(context).toContain(mockSearchResults[0].snippet || '');
      expect(context).toContain(mockSearchResults[1].snippet || '');
      expect(context).toContain(mockSearchResults[0].url);
      expect(context).toContain(mockSearchResults[1].url);
      expect(context).toContain('出典情報');
    });
    
    test('最大コンテキスト長を超えない', async () => {
      const maxLength = 500;
      const context = await searchAgent.extractRelevantContext('テスト検索', mockSearchResults, maxLength);
      
      expect(context.length).toBeLessThanOrEqual(maxLength + 200); // 出典情報の追加分の余裕を持たせる
    });
  });
  
  describe('isValidUrl', () => {
    const validUrls = [
      'https://example.com',
      'http://example.org/path',
      'https://sub.domain.co.jp/page?query=value'
    ];
    
    const invalidUrls = [
      'example.com',
      'ftp://example.org',
      'htt://invalid',
      '',
      'http://'
    ];
    
    test.each(validUrls)('有効なURL: %s', async (url) => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      expect(searchAgent.isValidUrl(url)).toBe(true);
    });
    
    test.each(invalidUrls)('無効なURL: %s', async (url) => {
      // @ts-ignore: テストのためprivateメソッドへアクセス
      expect(searchAgent.isValidUrl(url)).toBe(false);
    });
  });
  
  describe('extractTextFromHtml', () => {
    test('HTMLからテキストを抽出する', () => {
      const html = `
        <html>
          <head><title>テスト</title></head>
          <body>
            <header>ヘッダー</header>
            <nav>ナビゲーション</nav>
            <main>
              <h1>タイトル</h1>
              <p>段落1</p>
              <p>段落2</p>
              <script>console.log("スクリプト");</script>
              <style>.test { color: red; }</style>
            </main>
            <footer>フッター</footer>
          </body>
        </html>
      `;
      
      const dom = new JSDOM(html);
      
      // @ts-ignore: テストのためprivateメソッドへアクセス
      const text = searchAgent.extractTextFromHtml(dom.window.document);
      
      expect(text).toContain('タイトル');
      expect(text).toContain('段落1');
    });
  });
}); 