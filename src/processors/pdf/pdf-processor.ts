import { IContentProcessor, ContentMetadata, ProcessedContent, ContentProcessorOptions } from '../interfaces/content-processor';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as fs from 'fs';
import { AISummarizer } from '../ai/summarizer';

// PDFデータの型定義
interface PDFInfo {
  Title?: string;
  Author?: string;
  CreationDate?: string | Date;
  ModDate?: string | Date;
  Language?: string;
  [key: string]: any;
}

interface PDFData {
  text: string;
  info?: PDFInfo;
  metadata?: any;
  version?: string;
  numPages?: number;
}

/**
 * PDFコンテンツを処理するプロセッサークラス
 * 注: 実際のPDF処理には pdf.js または pdf-parse などのライブラリを使用します
 * 現在はスケルトン実装のみを提供しています
 */
export class PdfProcessor implements IContentProcessor {
  /**
   * PDFコンテンツを処理する
   * 
   * @param content PDF本文またはPDFファイルのバイナリデータ（Base64エンコード）
   * @param sourceUrl ソースURL（ローカルファイルの場合はファイルパス）
   * @param options 処理オプション
   */
  async process(content: string, sourceUrl: string, options: ContentProcessorOptions = {}): Promise<ProcessedContent> {
    const result: ProcessedContent = {
      content,
      metadata: {
        source: sourceUrl,
        contentType: 'application/pdf'
      }
    };
    
    try {
      // PDFデータ処理
      let pdfData: Buffer;
      
      // コンテンツがBase64またはバイナリの場合
      if (content.startsWith('%PDF') || /^[a-zA-Z0-9+/]*={0,2}$/.test(content)) {
        // Base64と思われるデータはデコード
        if (!/^%PDF/.test(content)) {
          pdfData = Buffer.from(content, 'base64');
        } else {
          pdfData = Buffer.from(content);
        }
      } 
      // ローカルファイルの場合
      else if (sourceUrl && fs.existsSync(sourceUrl)) {
        pdfData = fs.readFileSync(sourceUrl);
      }
      // その他の場合はエラー
      else {
        throw new Error('有効なPDFデータが見つかりません');
      }
      
      const parsedPdf = await pdfParse(pdfData);
      
      // 抽出したテキストをcontentとして設定
      result.content = parsedPdf.text;
      
      // メタデータの抽出（オプション）
      if (options.extractMetadata !== false) {
        result.metadata = await this.extractMetadata(parsedPdf, sourceUrl);
      }
      
      // コンテンツのクリーニング（オプション）
      if (options.cleanContent !== false) {
        result.cleanedContent = await this.cleanContent(parsedPdf.text);
      }
      
      // 要約の生成（オプション）
      if (options.generateSummary) {
        const contentToSummarize = result.cleanedContent || parsedPdf.text;
        result.summary = await this.summarize(contentToSummarize, options.maxSummaryLength);
      }
    } catch (error) {
      console.error('PDFの処理中にエラーが発生しました:', error);
      // エラーが発生した場合、元のコンテンツをそのまま返す
      if (options.cleanContent !== false) {
        result.cleanedContent = content;
      }
    }
    
    return result;
  }
  
  /**
   * PDFからメタデータを抽出する
   * 
   * @param content PDFコンテンツまたはパース済みPDF情報
   * @param sourceUrl ソースURL
   */
  async extractMetadata(content: string | PDFData, sourceUrl: string): Promise<ContentMetadata> {
    const metadata: ContentMetadata = {
      source: sourceUrl,
      contentType: 'application/pdf'
    };
    
    try {
      // PDFファイル名から基本的な情報を抽出
      if (sourceUrl) {
        const fileName = path.basename(sourceUrl);
        metadata.title = fileName.replace(/\.pdf$/i, '');
      }
      
      // パース済みPDFデータが渡された場合
      let parsedPdf: PDFData | null = null;
      
      if (typeof content !== 'string') {
        // すでにパース済みのPDFデータが渡された場合
        parsedPdf = content;
      } else if (content.startsWith('%PDF') || /^[a-zA-Z0-9+/]*={0,2}$/.test(content)) {
        // コンテンツがPDFバイナリまたはBase64の場合、パースを試みる
        try {
          let pdfData: Buffer;
          if (!/^%PDF/.test(content)) {
            pdfData = Buffer.from(content, 'base64');
          } else {
            pdfData = Buffer.from(content);
          }
          parsedPdf = await pdfParse(pdfData);
        } catch (e) {
          console.error('PDFのパースに失敗しました:', e);
        }
      }
      
      // PDFのメタデータを取得
      if (parsedPdf && parsedPdf.info) {
        const pdfInfo = parsedPdf.info;
        
        // タイトル
        if (pdfInfo.Title) {
          metadata.title = pdfInfo.Title;
        }
        
        // 著者
        if (pdfInfo.Author) {
          metadata.author = pdfInfo.Author;
        }
        
        // 作成日
        if (pdfInfo.CreationDate) {
          try {
            // PDFの日付形式（D:20200101120000+09'00'）を標準形式に変換
            const dateStr = pdfInfo.CreationDate.toString();
            if (dateStr.startsWith('D:')) {
              const year = dateStr.substring(2, 6);
              const month = dateStr.substring(6, 8);
              const day = dateStr.substring(8, 10);
              const hours = dateStr.substring(10, 12) || '00';
              const minutes = dateStr.substring(12, 14) || '00';
              const seconds = dateStr.substring(14, 16) || '00';
              
              metadata.publishedDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            } else {
              metadata.publishedDate = dateStr;
            }
          } catch (e) {
            // 日付の解析に失敗した場合、元の値をそのまま使用
            metadata.publishedDate = pdfInfo.CreationDate.toString();
          }
        }
        
        // 最終更新日
        if (pdfInfo.ModDate) {
          try {
            const dateStr = pdfInfo.ModDate.toString();
            if (dateStr.startsWith('D:')) {
              const year = dateStr.substring(2, 6);
              const month = dateStr.substring(6, 8);
              const day = dateStr.substring(8, 10);
              const hours = dateStr.substring(10, 12) || '00';
              const minutes = dateStr.substring(12, 14) || '00';
              const seconds = dateStr.substring(14, 16) || '00';
              
              metadata.lastModified = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            } else {
              metadata.lastModified = dateStr;
            }
          } catch (e) {
            metadata.lastModified = pdfInfo.ModDate.toString();
          }
        }
        
        // PDFの言語（存在する場合）
        if (pdfInfo.Language) {
          metadata.language = pdfInfo.Language;
        }
      }
      
      // PDFのバージョン情報
      if (parsedPdf && parsedPdf.version) {
        metadata.contentType = `application/pdf; version=${parsedPdf.version}`;
      }
      
    } catch (error) {
      console.error('PDFメタデータ抽出中にエラーが発生しました:', error);
    }
    
    return metadata;
  }
  
  /**
   * PDFコンテンツをクリーニングする
   * 余計なフォーマット情報を削除し、読みやすいテキストにする
   */
  async cleanContent(content: string): Promise<string> {
    try {
      // PDFから抽出したテキストには様々な問題がありうるので、それらを修正
      
      // 1. ページ番号と思われるパターンを削除（数字のみの行など）
      let cleaned = content.replace(/^\s*\d+\s*$/gm, '');
      
      // 2. ヘッダー/フッターと思われる繰り返しパターンを検出して削除
      // （同じ行が複数ページにわたって現れるパターンを検出）
      const lines = cleaned.split('\n');
      const lineFrequency: {[key: string]: number} = {};
      
      // 各行の出現頻度をカウント
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          lineFrequency[trimmedLine] = (lineFrequency[trimmedLine] || 0) + 1;
        }
      });
      
      // 高頻度で出現する短い行（ヘッダー/フッターの可能性が高い）を削除
      const pageCount = Math.ceil(lines.length / 30); // 概算ページ数（30行/ページと仮定）
      const repeatThreshold = Math.max(3, pageCount * 0.5); // 閾値：3回以上または推定ページ数の半分以上
      
      const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        // 空行は保持、短い行（60文字未満）かつ高頻度の行を削除
        return !trimmedLine || 
               trimmedLine.length > 60 || 
               (lineFrequency[trimmedLine] || 0) < repeatThreshold;
      });
      
      cleaned = filteredLines.join('\n');
      
      // 3. 不要な改行の処理（段落を適切に保持）
      // 文の途中での改行を結合（ピリオドやカンマで終わらない行）
      cleaned = cleaned.replace(/([^.!?,:;]\n)([a-z])/g, '$1 $2');
      
      // 4. 異常な空白や特殊文字の処理
      cleaned = cleaned
        .replace(/\f/g, '\n\n') // フォームフィード（ページ区切り）を段落区切りに変換
        .replace(/[\r\n]{3,}/g, '\n\n') // 複数の改行を2つに制限
        .replace(/\t/g, '    ') // タブを4スペースに変換
        .replace(/  +/g, ' ') // 複数の連続スペースを1つに変換
        .replace(/^\s+|\s+$/g, ''); // 前後の空白を削除
      
      return cleaned;
    } catch (error) {
      console.error('PDFコンテンツクリーニング中にエラーが発生しました:', error);
      return content; // エラー時は元のコンテンツを返す
    }
  }
  
  /**
   * コンテンツの要約を生成する
   * AI機能が有効な場合はAIモデルを使用、そうでない場合は単純な抽出を行う
   */
  async summarize(content: string, maxLength: number = 500): Promise<string> {
    // 環境変数SKIP_AI_SUMMARIZATION=trueの場合や、テスト環境ではAI要約をスキップ
    const skipAI = process.env.SKIP_AI_SUMMARIZATION === 'true' || process.env.NODE_ENV === 'test';
    
    if (!skipAI) {
      try {
        // AIを使った要約を試みる
        const summarizer = new AISummarizer();
        return await summarizer.summarize(content, {
          maxSummaryLength: maxLength,
          detailLevel: 'brief'
        });
      } catch (error) {
        console.warn('AI要約に失敗しました。フォールバック要約を使用します:', error);
      }
    }
    
    // AI要約に失敗した場合または環境変数でスキップ指定されている場合のフォールバック
    if (content.length <= maxLength) {
      return content;
    }
    
    // PDFの場合、目次や最初の部分が最も重要な場合が多いので、
    // 最初の部分を優先して抽出
    
    // 段落単位で区切り、最大長まで抽出
    const paragraphs = content.split(/\n\n+/);
    let summary = '';
    
    for (const paragraph of paragraphs) {
      // 段落が空または非常に短い場合（5文字未満）はスキップ
      if (!paragraph.trim() || paragraph.trim().length < 5) {
        continue;
      }
      
      if ((summary.length + paragraph.length + 2) > maxLength) {
        // 次の段落を追加すると最大長を超える場合
        // 現在の段落の一部だけを追加できるか確認
        const remainingChars = maxLength - summary.length - 4; // "..." の分も考慮
        if (remainingChars > 20) { // 最低20文字は追加する価値があると判断
          summary += paragraph.substring(0, remainingChars) + '...';
        }
        break;
      }
      
      summary += paragraph + '\n\n';
    }
    
    return summary.trim();
  }
} 