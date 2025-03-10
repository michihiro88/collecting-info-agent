export interface RateLimitOptions {
  maxRequests: number;       // 期間内に許可されるリクエスト数
  timeWindowMs: number;      // 時間枠（ミリ秒）
  retryAfterMs?: number;     // 制限超過時の再試行時間（ミリ秒）
}

export class RateLimiter {
  private providerLimits: Map<string, RateLimitOptions> = new Map();
  private providerRequestCounts: Map<string, number[]> = new Map();
  
  constructor() {
    // デフォルトのレート制限設定
    this.setProviderLimit('google', { maxRequests: 100, timeWindowMs: 60 * 60 * 1000 }); // 時間あたり100リクエスト
    // Bing検索は廃止されたため設定を削除
  }
  
  setProviderLimit(providerName: string, options: RateLimitOptions): void {
    this.providerLimits.set(providerName, options);
    this.providerRequestCounts.set(providerName, []);
  }
  
  async checkLimit(providerName: string): Promise<boolean> {
    const options = this.providerLimits.get(providerName);
    if (!options) {
      return true; // 制限が設定されていない場合は許可
    }
    
    const now = Date.now();
    let timestamps = this.providerRequestCounts.get(providerName) || [];
    
    // 時間枠内のリクエストのみをフィルタリング
    timestamps = timestamps.filter(timestamp => (now - timestamp) < options.timeWindowMs);
    
    if (timestamps.length >= options.maxRequests) {
      if (options.retryAfterMs) {
        // 指定された再試行時間後に再試行
        await new Promise(resolve => setTimeout(resolve, options.retryAfterMs));
        return this.checkLimit(providerName); // 再帰的に確認
      }
      return false; // 制限超過
    }
    
    // 新しいリクエストのタイムスタンプを追加
    timestamps.push(now);
    this.providerRequestCounts.set(providerName, timestamps);
    return true;
  }
  
  async acquirePermission(providerName: string): Promise<void> {
    const canProceed = await this.checkLimit(providerName);
    if (!canProceed) {
      const options = this.providerLimits.get(providerName);
      throw new Error(`Rate limit exceeded for ${providerName}. Try again after ${options?.retryAfterMs || 'some time'} ms.`);
    }
  }
  
  getRemainingRequests(providerName: string): number {
    const options = this.providerLimits.get(providerName);
    if (!options) {
      return Infinity; // 制限なし
    }
    
    const now = Date.now();
    const timestamps = this.providerRequestCounts.get(providerName) || [];
    const validTimestamps = timestamps.filter(timestamp => (now - timestamp) < options.timeWindowMs);
    
    return Math.max(0, options.maxRequests - validTimestamps.length);
  }
} 