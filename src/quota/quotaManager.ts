import * as vscode from 'vscode';
import { QuotaStatus } from '../types';
import { providerRegistry } from './providers';

/**
 * Quota manager - handles quota monitoring and caching
 */
export class QuotaManager {
  private quotaStatus: QuotaStatus[] = [];
  private refreshTimer?: NodeJS.Timeout;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private lastRefresh: number = 0;
  private quotaUpdateCallback?: (quota: QuotaStatus[]) => void;

  constructor(private context: vscode.ExtensionContext) {
    this.loadFromCache();
    this.startAutoRefresh();
  }

  /**
   * Get current quota status
   */
  async getQuotaStatus(refresh = false): Promise<QuotaStatus[]> {
    // Wait for provider registration to complete
    await providerRegistry.waitForInitialization();

    if (!refresh && this.isCacheValid()) {
      return this.quotaStatus;
    }

    await this.refreshQuota();
    return this.quotaStatus;
  }

  /**
   * Refresh quota from all providers
   */
  async refreshQuota(): Promise<void> {
    const providers = providerRegistry.getAll();
    const results: QuotaStatus[] = [];
    const now = new Date();

    for (const provider of providers) {
      try {
        const status = await provider.getQuota();
        status.updatedAt = now;
        results.push(status);
      } catch (error) {
        // Add error status
        results.push({
          provider: provider.getName(),
          used: 0,
          limit: 0,
          percentage: 0,
          currency: 'tokens',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: now
        });
      }
    }

    this.quotaStatus = results;
    this.lastRefresh = Date.now();
    this.saveToCache();

    // Notify webview if active
    this.notifyWebview();
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastRefresh < this.CACHE_DURATION;
  }

  /**
   * Load quota from cache
   */
  private loadFromCache(): void {
    try {
      const cached = this.context.globalState.get<QuotaStatus[]>('quotaCache');
      if (cached) {
        this.quotaStatus = cached;
      }
    } catch (error) {
      console.error('Failed to load quota from cache:', error);
    }
  }

  /**
   * Save quota to cache
   */
  private saveToCache(): void {
    try {
      this.context.globalState.update('quotaCache', this.quotaStatus);
    } catch (error) {
      console.error('Failed to save quota to cache:', error);
    }
  }

  /**
   * Start auto refresh timer
   */
  private startAutoRefresh(): void {
    const config = vscode.workspace.getConfiguration('claudeMonitor');
    const intervalSeconds = config.get<number>('autoRefreshIntervalSeconds', 30);
    const interval = intervalSeconds * 1000;

    this.refreshTimer = setInterval(() => {
      this.refreshQuota();
    }, interval);
  }

  /**
   * Stop auto refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Notify webview to update
   */
  private notifyWebview(): void {
    if (this.quotaUpdateCallback) {
      this.quotaUpdateCallback(this.quotaStatus);
    }
  }

  /**
   * Set callback for quota updates
   */
  onQuotaUpdate(callback: (quota: QuotaStatus[]) => void): void {
    this.quotaUpdateCallback = callback;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.stopAutoRefresh();
  }
}
