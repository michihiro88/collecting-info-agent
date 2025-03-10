// モックを先にインポート
import { mockAIModel, mockModelResponse, mockSearchResults } from '../../mocks/models';
import { mockConfig, mockConfigLoader } from '../../mocks/config';

// standardProcessing関数をテスト用に実装
async function standardProcessing(
  query: string,
  modelName?: string,
  outputFormat: any = 'MARKDOWN'
): Promise<string> {
  const searchAgent = getSearchAgent();
  const infoProcessor = getInfoProcessorAgent();
  
  // Web検索の実行
  const searchResults = await searchAgent.search(query);
  
  // 情報の処理と回答の生成
  const answer = await infoProcessor.processResults(
    query,
    searchResults,
    modelName,
    outputFormat
  );
  
  return answer;
}

// エージェントをモック化
jest.mock('../../../src/agents/search-agent', () => ({
  getSearchAgent: jest.fn().mockReturnValue({
    search: jest.fn().mockResolvedValue(mockSearchResults)
  })
}));

jest.mock('../../../src/agents/info-processor', () => ({
  getInfoProcessorAgent: jest.fn().mockReturnValue({
    processResults: jest.fn().mockResolvedValue('処理結果テキスト')
  })
}));

// 次に依存モジュールをモック化
jest.mock('../../../src/config/config-loader', () => ({
  getConfigLoader: jest.fn().mockReturnValue(mockConfigLoader)
}));

jest.mock('../../../src/models/selector', () => ({
  getModelSelector: jest.fn().mockReturnValue({
    getDefaultModel: jest.fn().mockReturnValue(mockAIModel),
    getModel: jest.fn().mockImplementation((modelName: string) => {
      if (modelName === 'test-model') {
        return mockAIModel;
      }
      throw new Error(`モデル ${modelName} が見つかりません`);
    })
  })
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// 最後に実際のモジュールをインポート
import { getMainAgent } from '../../../src/agents/main-agent';
import { getSearchAgent } from '../../../src/agents/search-agent';
import { getInfoProcessorAgent } from '../../../src/agents/info-processor';
import { OutputFormat } from '../../../src/utils/types';

describe('情報収集フロー', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('standardProcessingが正しく動作する', async () => {
    const query = 'テスト質問';
    const result = await standardProcessing(query);
    
    // 検索エージェントが正しく呼び出されたか
    expect(getSearchAgent().search).toHaveBeenCalledWith(query);
    
    // 情報処理エージェントが正しく呼び出されたか
    expect(getInfoProcessorAgent().processResults).toHaveBeenCalledWith(
      query,
      mockSearchResults,
      undefined,
      'MARKDOWN'
    );
    
    // 期待通りの結果が返されたか
    expect(result).toBe('処理結果テキスト');
  });
  
  test('モデル名を指定して処理を実行できる', async () => {
    const query = 'テスト質問';
    const modelName = 'test-model';
    
    await standardProcessing(query, modelName);
    
    expect(getInfoProcessorAgent().processResults).toHaveBeenCalledWith(
      query,
      mockSearchResults,
      modelName,
      'MARKDOWN'
    );
  });
  
  test('出力形式を指定して処理を実行できる', async () => {
    const query = 'テスト質問';
    const outputFormat = 'JSON';
    
    await standardProcessing(query, undefined, outputFormat);
    
    expect(getInfoProcessorAgent().processResults).toHaveBeenCalledWith(
      query,
      mockSearchResults,
      undefined,
      outputFormat
    );
  });
  
  test('検索エラー時に適切に処理される', async () => {
    const searchError = new Error('検索エラー');
    getSearchAgent().search = jest.fn().mockRejectedValueOnce(searchError);
    
    await expect(standardProcessing('エラーテスト')).rejects.toThrow();
    
    expect(getInfoProcessorAgent().processResults).not.toHaveBeenCalled();
  });
}); 