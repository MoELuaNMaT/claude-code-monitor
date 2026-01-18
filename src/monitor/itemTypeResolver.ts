import { PluginInfo, AgentInfo, SkillInfo } from '../types';

/**
 * Item Type Resolver
 *
 * Resolves to type of an item detected from terminal output (● name format)
 * by checking against installed plugins, skills, MCP tools and known agents.
 *
 * 优先级：格式前缀 > Map 缓存 > 固定优先级
 * - ● /name 优先判定为 Skill
 * - ● mcp-* 优先判定为 MCP
 * - 从 Map 缓存查找（支持同名不同类型）
 *
 * Priority: Format Prefix > Map Cache > Fixed Priority
 */

// Map 缓存结构，支持同名不同类型
interface ItemCacheEntry {
  id: string;           // 唯一标识（如 agent__bug-debugger）
  name: string;         // 显示名称
  type: 'mcp' | 'plugin' | 'skill' | 'agent';
  source: 'file' | 'builtin' | 'dynamic'; // 来源
  metadata?: Record<string, any>;
}

export class ItemTypeResolver {

  private cache: Map<string, ItemCacheEntry> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  constructor(
    private getPluginsCallback: () => Promise<PluginInfo[]>,
    private getAgentsCallback: () => Promise<AgentInfo[]>,
    private getSkillsCallback: () => Promise<SkillInfo[]>,
    private getMcpsCallback?: () => Promise<{ name: string }[]>
  ) {}

  /**
   * Resolve to type of an item from its name
   * @param name Item name (parsed from ● name format)
   * @returns 'mcp' | 'plugin' | 'skill' | 'agent' | 'unknown'
   */
  async resolveType(name: string): Promise<'mcp' | 'plugin' | 'skill' | 'agent' | 'unknown'> {
    await this.updateCacheIfNeeded();

    // 1. 优先检查格式前缀（最高优先级）
    if (name.startsWith('/')) {
      return 'skill';  // ● /name 格式
    }
    if (name.startsWith('mcp-')) {
      return 'mcp';  // ● mcp-* 格式
    }

    // 2. 从 Map 缓存查找（支持同名不同类型）
    const entries = Array.from(this.cache.values())
      .filter(e => e.name === name);

    if (entries.length === 1) {
      return entries[0].type;
    }

    if (entries.length > 1) {
      // 多个同名项，使用优先级回退策略
      // MCP > Plugin > Skill > Agent
      const mcpEntry = entries.find(e => e.type === 'mcp');
      if (mcpEntry) return 'mcp';

      const pluginEntry = entries.find(e => e.type === 'plugin');
      if (pluginEntry) return 'plugin';

      const skillEntry = entries.find(e => e.type === 'skill');
      if (skillEntry) return 'skill';

      const agentEntry = entries.find(e => e.type === 'agent');
      if (agentEntry) return 'agent';

      // 默认返回第一个的类型
      return entries[0].type;
    }

    return 'unknown';
  }

  /**
   * Update cache if needed
   */
  private async updateCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return; // Cache is still valid
    }

    // Clear existing cache to rebuild
    this.cache.clear();

    // Update MCP cache
    if (this.getMcpsCallback) {
      try {
        const mcps = await this.getMcpsCallback();
        for (const mcp of mcps) {
          this.cache.set(
            `mcp__${mcp.name}`,
            {
              id: `mcp__${mcp.name}`,
              name: mcp.name,
              type: 'mcp' as const,
              source: 'file',
              metadata: {}
            }
          );
        }
      } catch (error) {
        console.error('[ItemTypeResolver] Failed to update MCP cache:', error);
      }
    }

    // Update plugin cache
    try {
      const plugins = await this.getPluginsCallback();
      // 使用 Map 缓存替代 Set
      for (const plugin of plugins) {
        this.cache.set(
          `plugin__${plugin.name}`,
          {
            id: `plugin__${plugin.name}`,
            name: plugin.name,
            type: 'plugin' as const,
            source: 'file',
            metadata: { version: plugin.version, scope: plugin.scope }
          }
        );
      }
    } catch (error) {
      console.error('[ItemTypeResolver] Failed to update plugin cache:', error);
    }

    // Update skill cache
    try {
      const skills = await this.getSkillsCallback();
      for (const skill of skills) {
        this.cache.set(
          `skill__${skill.name}`,
          {
            id: `skill__${skill.name}`,
            name: skill.name,
            type: 'skill' as const,
            source: 'file',
            metadata: { category: skill.category }
          }
        );
      }
    } catch (error) {
      console.error('[ItemTypeResolver] Failed to update skill cache:', error);
    }

    // Update agent cache（使用新的 AgentDiscovery）
    try {
      const agents = await this.getAgentsCallback();
      for (const agent of agents) {
        this.cache.set(
          `agent__${agent.name}`,
          {
            id: `agent__${agent.name}`,
            name: agent.name,
            type: 'agent' as const,
            source: 'file',
            metadata: {
              model: agent.model,
              color: agent.color,
              category: agent.category,
              description: agent.description
            }
          }
        );
      }
    } catch (error) {
      console.error('[ItemTypeResolver] Failed to update agent cache:', error);
    }

    this.lastCacheUpdate = now;

    const mcpCount = Array.from(this.cache.values()).filter(e => e.type === 'mcp').length;
    const pluginCount = Array.from(this.cache.values()).filter(e => e.type === 'plugin').length;
    const skillCount = Array.from(this.cache.values()).filter(e => e.type === 'skill').length;
    const agentCount = Array.from(this.cache.values()).filter(e => e.type === 'agent').length;

    console.log(`[ItemTypeResolver] Cache updated: ${mcpCount} MCPs, ${pluginCount} plugins, ${skillCount} skills, ${agentCount} agents`);
  }

  /**
   * Get cached item by id
   */
  getCachedItem(id: string): ItemCacheEntry | undefined {
    return this.cache.get(id);
  }

  /**
   * Get all cached items of a specific type
   */
  getCachedItemsByType(type: 'mcp' | 'plugin' | 'skill' | 'agent'): ItemCacheEntry[] {
    return Array.from(this.cache.values()).filter(e => e.type === type);
  }

  /**
   * Get cached MCP names (for dynamic discovery)
   */
  getCachedMcps(): string[] {
    return Array.from(this.cache.values())
      .filter(e => e.type === 'mcp')
      .map(e => e.name);
  }

  /**
   * Get cached plugin names
   */
  getCachedPlugins(): string[] {
    return Array.from(this.cache.values())
      .filter(e => e.type === 'plugin')
      .map(e => e.name);
  }

  /**
   * Get cached skill names
   */
  getCachedSkills(): string[] {
    return Array.from(this.cache.values())
      .filter(e => e.type === 'skill')
      .map(e => e.name);
  }

  /**
   * Get cached agent names
   */
  getCachedAgents(): string[] {
    return Array.from(this.cache.values())
      .filter(e => e.type === 'agent')
      .map(e => e.name);
  }

  /**
   * Update dynamically discovered MCP servers
   * @param mcps Array of MCP server names discovered from terminal output
   */
  updateDynamicMcps(mcps: string[]): void {
    for (const mcp of mcps) {
      this.cache.set(
        `mcp__${mcp}`,
        {
          id: `mcp__${mcp}`,
          name: mcp,
          type: 'mcp' as const,
          source: 'dynamic',
          metadata: {}
        }
      );
    }
    console.log('[ItemTypeResolver] Dynamic MCPs updated:', mcps);
  }

  /**
   * Force refresh cache
   */
  async refreshCache(): Promise<void> {
    this.lastCacheUpdate = 0;
    await this.updateCacheIfNeeded();
  }
}
