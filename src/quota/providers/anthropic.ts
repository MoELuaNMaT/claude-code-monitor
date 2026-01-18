import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { TokenBasedProvider } from './base';
import { QuotaStatus } from '../../types';

/**
 * Anthropic quota provider
 *
 * Token limits based on Anthropic's pricing tiers:
 * - Free: 50,000 tokens/month
 * - Pro: 5,000,000 tokens/month
 * - Team: 20,000,000 tokens/month
 */
export class AnthropicProvider extends TokenBasedProvider {
  private readonly PLAN_LIMITS: Record<string, number> = {
    'free': 50000,
    'pro': 5000000,
    'team': 20000000
  };

  private claudeConfigPath: string;
  private historyPath: string;

  constructor() {
    super();

    // Get Claude Code config paths
    const homeDir = os.homedir();
    this.claudeConfigPath = path.join(homeDir, '.claude', 'settings.json');
    this.historyPath = path.join(homeDir, '.claude', 'history.jsonl');
  }

  getName(): string {
    return 'Anthropic';
  }

  /**
   * Get API key from Claude Code configuration
   */
  protected async getApiKey(): Promise<string | undefined> {
    return this.getApiKeyFromSources('ANTHROPIC_AUTH_TOKEN', 'apiKey');
  }

  /**
   * Get token limit based on subscription tier
   */
  protected getTokenLimit(): number {
    // Default to Pro tier (most common)
    // TODO: Detect actual tier from API key
    return this.PLAN_LIMITS['pro'];
  }

  /**
   * Get quota status
   */
  async getQuota(): Promise<QuotaStatus> {
    try {
      // Check if configured
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return {
          provider: this.getName(),
          used: 0,
          limit: this.getTokenLimit(),
          percentage: 0,
          currency: 'tokens',
          error: 'API key not configured'
        };
      }

      // Calculate from history file
      const { used, limit } = await this.calculateFromHistory(this.historyPath);

      // Try to get current month usage from API
      // Note: Anthropic doesn't have a public usage API, so we rely on history
      const percentage = this.calculatePercentage(used, limit);

      return {
        provider: this.getName(),
        used,
        limit,
        percentage,
        currency: 'tokens',
        resetDate: this.getNextMonthDate()
      };
    } catch (error) {
      return {
        provider: this.getName(),
        used: 0,
        limit: this.getTokenLimit(),
        percentage: 0,
        currency: 'tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if provider is configured
   * Only requires API key (usage history is optional)
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await this.getApiKey();

    // ⭐ Only check for API key presence
    // No longer require usage history - new users with API keys should see quota
    return !!apiKey;
  }

  /**
   * Get next month's date for reset
   */
  private getNextMonthDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  /**
   * Estimate subscription tier from API key
   * This is a heuristic and may not be accurate
   */
  private async detectTier(): Promise<string> {
    // API key format: sk-ant-...
    // We can't determine tier from key alone
    // Default to 'pro' for now
    return 'pro';
  }
}
