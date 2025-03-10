import { ModelOptions, ModelResponse, SearchResult } from '../../utils/types';

/**
 * AIモデルの共通インターフェース
 */
export interface IAIModel {
  /**
   * モデルの識別子
   */
  readonly id: string;

  /**
   * モデルプロバイダー
   */
  readonly provider: string;

  /**
   * APIキーが設定されているかどうか
   */
  isConfigured(): boolean;

  /**
   * テキスト生成
   * @param prompt プロンプト
   * @param options 生成オプション
   */
  generateText(prompt: string, options?: ModelOptions): Promise<ModelResponse>;

  /**
   * ストリーミングテキスト生成
   * @param prompt プロンプト
   * @param handler ストリーミングレスポンスハンドラ
   * @param options 生成オプション
   */
  generateTextStream(
    prompt: string,
    handler: StreamResponseHandler,
    options?: ModelOptions
  ): Promise<void>;

  /**
   * 検索結果を含むコンテキスト付きテキスト生成（RAG）
   * @param prompt プロンプト
   * @param context 検索結果の配列
   * @param options 生成オプション
   */
  generateWithContext(
    prompt: string,
    context: SearchResult[],
    options?: ModelOptions
  ): Promise<ModelResponse>;

  /**
   * エラー処理
   * @param error エラーオブジェクト
   */
  handleError(error: unknown): Promise<ModelResponse | null>;
}

/**
 * ストリーミングレスポンスハンドラ
 */
export interface StreamResponseHandler {
  /**
   * チャンク受信時のコールバック
   * @param chunk テキストチャンク
   */
  onChunk: (chunk: string) => void;

  /**
   * エラー発生時のコールバック
   * @param error エラーオブジェクト
   */
  onError: (error: Error) => void;

  /**
   * 完了時のコールバック
   * @param response 最終的なレスポンス
   */
  onComplete: (response: ModelResponse) => void;
}

export default IAIModel; 