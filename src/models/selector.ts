import { Config } from '../config/config-schema';
import { getConfigLoader } from '../config/config-loader';
import { IAIModel } from './interfaces/ai-model';
import { ModelProvider } from '../utils/types';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';

// モデルプロバイダー実装のインポート
import AnthropicModel from './providers/anthropic-model';
import OpenAIModel from './providers/openai-model';
import GoogleModel from './providers/google-model';

/**
 * モデルセレクター
 * 設定に基づいて適切なAIモデルを選択する
 */
export class ModelSelector {
  private models: Map<string, IAIModel> = new Map();
  private config: Config;

  /**
   * コンストラクタ
   */
  constructor() {
    // 設定を読み込む
    const configLoader = getConfigLoader();
    this.config = configLoader.getConfig();
    
    // 利用可能なモデルを初期化
    this.initializeModels();
  }

  /**
   * 利用可能なモデルを初期化
   */
  private initializeModels(): void {
    try {
      // 設定から利用可能なモデルを取得
      const availableModels = this.config.models.available;

      for (const modelConfig of availableModels) {
        const { name, provider, apiKeyEnv } = modelConfig;

        // プロバイダーに応じたモデルインスタンスを作成
        let model: IAIModel | null = null;

        switch (provider) {
          case ModelProvider.ANTHROPIC:
            model = new AnthropicModel(name, apiKeyEnv);
            break;
          case ModelProvider.OPENAI:
            model = new OpenAIModel(name, apiKeyEnv);
            break;
          case ModelProvider.GOOGLE:
            model = new GoogleModel(name, apiKeyEnv);
            break;
          default:
            logger.warn(`未サポートのプロバイダー: ${provider}`);
            continue;
        }

        if (model) {
          this.models.set(name, model);
          logger.debug(`モデルを登録しました: ${name} (${provider})`);
        }
      }

      logger.info(`モデルセレクターを初期化しました。利用可能なモデル: ${this.models.size}`);
    } catch (error) {
      logger.error('モデルの初期化中にエラーが発生しました', { error });
      throw new AppError(
        'モデルの初期化に失敗しました',
        ErrorCode.MODEL_ERROR,
        { error }
      );
    }
  }

  /**
   * デフォルトモデルを取得
   */
  public getDefaultModel(): IAIModel {
    const defaultModelName = this.config.models.default;
    return this.getModel(defaultModelName);
  }

  /**
   * 指定した名前のモデルを取得
   * @param modelName モデル名
   */
  public getModel(modelName: string): IAIModel {
    const model = this.models.get(modelName);
    if (!model) {
      logger.warn(`モデル ${modelName} が見つかりません。デフォルトモデルを使用します。`);
      
      // デフォルトモデルも見つからない場合はエラー
      const defaultModel = this.models.get(this.config.models.default);
      if (!defaultModel) {
        throw new AppError(
          `モデル ${modelName} が見つかりません。デフォルトモデルも利用できません。`,
          ErrorCode.MODEL_ERROR,
          { requestedModel: modelName, defaultModel: this.config.models.default }
        );
      }
      
      return defaultModel;
    }
    
    return model;
  }

  /**
   * 利用可能なすべてのモデル名を取得
   */
  public getAvailableModelNames(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * 指定したプロバイダーのモデルのみを取得
   * @param provider プロバイダー
   */
  public getModelsByProvider(provider: ModelProvider): IAIModel[] {
    return Array.from(this.models.values())
      .filter(model => model.provider === provider);
  }
}

/**
 * モデルセレクターのシングルトンインスタンス
 */
let selectorInstance: ModelSelector | null = null;

/**
 * モデルセレクターのインスタンスを取得
 */
export function getModelSelector(): ModelSelector {
  if (!selectorInstance) {
    selectorInstance = new ModelSelector();
  }
  return selectorInstance;
}

/**
 * デフォルトモデルを取得するユーティリティ関数
 */
export function getDefaultModel(): IAIModel {
  return getModelSelector().getDefaultModel();
}

export default { ModelSelector, getModelSelector, getDefaultModel }; 