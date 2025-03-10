import { IAIModel } from '../../models/interfaces/ai-model';
import { ModelResponse } from '../../utils/types';
import { ModelSelector } from '../../models/selector';
import { EnvManager } from '../../config/env-manager';

/**
 * AI要約のオプション
 */
export interface SummarizerOptions {
  /**
   * 要約の最大長（トークン数またはおおよその文字数）
   * @default 1000
   */
  maxSummaryLength?: number;

  /**
   * 使用するAIモデル名（未指定の場合はデフォルトモデルを使用）
   */
  modelName?: string;

  /**
   * 要約の詳細度
   * 'brief': 簡潔な要約（デフォルト）
   * 'detailed': 詳細な要約
   * 'comprehensive': 包括的な要約
   * @default 'brief'
   */
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
}

/**
 * AIを活用したコンテンツ要約クラス
 */
export class AISummarizer {
  private model: IAIModel;
  private envManager: EnvManager;

  /**
   * 要約生成クラスのコンストラクタ
   * @param modelName 使用するモデル名（未指定の場合はデフォルトモデルを使用）
   */
  constructor(modelName?: string) {
    this.envManager = EnvManager.getInstance();
    const selector = new ModelSelector();
    this.model = selector.getModel(modelName || '');
  }

  /**
   * コンテンツの要約を生成する
   * @param content 要約対象のコンテンツ
   * @param options 要約オプション
   * @returns 生成された要約
   */
  async summarize(content: string, options: SummarizerOptions = {}): Promise<string> {
    // オプションのデフォルト値を設定
    const maxLength = options.maxSummaryLength || 1000;
    const detailLevel = options.detailLevel || 'brief';

    // コンテンツが短い場合はそのまま返す
    if (content.length <= maxLength) {
      return content;
    }

    // 要約のためのプロンプトを作成
    const prompt = this.createSummarizationPrompt(content, detailLevel, maxLength);

    try {
      // AIモデルを使って要約を生成
      const response = await this.model.generateText(prompt);
      return this.postProcessSummary(response);
    } catch (error) {
      console.error('要約生成中にエラーが発生しました:', error);
      
      // エラー時はフォールバックとして簡易的な要約を生成
      return this.createFallbackSummary(content, maxLength);
    }
  }

  /**
   * 要約用のプロンプトを作成する
   * @param content 要約対象のコンテンツ
   * @param detailLevel 詳細度
   * @param maxLength 最大長
   * @returns プロンプト
   */
  private createSummarizationPrompt(
    content: string, 
    detailLevel: 'brief' | 'detailed' | 'comprehensive',
    maxLength: number
  ): string {
    let instructionPrefix: string;
    
    switch (detailLevel) {
      case 'brief':
        instructionPrefix = '以下のテキストを簡潔に要約してください。主要なポイントのみを抽出し、約';
        break;
      case 'detailed':
        instructionPrefix = '以下のテキストを詳細に要約してください。重要な情報を保持しながら、約';
        break;
      case 'comprehensive':
        instructionPrefix = '以下のテキストを包括的に要約してください。重要な詳細をすべて含めながら、約';
        break;
      default:
        instructionPrefix = '以下のテキストを要約してください。約';
    }

    return `${instructionPrefix}${maxLength}文字以内にまとめてください。

===== テキスト =====
${content}
=================

要約:`;
  }

  /**
   * 生成された要約を後処理する
   * @param rawResponse AIモデルからの生の応答
   * @returns 処理後の要約
   */
  private postProcessSummary(rawResponse: ModelResponse): string {
    // ModelResponseからテキストを抽出
    const rawSummary = typeof rawResponse === 'string' 
      ? rawResponse 
      : rawResponse.text || '';
    
    // 余分なプレフィックスの削除
    let processedSummary = rawSummary
      .replace(/^(要約:|Summary:|はじめに|概要:|まとめ:)/i, '')
      .trim();
    
    // 整形
    return processedSummary;
  }

  /**
   * フォールバック用の簡易要約を生成
   * @param content 元のコンテンツ
   * @param maxLength 最大長
   * @returns 簡易要約
   */
  private createFallbackSummary(content: string, maxLength: number): string {
    // 段落に分割
    const paragraphs = content.split(/\n\n+/);
    let summary = '';
    
    // 最初の数段落を抽出
    for (const paragraph of paragraphs) {
      if (!paragraph.trim() || paragraph.trim().length < 10) {
        continue;
      }
      
      if ((summary.length + paragraph.length) > maxLength) {
        const remainingChars = maxLength - summary.length - 3;
        if (remainingChars > 20) {
          summary += paragraph.substring(0, remainingChars) + '...';
        }
        break;
      }
      
      summary += paragraph + '\n\n';
    }
    
    return summary.trim();
  }
} 