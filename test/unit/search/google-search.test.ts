import { GoogleSearchProvider } from '../../../src/search/providers/google-search';
import { EnvManager } from '../../../src/config/env-manager';
import axios from 'axios';

// モックの設定
jest.mock('axios');
jest.mock('../../../src/config/env-manager', () => ({
  EnvManager: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'GOOGLE_SEARCH_API_KEY') return 'mock-api-key';
        if (key === 'GOOGLE_SEARCH_ENGINE_ID') return 'mock-engine-id';
        return '';
      })
    })
  }
}));

describe('GoogleSearchProvider', () => {
  let provider: GoogleSearchProvider;
  
  beforeEach(() => {
    // axiosのモック設定
    (axios.get as jest.Mock).mockClear();
    
    provider = new GoogleSearchProvider();
  });
  
  test('getName returns "Google"', () => {
    expect(provider.getName()).toBe('Google');
  });
  
  test('search properly parses Google Search API response', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            title: 'Test Title 1',
            link: 'https://example.com/1',
            snippet: 'Test snippet 1'
          },
          {
            title: 'Test Title 2',
            link: 'https://example.com/2',
            snippet: 'Test snippet 2'
          }
        ]
      }
    };
    
    (axios.get as jest.Mock).mockResolvedValue(mockResponse);
    
    const results = await provider.search('test query');
    
    expect(axios.get).toHaveBeenCalledWith('https://www.googleapis.com/customsearch/v1', {
      params: expect.objectContaining({
        key: 'mock-api-key',
        cx: 'mock-engine-id',
        q: 'test query'
      })
    });
    
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Test Title 1');
    expect(results[0].url).toBe('https://example.com/1');
    expect(results[0].snippet).toBe('Test snippet 1');
    expect(results[0].source).toBe('Google');
  });
  
  test('search handles API errors gracefully', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    await expect(provider.search('test query')).rejects.toThrow('Google search failed');
  });
}); 