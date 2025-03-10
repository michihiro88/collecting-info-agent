import dotenv from 'dotenv';
import { AppError, ErrorCode } from '../utils/error-handler';
import logger from '../utils/logger';

/**
 * 環境変数管理クラス
 * .envファイルの読み込みと環境変数へのアクセスを担当
 */
export class EnvManager {
  private static instance: EnvManager;
  private initialized: boolean = false;
  
  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(): EnvManager {
    if (!EnvManager.instance) {
      EnvManager.instance = new EnvManager();
    }
    return EnvManager.instance;
  }
  
  /**
   * コンストラクタ
   * 初期化は明示的に行うため、ここでは何もしない
   */
  private constructor() {}
  
  /**
   * 環境変数の初期化
   * アプリケーション開始時に一度だけ呼び出す
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    
    // .envファイルの読み込み
    const result = dotenv.config();
    if (result.error) {
      // 開発環境では警告のみ、本番環境ではエラー
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(
          '.envファイルの読み込みに失敗しました',
          ErrorCode.CONFIGURATION_ERROR,
          { error: result.error }
        );
      } else {
        logger.warn('.envファイルが見つからないか読み込めません。環境変数を直接使用します。');
      }
    } else {
      logger.debug('.envファイルを読み込みました');
    }
    
    this.initialized = true;
  }
  
  /**
   * 環境変数の取得
   * @param key 環境変数名
   * @returns 環境変数の値（未設定の場合はundefined）
   */
  public get(key: string): string | undefined {
    if (!this.initialized) {
      this.initialize();
    }
    return process.env[key];
  }
  
  /**
   * 必須環境変数の取得（未設定の場合はエラー）
   * @param key 環境変数名
   * @returns 環境変数の値
   * @throws 環境変数が未設定の場合はエラー
   */
  public getRequired(key: string): string {
    const value = this.get(key);
    if (value === undefined) {
      throw new AppError(
        `必須環境変数 ${key} が設定されていません`,
        ErrorCode.CONFIGURATION_ERROR,
        { key }
      );
    }
    return value;
  }
  
  /**
   * デフォルト値付き環境変数の取得
   * @param key 環境変数名
   * @param defaultValue デフォルト値
   * @returns 環境変数の値（未設定の場合はデフォルト値）
   */
  public getWithDefault(key: string, defaultValue: string): string {
    const value = this.get(key);
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * 数値環境変数の取得
   * @param key 環境変数名
   * @param defaultValue デフォルト値
   * @returns 環境変数の数値（変換できない場合はデフォルト値）
   */
  public getNumber(key: string, defaultValue: number): number {
    const value = this.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    
    const numberValue = Number(value);
    return isNaN(numberValue) ? defaultValue : numberValue;
  }
  
  /**
   * 真偽値環境変数の取得
   * @param key 環境変数名
   * @param defaultValue デフォルト値
   * @returns 環境変数の真偽値（"true"/"false"以外はデフォルト値）
   */
  public getBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    
    if (value.toLowerCase() === 'true') {
      return true;
    } else if (value.toLowerCase() === 'false') {
      return false;
    }
    
    return defaultValue;
  }
  
  /**
   * APIキーの取得
   * @param provider プロバイダー名
   * @returns APIキー（未設定の場合はundefined）
   */
  public getApiKey(provider: string): string | undefined {
    return this.get(`${provider.toUpperCase()}_API_KEY`);
  }
  
  /**
   * 必須APIキーの取得
   * @param provider プロバイダー名
   * @returns APIキー
   * @throws APIキーが未設定の場合はエラー
   */
  public getRequiredApiKey(provider: string): string {
    const key = `${provider.toUpperCase()}_API_KEY`;
    return this.getRequired(key);
  }
  
  /**
   * 開発環境かどうかをチェック
   * @returns 開発環境の場合はtrue
   */
  public isDevelopment(): boolean {
    return this.getWithDefault('NODE_ENV', 'development').toLowerCase() === 'development';
  }
  
  /**
   * テスト環境かどうかをチェック
   * @returns テスト環境の場合はtrue
   */
  public isTest(): boolean {
    return this.getWithDefault('NODE_ENV', '').toLowerCase() === 'test' || 
           this.getBoolean('TEST_MODE', false);
  }
  
  /**
   * 本番環境かどうかをチェック
   * @returns 本番環境の場合はtrue
   */
  public isProduction(): boolean {
    return this.getWithDefault('NODE_ENV', '').toLowerCase() === 'production';
  }
  
  /**
   * テスト用：環境変数の一時的な設定
   * 注意：テストコードでのみ使用すること
   * @param key 環境変数名
   * @param value 設定値
   */
  public setForTesting(key: string, value: string): void {
    if (!this.isTest()) {
      throw new Error('setForTestingはテスト環境でのみ使用できます');
    }
    process.env[key] = value;
  }
  
  /**
   * テスト用：環境変数の一時的な削除
   * 注意：テストコードでのみ使用すること
   * @param key 環境変数名
   */
  public unsetForTesting(key: string): void {
    if (!this.isTest()) {
      throw new Error('unsetForTestingはテスト環境でのみ使用できます');
    }
    delete process.env[key];
  }
}

// エクスポート用シングルトンインスタンス
export const envManager = EnvManager.getInstance(); 