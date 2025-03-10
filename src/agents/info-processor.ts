import { getModelSelector } from '../models/selector';
import { getConfigLoader } from '../config/config-loader';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-handler';
import { SearchResult, OutputFormat } from '../utils/types';

/**
 * 情報処理エージェント
 * 収集した情報を分析し、構造化するエージェント
 */
export class InfoProcessorAgent {
  private config = getConfigLoader().getConfig();
  private modelSelector = getModelSelector();

  /**
   * 収集した検索結果とコンテンツを処理し、整形された回答を生成
   * @param query ユーザーの質問/クエリ
   * @param searchResults 検索結果の配列
   * @param modelName 使用するモデル名 (オプション)
   * @param outputFormat 出力形式 (デフォルト: OutputFormat.MARKDOWN)
   */
  public async processResults(
    query: string,
    searchResults: SearchResult[],
    modelName?: string,
    outputFormat: OutputFormat = OutputFormat.MARKDOWN
  ): Promise<string> {
    try {
      logger.info('検索結果の処理を開始します', { 
        query, 
        resultsCount: searchResults.length,
        modelName,
        outputFormat
      });

      // 検索結果が空の場合
      if (searchResults.length === 0) {
        return '検索結果はありませんでした。別のクエリで試してみてください。';
      }

      // 検索結果からコンテキストを作成
      const context = this.buildContext(searchResults);
      
      // モデルの選択
      const model = modelName
        ? this.modelSelector.getModel(modelName)
        : this.modelSelector.getDefaultModel();
      
      logger.info(`モデル ${model.id} を使用して情報を処理します`);

      // 指定された形式に合わせたプロンプト作成
      const prompt = this.createPrompt(query, context, outputFormat);
      
      // AIモデルを使用して分析と回答を生成
      const response = await model.generateText(prompt);

      logger.info('結果処理が完了しました', {
        modelId: model.id,
        tokensUsed: response.usage.totalTokens,
        processingTime: response.metadata.processingTime,
      });

      return response.text;
    } catch (error) {
      if (error instanceof AppError) {
        logger.error('結果処理中にエラーが発生しました', { error });
        throw error;
      }

      const appError = new AppError(
        '情報処理中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error, query }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * 特定トピックについての情報を要約する
   * @param content 要約するコンテンツ
   * @param modelName 使用するモデル名 (オプション)
   * @param maxLength 最大要約文字数 (デフォルト: 1000)
   */
  public async summarize(
    content: string,
    modelName?: string,
    maxLength: number = 1000
  ): Promise<string> {
    try {
      logger.info('コンテンツの要約を開始します', { 
        contentLength: content.length,
        maxLength,
        modelName
      });

      if (content.length === 0) {
        return '要約するコンテンツがありません。';
      }

      // モデルの選択
      const model = modelName
        ? this.modelSelector.getModel(modelName)
        : this.modelSelector.getDefaultModel();
      
      // 要約プロンプトの作成
      const prompt = `以下のテキストを、重要なポイントと情報を保持しつつ、最大${maxLength}文字程度に要約してください。

テキスト:
${content}

要約:`;

      // AIモデルを使用して要約を生成
      const response = await model.generateText(prompt);

      logger.info('要約が完了しました', {
        originalLength: content.length,
        summaryLength: response.text.length,
        tokensUsed: response.usage.totalTokens
      });

      return response.text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        'テキスト要約中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error, contentLength: content.length }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * 検索結果から重要な情報を抽出しファクトチェック
   * @param query 元のクエリ
   * @param searchResults 検索結果の配列
   * @param modelName 使用するモデル名 (オプション)
   */
  public async extractKeyFacts(
    query: string,
    searchResults: SearchResult[],
    modelName?: string
  ): Promise<{ facts: string[]; sources: string[] }> {
    try {
      logger.info('重要なファクトの抽出を開始します', { 
        query, 
        resultsCount: searchResults.length 
      });

      if (searchResults.length === 0) {
        return { facts: [], sources: [] };
      }

      // 検索結果からコンテキストを作成
      const context = this.buildContext(searchResults);
      
      // モデルの選択
      const model = modelName
        ? this.modelSelector.getModel(modelName)
        : this.modelSelector.getDefaultModel();
      
      // ファクト抽出用プロンプトの作成
      const prompt = `質問「${query}」に関連する以下の情報源から、重要な事実を抽出し、信頼性を評価してください。
各事実について、情報源の番号を参照して出典を明記してください。
矛盾する情報がある場合は、その矛盾点を指摘し、より信頼性の高い情報を優先してください。

情報源:
${context}

出力形式:
{
  "facts": [
    "事実1 [出典: 1]",
    "事実2 [出典: 2, 3]",
    ...
  ],
  "reliability": "情報源全体の信頼性評価（高/中/低）と理由"
}`;

      // AIモデルを使用してファクト抽出を実行
      const response = await model.generateText(prompt);

      // 結果をパースして返却
      try {
        // JSONレスポンスの抽出（コードブロック内のJSONを探す）
        const jsonMatch = response.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                          response.text.match(/(\{[\s\S]*?\})/);
        
        if (jsonMatch && jsonMatch[1]) {
          const result = JSON.parse(jsonMatch[1]);
          return { 
            facts: result.facts || [], 
            sources: searchResults.map(r => r.url)
          };
        }
        
        // JSONとして解析できない場合は、テキストをそのまま返す
        return { 
          facts: [response.text], 
          sources: searchResults.map(r => r.url)
        };
      } catch (parseError) {
        logger.warn('ファクト抽出結果のパースに失敗しました', { parseError });
        return { 
          facts: [response.text], 
          sources: searchResults.map(r => r.url)
        };
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const appError = new AppError(
        'ファクト抽出中にエラーが発生しました',
        ErrorCode.PROCESS_ERROR,
        { error, query }
      );
      
      logger.error(appError.message, { error });
      throw appError;
    }
  }

  /**
   * 検索結果からコンテキストを構築
   * @param searchResults 検索結果の配列
   */
  private buildContext(searchResults: SearchResult[]): string {
    let context = '';
    
    searchResults.forEach((result, index) => {
      const snippet = result.snippet || result.content.substring(0, 200) + '...';
      context += `[${index + 1}] タイトル: ${result.title}\n`;
      context += `URL: ${result.url}\n`;
      context += `内容: ${snippet}\n\n`;
    });
    
    return context;
  }

  /**
   * 出力形式に基づいたプロンプトを作成
   * @param query ユーザーの質問/クエリ
   * @param context 検索結果から構築されたコンテキスト
   * @param outputFormat 出力形式
   */
  private createPrompt(
    query: string,
    context: string,
    outputFormat: OutputFormat
  ): string {
    let formatInstructions = '';
    
    switch (outputFormat) {
      case OutputFormat.MARKDOWN:
        formatInstructions = '回答はMarkdown形式で、見出し、箇条書き、強調などを適切に使用してください。';
        break;
      case OutputFormat.HTML:
        formatInstructions = '回答はHTML形式で、適切なタグ（見出し、段落、リストなど）を使用してください。';
        break;
      case OutputFormat.JSON:
        formatInstructions = '回答はJSON形式で、{"answer": "...", "sources": [...]}の構造で返してください。';
        break;
      case OutputFormat.TEXT:
      default:
        formatInstructions = '回答はプレーンテキスト形式でシンプルに返してください。';
        break;
    }
    
    return `以下の質問に対して、提供された情報源を基に包括的で正確な回答を作成してください:

質問: ${query}

情報源:
${context}

回答の要件:
1. 提供された情報源のみに基づいて回答を作成してください。
2. 情報源から得られない情報については、明確に「提供された情報からは分かりません」と述べてください。
3. 矛盾する情報がある場合は、その点を指摘し、より信頼できる情報を優先してください。
4. 回答内で引用する場合は、情報源の番号を[1]のように参照してください。
5. ${formatInstructions}
6. 最後に、使用した情報源の一覧を提供してください。

回答:`;
  }
}

/**
 * 情報処理エージェントのシングルトンインスタンス
 */
let infoProcessorAgentInstance: InfoProcessorAgent | null = null;

/**
 * 情報処理エージェントのインスタンスを取得
 */
export function getInfoProcessorAgent(): InfoProcessorAgent {
  if (!infoProcessorAgentInstance) {
    infoProcessorAgentInstance = new InfoProcessorAgent();
  }
  return infoProcessorAgentInstance;
}

export default { InfoProcessorAgent, getInfoProcessorAgent }; 