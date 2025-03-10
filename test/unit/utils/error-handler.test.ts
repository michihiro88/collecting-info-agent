import { AppError, ErrorCode, handleGlobalError } from '../../../src/utils/error-handler';

// ログ関数をモック化
jest.mock('../../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
import logger from '../../../src/utils/logger';

describe('エラーハンドラーユーティリティ', () => {
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
  });
  
  describe('AppError', () => {
    test('正しくインスタンス化される', () => {
      const details = { key: 'value' };
      const error = new AppError('テストエラー', ErrorCode.INVALID_URL, details);
      
      expect(error.name).toBe('AppError');
      expect(error.code).toBe(ErrorCode.INVALID_URL);
      expect(error.message).toBe('テストエラー');
      expect(error.details).toEqual(details);
    });
    
    test('toJSON メソッドがエラー情報を正しく返す', () => {
      const details = { key: 'value' };
      const error = new AppError('ネットワークエラー', ErrorCode.NETWORK_ERROR, details);
      const jsonObj = error.toJSON();
      
      // stackプロパティを除外して比較
      const { stack, ...restOfJson } = jsonObj as any;
      
      expect(restOfJson).toEqual({
        name: 'AppError',
        code: ErrorCode.NETWORK_ERROR,
        message: 'ネットワークエラー',
        details: details
      });
    });
  });
  
  describe('handleGlobalError', () => {
    test('AppErrorを適切に処理する', () => {
      const appError = new AppError('プロセスエラー', ErrorCode.PROCESS_ERROR, { process: 'test' });
      handleGlobalError(appError);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('アプリケーションエラー'),
        expect.objectContaining({
          code: ErrorCode.PROCESS_ERROR,
          message: 'プロセスエラー',
          details: { process: 'test' }
        })
      );
    });
    
    test('一般的なErrorを適切に処理する', () => {
      const error = new Error('一般的なエラー');
      handleGlobalError(error);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('アプリケーションエラー'),
        expect.objectContaining({
          code: ErrorCode.UNKNOWN_ERROR,
          message: '一般的なエラー'
        })
      );
    });
    
    test('エラーでない値を適切に処理する', () => {
      const nonError = { message: '不正なオブジェクト' };
      handleGlobalError(nonError);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('アプリケーションエラー'),
        expect.objectContaining({
          code: ErrorCode.UNKNOWN_ERROR,
          message: '不明なエラーが発生しました',
          details: expect.objectContaining({
            originalError: nonError
          })
        })
      );
    });
  });
}); 