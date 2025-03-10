import { Config } from '../../src/config/config-schema';
import { ModelProvider } from '../../src/utils/types';

// テスト用設定
export const mockConfig: Config = {
  general: {
    workspace: './test-workspace',
    cacheDir: './test-cache',
    reportDir: './test-reports',
    maxConcurrentTasks: 2
  },
  models: {
    default: 'test-model',
    available: [
      {
        name: 'test-model',
        provider: ModelProvider.ANTHROPIC,
        apiKeyEnv: 'TEST_API_KEY',
        maxTokens: 1000,
        temperature: 0.5
      },
      {
        name: 'test-model-2',
        provider: ModelProvider.OPENAI,
        apiKeyEnv: 'TEST_OPENAI_API_KEY',
        maxTokens: 1000,
        temperature: 0.5
      }
    ]
  },
  search: {
    maxResults: 5,
    defaultDepth: 1,
    defaultEngine: 'test-engine',
    userAgent: 'TestAgent/1.0',
    rateLimit: {
      requestsPerMinute: 5,
      parallelRequests: 1
    }
  },
  logging: {
    level: 'info',
    file: './test-logs/app.log',
    maxSize: 1000000,
    maxFiles: 2,
    chatLog: './test-logs/chat.log'
  }
};

// 設定ローダーのモック
export const mockConfigLoader = {
  getConfig: jest.fn().mockReturnValue(mockConfig)
}; 