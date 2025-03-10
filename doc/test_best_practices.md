# TypeScript/Jestテストのベストプラクティス

このドキュメントでは、情報収集エージェントのテスト実装を通じて得られた知見とベストプラクティスをまとめています。これらの方法は、今後のテスト実装や保守の参考になります。

## 1. モックの効果的な利用

### 1.1 モックのインポート順序

```typescript
// 1. モックデータを先にインポート
import { mockAIModel } from '../../mocks/models';

// 2. 次に依存モジュールをモック化
jest.mock('../../../src/config/config-loader', () => ({
  getConfigLoader: jest.fn().mockReturnValue(mockConfigLoader)
}));

// 3. 最後に実際のモジュールをインポート
import { MainAgent } from '../../../src/agents/main-agent';
```

**理由**: Jestのモジュールモック化はインポート順序に影響されます。モックしたいモジュールを実際に使用するコードをインポートする前に、モックを設定しておく必要があります。

### 1.2 外部依存のモック化

```typescript
// HTTPリクエストのモック
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// テスト内で使用
mockedAxios.get.mockResolvedValue({ data: mockHtml });
```

**理由**: 外部APIや環境依存のあるコードをテストする場合、モックを使用することでテストの再現性と信頼性が向上します。

### 1.3 モックのリセット

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

**理由**: 各テスト間でモックの状態をリセットすることで、テスト間の干渉を防ぎます。

## 2. シングルトンのテスト

### 2.1 テスト後のインスタンスリセット

```typescript
afterEach(() => {
  // シングルトンインスタンスをリセット
  (MainAgent as any).mainAgentInstance = null;
});
```

**理由**: シングルトンパターンを使用しているクラスは、テスト間で状態が共有されるため、テスト後にリセットする必要があります。

### 2.2 シングルトン動作の検証

```typescript
test('常に同じインスタンスを返す', () => {
  const agent1 = getMainAgent();
  const agent2 = getMainAgent();
  expect(agent1).toBe(agent2);
});
```

**理由**: シングルトンパターンを使用しているクラスは、常に同じインスタンスを返すことを検証するテストが重要です。

## 3. エラー処理のテスト

### 3.1 例外のテスト (try-catch パターン)

```typescript
test('無効なURLを処理すると例外をスローする', async () => {
  try {
    await mainAgent.processUrl('invalid-url');
    fail('エラーが発生しませんでした');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.INVALID_URL);
  }
});
```

**理由**: try-catchを使うことで、例外の型や内容を詳細に検証できます。また、エラーが発生しなかった場合にテストを失敗させることができます。

### 3.2 非同期エラーのテスト (reject パターン)

```typescript
test('検索エラー時に適切に処理される', async () => {
  const searchError = new Error('検索エラー');
  getSearchAgent().search = jest.fn().mockRejectedValueOnce(searchError);
  
  await expect(standardProcessing('エラーテスト')).rejects.toThrow();
});
```

**理由**: Promiseのrejectionをテストする場合、expectのrejectsマッチャーを使用することで簡潔にテストできます。

## 4. プライベートメソッドのテスト

### 4.1 TypeScriptの型チェックを一時的に回避

```typescript
// @ts-ignore: テストのためprivateメソッドへアクセス
const context = infoProcessor.buildContext(mockSearchResults);
```

**理由**: プライベートメソッドをテストする場合、TypeScriptの型チェックを一時的に回避する必要があります。ただし、公開APIのテストを優先し、プライベートメソッドのテストは最小限にすべきです。

### 4.2 プライベートプロパティの変更

```typescript
beforeEach(() => {
  // @ts-ignore: テストのためprivateプロパティへアクセス
  searchAgent.validEngines = ['google', 'bing', 'duckduckgo', 'test-engine'];
});
```

**理由**: テストのためにプライベートプロパティを変更する場合も、TypeScriptの型チェックを一時的に回避する必要があります。

## 5. テストケースの構造化

### 5.1 describeによるグループ化

```typescript
describe('MainAgent', () => {
  describe('process', () => {
    test('デフォルトモデルで処理を実行する', async () => {
      // ...
    });
    
    test('指定されたモデルで処理を実行する', async () => {
      // ...
    });
  });
  
  describe('processUrl', () => {
    // ...
  });
});
```

**理由**: テストをdescribeブロックでグループ化することで、関連するテストがまとまり、可読性が向上します。

### 5.2 パラメータ化テスト

```typescript
const validUrls = [
  'https://example.com',
  'http://example.org/path',
  'https://sub.domain.co.jp/page?query=value'
];

test.each(validUrls)('有効なURL: %s', async (url) => {
  expect(mainAgent.isValidUrl(url)).toBe(true);
});
```

**理由**: 類似したテストケースを繰り返す場合、test.eachを使用することで、コードの重複を避けつつ、多くの入力パターンをテストできます。

## 6. モックの一時的な差し替え

```typescript
test('重要な事実を抽出する', async () => {
  // JSONレスポンスをモック
  const jsonResponse = {
    text: '```json\n{"facts":["事実1 [出典: 1]","事実2 [出典: 2]"],"reliability":"高"}\n```',
    usage: mockModelResponse.usage,
    metadata: mockModelResponse.metadata
  };
  
  const originalGenerateText = mockAIModel.generateText;
  mockAIModel.generateText = jest.fn().mockResolvedValueOnce(jsonResponse);
  
  // テスト実行
  const result = await infoProcessor.extractKeyFacts('テスト質問', mockSearchResults);
  
  // 検証
  expect(result).toEqual({
    facts: ["事実1 [出典: 1]", "事実2 [出典: 2]"],
    sources: mockSearchResults.map(r => r.url)
  });
  
  // モックを元に戻す
  mockAIModel.generateText = originalGenerateText;
});
```

**理由**: 特定のテストケースだけで異なる動作をモックする場合、元のモックを保存して一時的に上書きし、テスト後に元に戻す方法が効果的です。

## 7. 統合テストのアプローチ

### 7.1 コンポーネント間の統合

```typescript
async function standardProcessing(query: string): Promise<string> {
  const searchAgent = getSearchAgent();
  const infoProcessor = getInfoProcessorAgent();
  
  const searchResults = await searchAgent.search(query);
  const answer = await infoProcessor.processResults(query, searchResults);
  
  return answer;
}

test('情報収集フローが正しく動作する', async () => {
  const result = await standardProcessing('テスト質問');
  
  expect(getSearchAgent().search).toHaveBeenCalledWith('テスト質問');
  expect(getInfoProcessorAgent().processResults).toHaveBeenCalled();
  expect(result).toBeDefined();
});
```

**理由**: 統合テストでは、複数のコンポーネントが連携して動作することを検証します。各コンポーネントの呼び出しとデータの受け渡しが正しく行われることを確認します。

### 7.2 境界のモック化

```typescript
// エージェントをモック化
jest.mock('../../../src/agents/search-agent', () => ({
  getSearchAgent: jest.fn().mockReturnValue({
    search: jest.fn().mockResolvedValue(mockSearchResults)
  })
}));

jest.mock('../../../src/agents/info-processor', () => ({
  getInfoProcessorAgent: jest.fn().mockReturnValue({
    processResults: jest.fn().mockResolvedValue('処理結果テキスト')
  })
}));
```

**理由**: 統合テストでも、システムの境界（外部API、データベースなど）はモック化することで、テストの安定性と再現性を確保します。

## 8. テストの保守性向上のためのヒント

1. **テストコードも本番コードと同じ品質基準で書く**
   - コードの重複を避け、関数やヘルパーを適切に抽出する
   - 命名を明確にし、何をテストしているかわかりやすくする

2. **テストが失敗したときのメッセージを明確にする**
   - カスタムエラーメッセージを使用: `expect(value).toBe(expected, 'カスタムメッセージ')`
   - テスト前の状態や入力を明確にログに残す

3. **テストデータとセットアップを分離する**
   - テストデータは別ファイルに定義
   - 共通のセットアップロジックはbeforeEachやヘルパー関数に抽出

4. **過度なモックを避ける**
   - 実際の動作と大きく乖離するようなモックは避ける
   - 可能な限り実際のコードパスを通すテストを書く

5. **一貫性のあるパターンを使用する**
   - プロジェクト全体で一貫したテストパターンを使用
   - コーディング規約をテストコードにも適用する 