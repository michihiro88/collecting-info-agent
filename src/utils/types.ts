/**
 * AIモデルプロバイダーの種類
 */
export enum ModelProvider {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  GOOGLE = 'GOOGLE',
}

/**
 * 出力形式の種類
 */
export enum OutputFormat {
  TEXT = 'TEXT',
  MARKDOWN = 'MARKDOWN',
  HTML = 'HTML',
  JSON = 'JSON',
}

/**
 * 情報源の種類
 */
export enum SourceType {
  WEB = 'web',
  FILE = 'file',
  API = 'api',
}

/**
 * ソース情報
 */
export interface Source {
  type: SourceType;
  url?: string;
  path?: string;
  apiName?: string;
}

/**
 * メタデータ情報
 */
export interface ContentMetadata {
  title?: string;
  author?: string;
  date?: string;
  description?: string;
  keywords?: string[];
  lastModified?: string;
}

/**
 * コンテンツ情報
 */
export interface Content {
  fullText: string;
  summary?: string;
  keyPoints?: string[];
}

/**
 * 検索結果の型
 */
export interface SearchResult {
  // 基本情報
  title: string;
  url: string;
  content: string; // 下位互換性のために保持
  snippet?: string; // 下位互換性のために保持
  
  // 拡張情報
  source: Source;
  metadata: ContentMetadata;
  content2: Content; // content という名前が既に使われているため content2 として追加
  
  // 評価情報
  score: number;
  relevance: number; // 関連性スコア（0-1の範囲）
  timestamp: string;
}

/**
 * AIモデルオプションの型
 */
export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
}

/**
 * AIモデルレスポンスの型
 */
export interface ModelResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    model: string;
    provider: ModelProvider;
    processingTime: number;
  };
}

/**
 * 検索オプションの型
 */
export interface SearchOptions {
  maxResults?: number;
  sources?: SourceType[];
  filters?: {
    minRelevance?: number;
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    language?: string[];
    contentType?: string[];
  };
}

/**
 * ログエントリの型
 */
export interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  context: {
    component: string;
    operation: string;
    taskId?: string;
  };
  message: string;
  data?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * チャットログエントリの型
 */
export interface ChatLogEntry {
  timestamp: Date;
  direction: 'INPUT' | 'OUTPUT';
  modelId: string;
  message: string;
  tokens?: number;
  processingTime?: number;
}

/**
 * アプリケーション設定の型
 */
export interface AppConfig {
  general: {
    workspace: string;
    cacheDir: string;
    reportDir: string;
    maxConcurrentTasks: number;
  };
  models: {
    default: string;
    available: Array<{
      name: string;
      provider: ModelProvider;
      apiKeyEnv: string;
      maxTokens: number;
      temperature: number;
    }>;
  };
  search: {
    maxResults: number;
    defaultDepth: number;
    userAgent: string;
    rateLimit: {
      requestsPerMinute: number;
      parallelRequests: number;
    };
  };
  logging: {
    level: string;
    file: string;
    maxSize: string;
    maxFiles: number;
    chatLog: string;
  };
}

/**
 * ページ内容
 */
export interface PageContent {
  url: string;
  title: string;
  content: string;
  text: string;
  metadata: {
    lastModified?: string;
    author?: string;
    description?: string;
    keywords?: string[];
  };
}

/**
 * エージェント設定
 */
export interface AgentConfig {
  maxRounds: number;
  timeoutMs: number;
  maxRetries: number;
  temperature: number;
  maxTokens: number;
  debug: boolean;
} 