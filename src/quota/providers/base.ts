import { QuotaProvider, QuotaStatus } from '../../types';

/**
 * Abstract base class for quota providers
 */
export abstract class BaseQuotaProvider implements QuotaProvider {
  protected apiKey?: string;
  protected configPath?: string;

  constructor(apiKey?: string, configPath?: string) {
    this.apiKey = apiKey;
    this.configPath = configPath;
  }

  abstract getName(): string;
  abstract getQuota(): Promise<QuotaStatus>;

  async isConfigured(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Calculate percentage
   */
  protected calculatePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.round((used / limit) * 100);
  }

  /**
   * Format number for display
   */
  protected formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  /**
   * Get API key from various sources
   */
  protected async getApiKeyFromSources(envVar: string, configKey?: string): Promise<string | undefined> {
    // Try environment variable first
    if (process.env[envVar]) {
      return process.env[envVar];
    }

    // Try config file if provided
    if (this.configPath && configKey) {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        const configContent = await fs.readFile(this.configPath, 'utf-8');
        const config = JSON.parse(configContent);
        return config[configKey];
      } catch (error) {
        // Config file doesn't exist or is invalid
        console.warn(`Failed to read config from ${this.configPath}:`, error);
      }
    }

    return undefined;
  }
}

/**
 * Base class for token-based providers
 */
export abstract class TokenBasedProvider extends BaseQuotaProvider {
  protected abstract getTokenLimit(): number;

  /**
   * Calculate quota status from token usage
   */
  protected async calculateFromHistory(
    historyPath: string,
    tokenMultiplier: number = 1
  ): Promise<{ used: number; limit: number }> {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(historyPath, 'utf-8');
      const lines = content.split('\n').filter((line: string) => line.trim());

      let totalTokens = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Count tokens from message content
          if (entry.message && entry.message.usage) {
            totalTokens += (entry.message.usage.input_tokens || 0) * tokenMultiplier;
            totalTokens += (entry.message.usage.output_tokens || 0) * tokenMultiplier;
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      return {
        used: totalTokens,
        limit: this.getTokenLimit()
      };
    } catch (error) {
      console.warn(`Failed to read history from ${historyPath}:`, error);
      return { used: 0, limit: this.getTokenLimit() };
    }
  }
}

/**
 * Base class for currency-based providers
 */
export abstract class CurrencyBasedProvider extends BaseQuotaProvider {
  protected abstract getCurrencyLimit(): number;
  protected abstract getCurrencySymbol(): string;

  /**
   * Calculate quota status from currency usage
   */
  protected calculateFromCurrency(spent: number): { used: number; limit: number; currency: string } {
    return {
      used: spent,
      limit: this.getCurrencyLimit(),
      currency: this.getCurrencySymbol()
    };
  }
}
