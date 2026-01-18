import { QuotaProvider } from '../../types';
import { AnthropicProvider } from './anthropic';
import { GLMProvider } from './glm';

/**
 * Provider registry
 */
export class ProviderRegistry {
  private providers: Map<string, QuotaProvider> = new Map();
  private initializationPromise?: Promise<void>;

  constructor() {
    this.initializationPromise = this.registerDefaultProviders();
  }

  /**
   * Register default providers (async)
   */
  private async registerDefaultProviders(): Promise<void> {
    const providers = [
      new AnthropicProvider(),
      new GLMProvider()
    ];

    const results = await Promise.all(
      providers.map(async p => ({
        provider: p,
        configured: await p.isConfigured()
      }))
    );

    results.forEach(({ provider, configured }) => {
      if (configured) {
        this.register(provider);
        console.log(`[ProviderRegistry] Registered: ${provider.getName()}`);
      }
    });

    console.log(`[ProviderRegistry] Total providers: ${this.providers.size}`);
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  /**
   * Register a provider
   */
  register(provider: QuotaProvider): void {
    this.providers.set(provider.getName(), provider);
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Get all providers
   */
  getAll(): QuotaProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get a specific provider
   */
  get(name: string): QuotaProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get configured providers
   */
  async getConfigured(): Promise<QuotaProvider[]> {
    const providers: QuotaProvider[] = [];
    for (const provider of this.providers.values()) {
      if (await provider.isConfigured()) {
        providers.push(provider);
      }
    }
    return providers;
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

// Export individual providers
export { AnthropicProvider, GLMProvider };
