/**
 * 簡易URL処理テスト用スクリプト
 */
import axios from 'axios';
import { JSDOM } from 'jsdom';

async function main() {
  try {
    // コマンドライン引数を取得
    const url = process.argv[2];
    
    if (!url) {
      console.error('使用方法: node dist/test-simple-url.js "URL"');
      process.exit(1);
    }
    
    console.log(`URL: ${url}`);
    console.log('コンテンツ取得を開始します...');
    
    // URLからコンテンツを取得
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 10000, // 10秒タイムアウト
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    });
    
    // HTMLからテキストを抽出
    const dom = new JSDOM(response.data);
    const textContent = extractTextFromHtml(dom.window.document);
    
    const endTime = Date.now();
    
    console.log('\n--- 処理結果 ---\n');
    console.log(`タイトル: ${dom.window.document.title}`);
    console.log(`コンテンツ長: ${textContent.length}文字`);
    console.log('\n--- コンテンツ抜粋 (最初の500文字) ---\n');
    console.log(textContent.substring(0, 500) + '...');
    console.log('\n-----------------\n');
    
    console.log(`処理時間: ${(endTime - startTime) / 1000}秒`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

/**
 * HTMLからテキストを抽出
 * @param document HTMLドキュメント
 */
function extractTextFromHtml(document: Document): string {
  // 不要な要素を削除
  const elementsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'nav', 'footer', 
    'header', 'aside', 'svg', 'form', 'button', 'img'
  ];
  
  elementsToRemove.forEach(tag => {
    const elements = document.getElementsByTagName(tag);
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  });
  
  // 本文を取得
  const body = document.querySelector('body');
  if (!body) return '';
  
  // テキストコンテンツを取得して整形
  let text = body.textContent || '';
  
  // 余分な空白と改行を削除
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// メイン処理を実行
main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
}); 