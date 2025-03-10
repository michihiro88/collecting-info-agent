/**
 * シンプルなロガーモジュール
 */

import fs from 'fs';
import path from 'path';
import winston from 'winston';

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * ロギング設定
 */
export interface LoggerConfig {
  level: LogLevel;
  file?: string;
  console?: boolean;
  maxSize?: number;
  maxFiles?: number;
}

// デフォルト設定
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  console: true,
  file: './logs/app.log',
  maxSize: 5242880, // 5MB
  maxFiles: 5,
};

// ロガーインスタンス
let loggerInstance: winston.Logger | null = null;

/**
 * ロガー設定を初期化
 */
export function initLogger(config: Partial<LoggerConfig> = {}): winston.Logger {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // ログディレクトリの作成
  if (mergedConfig.file) {
    const logDir = path.dirname(mergedConfig.file);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  // Winstonトランスポート
  const transports: winston.transport[] = [];
  
  // コンソール出力
  if (mergedConfig.console) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
          })
        ),
      })
    );
  }
  
  // ファイル出力
  if (mergedConfig.file) {
    transports.push(
      new winston.transports.File({
        filename: mergedConfig.file,
        maxsize: mergedConfig.maxSize,
        maxFiles: mergedConfig.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }
  
  // Winstonロガー作成
  loggerInstance = winston.createLogger({
    level: mergedConfig.level,
    transports,
  });
  
  return loggerInstance;
}

/**
 * ロガーインスタンスを取得
 */
function getLogger(): winston.Logger {
  if (!loggerInstance) {
    return initLogger();
  }
  return loggerInstance;
}

/**
 * デバッグレベルのログ
 */
export function debug(message: string, meta?: any): void {
  const logger = getLogger();
  logger.debug(message, meta);
}

/**
 * 情報レベルのログ
 */
export function info(message: string, meta?: any): void {
  const logger = getLogger();
  logger.info(message, meta);
}

/**
 * 警告レベルのログ
 */
export function warn(message: string, meta?: any): void {
  const logger = getLogger();
  logger.warn(message, meta);
}

/**
 * エラーレベルのログ
 */
export function error(message: string, meta?: any): void {
  const logger = getLogger();
  logger.error(message, meta);
}

/**
 * チャットログの記録（専用ファイルに保存）
 */
export function chatLog(userMessage: string, aiResponse: string): void {
  const logger = getLogger();
  logger.info('CHAT', { user: userMessage, ai: aiResponse });
}

// デフォルトエクスポート
export default {
  debug,
  info,
  warn,
  error,
  chatLog,
  initLogger,
}; 