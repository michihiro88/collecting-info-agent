import * as z from 'zod';
import { ModelProvider } from '../utils/types';

/**
 * 一般設定スキーマ
 */
const generalSchema = z.object({
  workspace: z.string(),
  cacheDir: z.string(),
  reportDir: z.string(),
  maxConcurrentTasks: z.number().int().positive()
});

/**
 * モデル設定スキーマ
 */
const modelConfigSchema = z.object({
  name: z.string(),
  provider: z.nativeEnum(ModelProvider),
  apiKeyEnv: z.string(),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(1)
});

/**
 * モデル全体のスキーマ
 */
const modelsSchema = z.object({
  default: z.string(),
  available: z.array(modelConfigSchema)
});

/**
 * レート制限スキーマ
 */
const rateLimitSchema = z.object({
  requestsPerMinute: z.number().int().positive(),
  parallelRequests: z.number().int().positive()
});

/**
 * 検索設定スキーマ
 */
const searchSchema = z.object({
  maxResults: z.number().int().positive(),
  defaultDepth: z.number().int().positive(),
  userAgent: z.string(),
  defaultEngine: z.string().default('google'),
  rateLimit: rateLimitSchema
});

/**
 * ロギング設定スキーマ
 */
const loggingSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  file: z.string(),
  maxSize: z.union([z.number().int().positive(), z.string()]),
  maxFiles: z.number().int().positive(),
  chatLog: z.string()
});

/**
 * 設定全体のスキーマ
 */
export const configSchema = z.object({
  general: generalSchema,
  models: modelsSchema,
  search: searchSchema,
  logging: loggingSchema
});

/**
 * 設定のエクスポート用の型
 */
export type Config = z.infer<typeof configSchema>;

export default configSchema; 