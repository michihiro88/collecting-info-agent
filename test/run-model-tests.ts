/**
 * 情報収集エージェント - モデル機能テスト実行スクリプト
 * 
 * このスクリプトは実装されたAIモデル機能のテストを実行し、結果をレポートします。
 */

import { ModelSelector, getModelSelector } from '../src/models/selector';
import { ModelProvider, ModelResponse } from '../src/utils/types';
import { mockSearchResults } from './mocks/runtime-models';
import dotenv from 'dotenv';
import logger from '../src/utils/logger';
import fs from 'fs';
import path from 'path';
import * as configLoaderModule from '../src/config/config-loader';

// 環境変数を読み込む
dotenv.config();

// ConfigLoaderをモック
const mockConfigLoader = {
  getConfig: () => ({
    general: {
      workspace: './test-workspace',
      cacheDir: './test-cache',
      reportDir: './test-reports',
      maxConcurrentTasks: 2
    },
    models: {
      default: 'claude-3-sonnet',
      available: [
        { 
          name: 'claude-3-sonnet', 
          provider: ModelProvider.ANTHROPIC, 
          apiKeyEnv: 'ANTHROPIC_API_KEY',
          maxTokens: 4000,
          temperature: 0.7
        },
        { 
          name: 'gpt-4', 
          provider: ModelProvider.OPENAI, 
          apiKeyEnv: 'OPENAI_API_KEY',
          maxTokens: 4000,
          temperature: 0.7
        },
        { 
          name: 'gemini-pro', 
          provider: ModelProvider.GOOGLE, 
          apiKeyEnv: 'GOOGLE_API_KEY',
          maxTokens: 4000,
          temperature: 0.7
        }
      ]
    },
    search: {
      maxResults: 5,
      defaultEngine: 'google',
      userAgent: 'TestAgent/1.0',
      rateLimit: {
        requestsPerMinute: 5,
        parallelRequests: 1
      }
    },
    logging: {
      level: 'info',
      file: './logs/app.log',
      maxSize: 1000000,
      maxFiles: 2,
      chatLog: './logs/chat.log'
    }
  })
};

// getConfigLoaderをモック
const originalGetConfigLoader = configLoaderModule.getConfigLoader;
(configLoaderModule.getConfigLoader as any) = () => mockConfigLoader;

// モデルセレクタのシングルトンをリセット
(global as any).__modelSelectorInstance = null;

// レポートディレクトリを作成
const REPORT_DIR = path.join(process.cwd(), 'test-reports');
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// テスト設定
const TEST_PROMPT = 'これは情報収集エージェントのテストプロンプトです。このプロンプトを使用してAIモデルのレスポンスをテストします。';
const TEST_CONTEXT_PROMPT = '次の情報を参考にして、日本の気候変動対策について要約してください。';

/**
 * モデルのテキスト生成機能をテスト
 */
async function testGenerateText(modelName: string) {
  try {
    console.log(`\n=== ${modelName}のテキスト生成テスト ===`);
    const modelSelector = getModelSelector();
    const model = modelSelector.getModel(modelName);
    
    console.log(`モデル: ${model.id} (${model.provider})`);
    
    if (!model.isConfigured()) {
      console.log('APIキーが設定されていないため、テストをスキップします。');
      return null;
    }
    
    console.log('プロンプト:', TEST_PROMPT);
    const response = await model.generateText(TEST_PROMPT);
    console.log('レスポンス:', (response as ModelResponse).text.substring(0, 100) + '...');
    console.log('トークン使用量:', (response as ModelResponse).usage);
    console.log('処理時間:', (response as ModelResponse).metadata.processingTime, 'ms');
    
    return response;
  } catch (error) {
    console.error(`エラー (${modelName}):`);
    if (error instanceof Error) {
      console.error(' - メッセージ:', error.message);
      console.error(' - スタック:', error.stack);
    } else {
      console.error(error);
    }
    return null;
  }
}

/**
 * モデルのコンテキスト付きテキスト生成機能をテスト
 */
async function testGenerateWithContext(modelName: string) {
  try {
    console.log(`\n=== ${modelName}のコンテキスト付きテキスト生成テスト ===`);
    const modelSelector = getModelSelector();
    const model = modelSelector.getModel(modelName);
    
    console.log(`モデル: ${model.id} (${model.provider})`);
    
    if (!model.isConfigured()) {
      console.log('APIキーが設定されていないため、テストをスキップします。');
      return null;
    }
    
    console.log('プロンプト:', TEST_CONTEXT_PROMPT);
    console.log('コンテキスト数:', mockSearchResults.length);
    
    const response = await model.generateWithContext(TEST_CONTEXT_PROMPT, mockSearchResults);
    console.log('レスポンス:', (response as ModelResponse).text.substring(0, 100) + '...');
    console.log('トークン使用量:', (response as ModelResponse).usage);
    console.log('処理時間:', (response as ModelResponse).metadata.processingTime, 'ms');
    
    return response;
  } catch (error) {
    console.error(`エラー (${modelName} with context):`);
    if (error instanceof Error) {
      console.error(' - メッセージ:', error.message);
      console.error(' - スタック:', error.stack);
    } else {
      console.error(error);
    }
    return null;
  }
}

/**
 * ストリーミングテキスト生成をテスト
 */
async function testGenerateTextStream(modelName: string) {
  try {
    console.log(`\n=== ${modelName}のストリーミングテキスト生成テスト ===`);
    const modelSelector = getModelSelector();
    const model = modelSelector.getModel(modelName);
    
    console.log(`モデル: ${model.id} (${model.provider})`);
    
    if (!model.isConfigured()) {
      console.log('APIキーが設定されていないため、テストをスキップします。');
      return null;
    }
    
    console.log('プロンプト:', TEST_PROMPT);
    
    let fullText = '';
    let chunks = 0;
    let response: ModelResponse | null = null;
    
    await model.generateTextStream(TEST_PROMPT, {
      onChunk: (chunk: string) => {
        chunks++;
        fullText += chunk;
        process.stdout.write('.');
      },
      onComplete: (completeResponse: ModelResponse) => {
        process.stdout.write('\n');
        response = completeResponse;
      },
      onError: (error: Error) => {
        console.error('ストリーミングエラー:', error.message);
      }
    });
    
    if (response) {
      console.log('\nチャンク数:', chunks);
      console.log('合計テキスト長:', fullText.length);
      console.log('トークン使用量:', (response as ModelResponse).usage);
      console.log('処理時間:', (response as ModelResponse).metadata.processingTime, 'ms');
    }
    
    return response;
  } catch (error) {
    console.error(`エラー (${modelName} stream):`);
    if (error instanceof Error) {
      console.error(' - メッセージ:', error.message);
      console.error(' - スタック:', error.stack);
    } else {
      console.error(error);
    }
    return null;
  }
}

/**
 * 全モデルをテスト
 */
async function testAllModels() {
  try {
    const modelSelector = getModelSelector();
    const availableModels = modelSelector.getAvailableModelNames();
    
    console.log('=== 利用可能なモデル ===');
    console.log(availableModels);
    
    const results: Record<string, any> = {};
    
    for (const modelName of availableModels) {
      const modelResults: Record<string, any> = {};
      
      // テキスト生成テスト
      const textResponse = await testGenerateText(modelName);
      modelResults.generateText = textResponse ? 'SUCCESS' : 'FAILED';
      
      // コンテキスト付きテキスト生成テスト
      const contextResponse = await testGenerateWithContext(modelName);
      modelResults.generateWithContext = contextResponse ? 'SUCCESS' : 'FAILED';
      
      // ストリーミングテスト
      const streamResponse = await testGenerateTextStream(modelName);
      modelResults.generateTextStream = streamResponse ? 'SUCCESS' : 'FAILED';
      
      results[modelName] = modelResults;
    }
    
    // 結果の保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(REPORT_DIR, `model-test-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    console.log('\n=== テスト結果サマリー ===');
    console.log(JSON.stringify(results, null, 2));
    console.log(`\nレポートが保存されました: ${reportPath}`);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:');
    console.error(error);
  }
}

// メイン実行
console.log('情報収集エージェント - モデルテスト開始');
testAllModels().then(() => {
  console.log('テスト完了');
  process.exit(0);
}).catch(error => {
  console.error('テスト実行に失敗しました:', error);
  process.exit(1);
}); 