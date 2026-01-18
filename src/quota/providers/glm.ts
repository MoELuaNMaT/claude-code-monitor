import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { BaseQuotaProvider } from './base';
import { QuotaStatus } from '../../types';

/**
 * GLM quota provider
 *
 * Supports:
 * - ZAI (api.z.ai)
 * - ZHIPU (open.bigmodel.cn, dev.bigmodel.cn)
 *
 * Quota types:
 * - TOKENS_LIMIT: Token usage
 * - TIME_LIMIT: MCP time usage
 */
export class GLMProvider extends BaseQuotaProvider {
  private baseUrl?: string;
  private authToken?: string;
  private platform?: 'ZAI' | 'ZHIPU';
  private configLoaded = false;

  constructor() {
    super();
    // loadConfigFromSettings will call detectPlatform() after loading config
    this.loadConfigFromSettings();
  }

  /**
   * Load configuration from settings.json
   */
  private async loadConfigFromSettings(): Promise<void> {
    if (this.configLoaded) {
      return;
    }

    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Read from env field
      if (settings.env) {
        this.baseUrl = settings.env.ANTHROPIC_BASE_URL;
        this.authToken = settings.env.ANTHROPIC_AUTH_TOKEN;
      }

      console.log('[GLMProvider] Config loaded:', {
        hasBaseUrl: !!this.baseUrl,
        hasAuthToken: !!this.authToken
      });

      // ⭐ Detect platform after config is loaded
      this.detectPlatform();

      console.log('[GLMProvider] Platform detected:', this.platform);
    } catch (error) {
      console.log('[GLMProvider] No settings file or error loading config:', error);
    }

    this.configLoaded = true;
  }

  getName(): string {
    return this.platform ? `GLM (${this.platform})` : 'GLM';
  }

  /**
   * Detect platform from base URL
   */
  private detectPlatform(): void {
    if (!this.baseUrl) {
      return;
    }

    if (this.baseUrl.includes('api.z.ai')) {
      this.platform = 'ZAI';
    } else if (this.baseUrl.includes('open.bigmodel.cn') || this.baseUrl.includes('dev.bigmodel.cn')) {
      this.platform = 'ZHIPU';
    }
  }

  /**
   * Check if provider is configured
   */
  async isConfigured(): Promise<boolean> {
    // Wait for config to load
    await this.loadConfigFromSettings();
    return !!(this.baseUrl && this.authToken && this.platform);
  }

  /**
   * Get quota status
   */
  async getQuota(): Promise<QuotaStatus> {
    try {
      // Check if configured
      if (!await this.isConfigured()) {
        return {
          provider: this.getName(),
          used: 0,
          limit: 0,
          percentage: 0,
          currency: 'tokens',
          error: 'GLM not configured (set ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN)'
        };
      }

      const quotaLimitUrl = this.getQuotaLimitUrl();
      const quotaData = await this.queryQuota(quotaLimitUrl);

      if (!quotaData) {
        return {
          provider: this.getName(),
          used: 0,
          limit: 0,
          percentage: 0,
          currency: 'tokens',
          error: 'Unable to fetch quota data'
        };
      }

      return {
        provider: this.getName(),
        used: quotaData.token.used,
        limit: quotaData.token.limit,
        percentage: quotaData.token.percentage,
        currency: 'tokens',
        resetDate: quotaData.token.resetDate
      };
    } catch (error) {
      return {
        provider: this.getName(),
        used: 0,
        limit: 0,
        percentage: 0,
        currency: 'tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get quota limit URL
   */
  private getQuotaLimitUrl(): string {
    if (!this.baseUrl) {
      throw new Error('Base URL not set');
    }

    const parsedBaseUrl = new URL(this.baseUrl);
    const baseDomain = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;
    return `${baseDomain}/api/monitor/usage/quota/limit`;
  }

  /**
   * Query quota from API
   */
  private queryQuota(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          'Authorization': this.authToken || '',
          'Accept-Language': 'en-US,en',
          'Content-Type': 'application/json'
        }
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }

          try {
            const json = JSON.parse(data);
            const processed = this.processQuotaLimit(json.data);
            resolve(processed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Process quota limit response
   */
  private processQuotaLimit(data: any): any {
    // 添加调试日志 - 查看 API 返回的完整字段
    console.log('[GLMProvider] Raw API response:', JSON.stringify(data, null, 2));

    if (!data || !data.limits) {
      return null;
    }

    const result = {
      token: { used: 0, limit: 0, percentage: 0, resetDate: undefined as Date | undefined },
      mcp: { used: 0, limit: 0, percentage: 0, details: [] }
    };

    data.limits.forEach((item: any) => {
      if (item.type === 'TOKENS_LIMIT') {
        result.token.percentage = item.percentage || 0;
        result.token.used = item.currentValue || 0;
        result.token.limit = item.usage || 0;

        // 尝试提取重置时间字段
        if (item.nextResetTime) {
          result.token.resetDate = new Date(item.nextResetTime);
          console.log('[GLMProvider] Found nextResetTime field:', item.nextResetTime, '->', result.token.resetDate);
        }
        if (item.resetTime) {
          result.token.resetDate = new Date(item.resetTime);
          console.log('[GLMProvider] Found resetTime field:', item.resetTime);
        }
        if (item.resetDate) {
          result.token.resetDate = new Date(item.resetDate);
          console.log('[GLMProvider] Found resetDate field:', item.resetDate);
        }
        if (item.cycle) {
          console.log('[GLMProvider] Cycle info:', item.cycle);
        }
      }
      if (item.type === 'TIME_LIMIT') {
        result.mcp.percentage = item.percentage || 0;
        result.mcp.used = item.currentValue || 0;
        result.mcp.limit = item.usage || 0;
        result.mcp.details = item.usageDetails || [];
      }
    });

    // 日志输出结果
    console.log('[GLMProvider] Processed quota:', JSON.stringify(result, null, 2));

    return result;
  }
}
