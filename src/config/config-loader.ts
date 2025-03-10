import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { configSchema, Config } from './config-schema';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';

/**
 * 設定ファイルを読み込むクラス
 */
export class ConfigLoader {
  private config: Config;
  private configPath: string;
  private profilesDir: string;

  /**
   * コンストラクタ
   * @param configDir 設定ファイルディレクトリ
   * @param configFile 設定ファイル名
   */
  constructor(configDir: string = './config', configFile: string = 'default.yml') {
    this.configPath = path.resolve(process.cwd(), configDir, configFile);
    this.profilesDir = path.resolve(process.cwd(), configDir, 'profiles');
    this.config = this.loadDefaultConfig();
  }

  /**
   * デフォルト設定を読み込む
   */
  private loadDefaultConfig(): Config {
    try {
      // 基本的なデフォルト設定を提供
      const defaultConfig = {
        general: {
          workspace: './workspace',
          cacheDir: './cache',
          reportDir: './reports',
          maxConcurrentTasks: 2
        },
        models: {
          default: 'gpt-3.5-turbo',
          available: [
            {
              name: 'gpt-3.5-turbo',
              provider: 'OPENAI',
              apiKeyEnv: 'OPENAI_API_KEY',
              maxTokens: 2000,
              temperature: 0.7
            }
          ]
        },
        search: {
          maxResults: 5,
          defaultDepth: 2,
          userAgent: 'InfoAgent/1.0',
          rateLimit: {
            requestsPerMinute: 10,
            parallelRequests: 2
          }
        },
        logging: {
          level: 'info',
          file: './logs/app.log',
          maxSize: 1048576, // 1MB
          maxFiles: 5,
          chatLog: './logs/chat.log'
        }
      };
      return configSchema.parse(defaultConfig);
    } catch (error) {
      logger.error('デフォルト設定の検証に失敗しました', { error });
      throw new AppError(
        'デフォルト設定の検証に失敗しました',
        ErrorCode.CONFIGURATION_ERROR,
        { error }
      );
    }
  }

  /**
   * 設定ファイルを読み込む
   */
  public load(): Config {
    try {
      // 設定ファイルが存在するか確認
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`設定ファイル ${this.configPath} が見つかりません。デフォルト設定を使用します。`);
        return this.config;
      }

      // ファイルを読み込む
      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      let loadedConfig;

      // YAMLまたはJSONとして解析
      if (this.configPath.endsWith('.yml') || this.configPath.endsWith('.yaml')) {
        loadedConfig = yaml.load(fileContent);
      } else if (this.configPath.endsWith('.json')) {
        loadedConfig = JSON.parse(fileContent);
      } else {
        throw new Error('サポートされていないファイル形式です。YAMLまたはJSONを使用してください。');
      }

      // スキーマ検証
      const mergedConfig = this.mergeConfigs(this.config, loadedConfig as Record<string, any>);
      this.config = configSchema.parse(mergedConfig);
      
      logger.info('設定ファイルを読み込みました', { configPath: this.configPath });
      return this.config;
    } catch (error) {
      logger.error('設定ファイルの読み込みに失敗しました', { 
        error, 
        configPath: this.configPath 
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        `設定ファイル ${this.configPath} の読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.CONFIGURATION_ERROR,
        { error }
      );
    }
  }

  /**
   * プロファイル設定を読み込む
   * @param profileName プロファイル名
   */
  public loadProfile(profileName: string): Config {
    try {
      const profilePath = path.join(this.profilesDir, `${profileName}.yml`);
      
      // プロファイルが存在するか確認
      if (!fs.existsSync(profilePath)) {
        throw new Error(`プロファイル ${profileName} が見つかりません。`);
      }

      // プロファイルファイルを読み込む
      const fileContent = fs.readFileSync(profilePath, 'utf8');
      let profileConfig;

      // YAMLまたはJSONとして解析
      if (profilePath.endsWith('.yml') || profilePath.endsWith('.yaml')) {
        profileConfig = yaml.load(fileContent);
      } else if (profilePath.endsWith('.json')) {
        profileConfig = JSON.parse(fileContent);
      } else {
        throw new Error('サポートされていないファイル形式です。YAMLまたはJSONを使用してください。');
      }

      // 基本設定とプロファイル設定をマージ
      const mergedConfig = this.mergeConfigs(this.config, profileConfig as Record<string, any>);
      this.config = configSchema.parse(mergedConfig);
      
      logger.info(`プロファイル ${profileName} を読み込みました`, { profilePath });
      return this.config;
    } catch (error) {
      logger.error(`プロファイル ${profileName} の読み込みに失敗しました`, { error });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        `プロファイル ${profileName} の読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.CONFIGURATION_ERROR,
        { error }
      );
    }
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * 設定をマージする
   * @param baseConfig ベース設定
   * @param overrideConfig 上書き設定
   */
  private mergeConfigs(baseConfig: Record<string, any>, overrideConfig: Record<string, any>): Record<string, any> {
    const result = { ...baseConfig };

    for (const [key, value] of Object.entries(overrideConfig)) {
      // 両方のオブジェクトが非nullオブジェクトの場合は再帰的にマージ
      if (
        key in result &&
        typeof result[key] === 'object' && result[key] !== null &&
        typeof value === 'object' && value !== null &&
        !Array.isArray(result[key]) && !Array.isArray(value)
      ) {
        result[key] = this.mergeConfigs(result[key], value);
      } else {
        // それ以外は上書き
        result[key] = value;
      }
    }

    return result;
  }
}

// シングルトンインスタンス
let configInstance: ConfigLoader | null = null;

/**
 * 設定ローダーのインスタンスを取得
 */
export function getConfigLoader(): ConfigLoader {
  if (!configInstance) {
    configInstance = new ConfigLoader();
    // デフォルト設定ファイルを読み込む
    configInstance.load();
  }
  return configInstance;
}

export default { ConfigLoader, getConfigLoader }; 