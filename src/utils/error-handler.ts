import logger from './logger';

/**
 * アプリケーションエラーハンドリングモジュール
 */

/**
 * エラーコード列挙型
 */
export enum ErrorCode {
  // 一般的なエラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // 入力関連エラー
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_URL = 'INVALID_URL',
  
  // ネットワーク関連エラー
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  API_ERROR = 'API_ERROR',
  
  // ファイル関連エラー
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  FILE_FORMAT_ERROR = 'FILE_FORMAT_ERROR',
  
  // 認証関連エラー
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  API_KEY_ERROR = 'API_KEY_ERROR',

  // AI関連エラー
  MODEL_ERROR = 'MODEL_ERROR',
  MODEL_TIMEOUT = 'MODEL_TIMEOUT',
  MODEL_LIMIT_EXCEEDED = 'MODEL_LIMIT_EXCEEDED',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  
  // 検索関連エラー
  SEARCH_ERROR = 'SEARCH_ERROR',
  SEARCH_LIMIT_EXCEEDED = 'SEARCH_LIMIT_EXCEEDED',
  SEARCH_NO_RESULTS = 'SEARCH_NO_RESULTS',
  
  // コンテンツ処理関連エラー
  CONTENT_PROCESSING_ERROR = 'CONTENT_PROCESSING_ERROR',
  CONTENT_EXTRACTION_ERROR = 'CONTENT_EXTRACTION_ERROR',
  CONTENT_FORMAT_ERROR = 'CONTENT_FORMAT_ERROR',
  
  // プロセス関連エラー
  PROCESS_ERROR = 'PROCESS_ERROR',
}

/**
 * アプリケーションエラークラス
 */
export class AppError extends Error {
  code: ErrorCode;
  details?: any;
  
  constructor(message: string, code: ErrorCode = ErrorCode.UNKNOWN_ERROR, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    
    // Errorクラスを正しく拡張するための処理（TypeScriptの制限）
    Object.setPrototypeOf(this, AppError.prototype);
  }
  
  /**
   * エラーメッセージをフォーマットした文字列として取得
   */
  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.details) {
      result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    return result;
  }
  
  /**
   * エラーの詳細情報を含むオブジェクトを取得
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * エラーハンドラー関数
 * エラーをキャッチして適切なAppErrorに変換する
 */
export function handleError(error: unknown, defaultMessage: string = '不明なエラーが発生しました', defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR): AppError {
  // すでにAppErrorの場合はそのまま返す
  if (error instanceof AppError) {
    return error;
  }
  
  // 一般的なエラーの場合はAppErrorに変換
  if (error instanceof Error) {
    return new AppError(error.message, defaultCode, { originalError: error.name, stack: error.stack });
  }
  
  // その他の場合は汎用エラーを返す
  return new AppError(defaultMessage, defaultCode, { originalError: error });
}

/**
 * グローバルエラーハンドラー
 * アプリケーション全体の未処理エラーを処理する
 */
export function handleGlobalError(error: unknown): void {
  const appError = handleError(error);
  logger.error(`アプリケーションエラー: ${appError.toString()}`, appError.toJSON());
}

/**
 * エラーハンドラーのデフォルトエクスポート
 */
export default {
  AppError,
  ErrorCode,
  handleError,
  handleGlobalError
}; 