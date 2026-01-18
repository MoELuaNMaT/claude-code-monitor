import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { McpToolItem, McpToolInfo, PluginInfo, SkillInfo } from '../types';

/**
 * ConfigReader - Read Claude Code configuration files
 */
export class ConfigReader {
  private readonly claudePath: string;

  constructor() {
    this.claudePath = path.join(os.homedir(), '.claude');
  }

  /**
   * Read local settings from multiple configuration files
   * Merges settings from project and global configs
   */
  async getLocalSettings(): Promise<any> {
    const mergedSettings: any = {
      permissions: { allow: [] }
    };

    // Configuration file paths in priority order
    // Project-specific configs take precedence over global configs
    const CONFIG_PATHS = [
      path.join(this.claudePath, '.claude', 'settings.json'),       // Project config
      path.join(this.claudePath, '.claude', 'settings.local.json'), // Project local config
      path.join(this.claudePath, 'settings.local.json')            // Global config
    ];

    for (const configPath of CONFIG_PATHS) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const settings = JSON.parse(content);

        // Merge permissions.allow array
        if (settings.permissions?.allow) {
          mergedSettings.permissions.allow.push(
            ...settings.permissions.allow
          );
        }

        console.log(`[ConfigReader] Loaded config: ${configPath}`);
      } catch (error) {
        // File doesn't exist or error reading, continue to next
        console.log(`[ConfigReader] Skipped config: ${configPath}`);
      }
    }

    // Deduplicate permissions
    mergedSettings.permissions.allow = [...new Set(mergedSettings.permissions.allow)];
    console.log(`[ConfigReader] Total permissions: ${mergedSettings.permissions.allow.length}`);

    return mergedSettings;
  }

  /**
   * Parse YAML front matter from SKILL.md
   * Extracts name and description fields
   */
  private parseSkillFrontMatter(content: string): { name?: string; description?: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontMatter = match[1];
    const result: any = {};

    // Simple YAML parser for name and description
    const nameMatch = frontMatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontMatter.match(/^description:\s*(.+)$/m);

    if (nameMatch) result.name = nameMatch[1].trim();
    if (descMatch) result.description = descMatch[1].trim();

    return result;
  }

  /**
   * Read sub-skills from marketplace.json
   * Supports both Type 1 (with skills array) and Type 2 (without skills array)
   */
  private async readSubSkillsFromMarketplace(
    marketplacePath: string,
    collection: string
  ): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    try {
      const content = await fs.readFile(marketplacePath, 'utf-8');
      const marketplace = JSON.parse(content);
      const pluginDir = path.dirname(marketplacePath);

      if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
        // Type 1: Has skills array
        for (const plugin of marketplace.plugins) {
          if (plugin.skills && Array.isArray(plugin.skills)) {
            for (const skillPath of plugin.skills) {
              const skillFullDir = path.join(pluginDir, skillPath);
              const skillMdPath = path.join(skillFullDir, 'SKILL.md');

              try {
                const content = await fs.readFile(skillMdPath, 'utf-8');
                const { name, description } = this.parseSkillFrontMatter(content);

                skills.push({
                  id: `skill__${name || skillPath}`,
                  name: name || skillPath,
                  description: description || '',
                  mdPath: skillMdPath,
                  installPath: skillFullDir
                });
              } catch (error) {
                console.log(`[ConfigReader] Failed to read skill: ${skillPath}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read marketplace.json:', error);
    }

    return skills;
  }

  /**
   * Read plugin info from a plugin directory
   */
  private async readPluginInfo(
    pluginPath: string,
    collection: string
  ): Promise<PluginInfo[]> {
    const results: PluginInfo[] = [];

    try {
      const marketplacePath = path.join(pluginPath, '.claude-plugin', 'marketplace.json');
      const hasMarketplace = await fs.access(marketplacePath).then(() => true).catch(() => false);

      if (hasMarketplace) {
        const content = await fs.readFile(marketplacePath, 'utf-8');
        const marketplace = JSON.parse(content);

        if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
          for (const plugin of marketplace.plugins) {
            results.push({
              id: `plugin__${plugin.name}`,
              name: plugin.name,
              description: plugin.description || '',
              version: marketplace.metadata?.version || 'unknown',
              scope: collection,
              installPath: pluginPath,
              isLocal: true
            });
          }
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read plugin info:', error);
    }

    return results;
  }

  /**
   * Read skills from a plugin's marketplace.json
   * Returns individual sub-skills with collection information
   */
  private async readSkillsFromPlugin(
    marketplacePath: string,
    collection: string,
    installPath: string
  ): Promise<PluginInfo[]> {
    const results: PluginInfo[] = [];

    try {
      const content = await fs.readFile(marketplacePath, 'utf-8');
      const marketplace = JSON.parse(content);

      if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
        for (const plugin of marketplace.plugins) {
          // For each sub-plugin, read its skills
          if (plugin.skills && Array.isArray(plugin.skills)) {
            for (const skillPath of plugin.skills) {
              const skillFullDir = path.join(installPath, skillPath);
              const skillMdPath = path.join(skillFullDir, 'SKILL.md');

              try {
                const content = await fs.readFile(skillMdPath, 'utf-8');
                const { name, description } = this.parseSkillFrontMatter(content);

                // Extract clean name from skillPath if name is not available
                // e.g., "./skills/xlsx" → "xlsx"
                const cleanName = name || path.basename(skillPath);

                results.push({
                  id: `plugin__${collection}__${cleanName}`,
                  name: cleanName,
                  description: description || plugin.description || '',
                  version: marketplace.metadata?.version || 'unknown',
                  scope: `${collection} > ${plugin.name}`,
                  installPath: skillFullDir,
                  isLocal: true,
                  isSubSkill: true
                });
              } catch (error) {
                console.log(`[ConfigReader] Failed to read skill: ${skillPath}`);
              }
            }
          }
          // If no skills array, treat the plugin itself as a skill
          else {
            results.push({
              id: `plugin__${plugin.name}`,
              name: plugin.name,
              description: plugin.description || '',
              version: marketplace.metadata?.version || 'unknown',
              scope: collection,
              installPath: installPath,
              isLocal: true
            });
          }
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read plugin marketplace.json:', error);
    }

    return results;
  }

  /**
   * Get installed plugins
   * Traverses ~/.claude/plugins/ directory
   */
  async getInstalledPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];
    const pluginsPath = path.join(this.claudePath, 'plugins');

    try {
      // Read installed_plugins.json if exists
      const installedJsonPath = path.join(pluginsPath, 'installed_plugins.json');
      const content = await fs.readFile(installedJsonPath, 'utf-8');
      const installed = JSON.parse(content);

      if (installed.plugins) {
        for (const [pluginKey, installations] of Object.entries(installed.plugins)) {
          const [collection, pluginName] = pluginKey.split('@');

          if (Array.isArray(installations)) {
            for (const inst of installations) {
              if (inst.installPath) {
                // Read marketplace.json to get skills
                const marketplacePath = path.join(inst.installPath, '.claude-plugin', 'marketplace.json');
                const subSkills = await this.readSkillsFromPlugin(marketplacePath, collection, inst.installPath);
                plugins.push(...subSkills);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read installed plugins:', error);
    }

    console.log('[ConfigReader] Parsed plugins (sub-skills):', plugins.length);
    return plugins;
  }

  /**
   * Read skills directly from ~/.claude/skills/ directory
   */
  private async readSkillsFromDirectory(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    const skillsPath = path.join(this.claudePath, 'skills');

    try {
      // Check if skills directory exists
      const stats = await fs.stat(skillsPath).catch(() => null);
      if (!stats || !stats.isDirectory()) {
        console.log('[ConfigReader] Skills directory does not exist:', skillsPath);
        return skills;
      }

      // Read directory entries
      const entries = await fs.readdir(skillsPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-directories and hidden directories
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }

        const skillPath = path.join(skillsPath, entry.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        try {
          // Check if SKILL.md exists
          const content = await fs.readFile(skillMdPath, 'utf-8');
          const { name, description } = this.parseSkillFrontMatter(content);

          skills.push({
            id: `skill__${name || entry.name}`,
            name: name || entry.name,
            description: description || '',
            mdPath: skillMdPath,
            installPath: skillPath
          });

          console.log(`[ConfigReader] Successfully read skill: ${entry.name}`);
        } catch (error) {
          // Silently skip skills without SKILL.md
          console.log(`[ConfigReader] Skipped skill (no SKILL.md): ${entry.name}`);
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read skills directory:', error);
    }

    console.log(`[ConfigReader] Read ${skills.length} skills from directory`);
    return skills;
  }

  /**
   * Get available skills from installed plugins
   */
  async getAvailableSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    // Source 1: Read from ~/.claude/skills/ directory directly
    const directorySkills = await this.readSkillsFromDirectory();
    skills.push(...directorySkills);

    // Source 2: Read from installed plugins (for marketplace skills)
    const pluginsPath = path.join(this.claudePath, 'plugins');

    try {
      const installedJsonPath = path.join(pluginsPath, 'installed_plugins.json');
      const content = await fs.readFile(installedJsonPath, 'utf-8');
      const installed = JSON.parse(content);

      if (installed.plugins) {
        for (const [pluginKey, installations] of Object.entries(installed.plugins)) {
          if (Array.isArray(installations)) {
            for (const inst of installations) {
              if (inst.installPath) {
                const marketplacePath = path.join(inst.installPath, '.claude-plugin', 'marketplace.json');
                const subSkills = await this.readSubSkillsFromMarketplace(marketplacePath, '');

                // Merge skills, avoiding duplicates by ID
                for (const subSkill of subSkills) {
                  if (!skills.some(s => s.id === subSkill.id)) {
                    skills.push(subSkill);
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to read skills from plugins:', error);
    }

    console.log('[ConfigReader] Total parsed skills:', skills.length);
    return skills;
  }

  /**
   * Discover MCP servers from various sources
   */
  private async discoverMcpServers(): Promise<McpToolItem[]> {
    const mcpServers: McpToolItem[] = [];

    // Source 1: Scan plugin cache directories for .mcp.json files
    const pluginsCachePath = path.join(this.claudePath, 'plugins', 'cache');

    try {
      const collections = await fs.readdir(pluginsCachePath, { withFileTypes: true });

      for (const collection of collections) {
        if (!collection.isDirectory()) continue;

        const collectionPath = path.join(pluginsCachePath, collection.name);

        try {
          const plugins = await fs.readdir(collectionPath, { withFileTypes: true });

          for (const plugin of plugins) {
            if (!plugin.isDirectory()) continue;

            const pluginPath = path.join(collectionPath, plugin.name);
            const mcpJsonPath = path.join(pluginPath, '.mcp.json');

            try {
              const mcpConfig = JSON.parse(await fs.readFile(mcpJsonPath, 'utf-8'));

              if (mcpConfig.mcpServers) {
                for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
                  const command = (serverConfig as any)?.command || serverName;

                  mcpServers.push({
                    id: `mcp__${serverName}`,
                    name: serverName,
                    server: serverName,
                    description: `Server: ${command}`,
                    toolCount: 1
                  });

                  console.log(`[ConfigReader] Found MCP server: ${serverName}`);
                }
              }
            } catch {
              // No .mcp.json in this plugin
            }
          }
        } catch {
          // Cannot read plugin directory
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Failed to scan plugins cache:', error);
    }

    // Source 2: Read from ~/.claude/.mcp.json (if exists)
    try {
      const mcpConfigPath = path.join(this.claudePath, '.mcp.json');
      const content = await fs.readFile(mcpConfigPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
          const command = (serverConfig as any)?.command || serverName;

          // Add if not already in list
          if (!mcpServers.some(s => s.server === serverName)) {
            mcpServers.push({
              id: `mcp__${serverName}`,
              name: serverName,
              server: serverName,
              description: `Server: ${command}`,
              toolCount: 1
            });

            console.log(`[ConfigReader] Found MCP server from .mcp.json: ${serverName}`);
          }
        }
      }
    } catch {
      // No .mcp.json file
    }

    return mcpServers;
  }

  /**
   * Known built-in MCP servers list
   * These servers are compiled in claude.exe and cannot be discovered via plugin scanning
   * Source: Inferred from permission list analysis and Claude Code behavior
   */
  private readonly BUILTIN_MCPS = [
    'context7',           // Documentation query service
    'playwright',         // Browser automation (built-in version)
    'puppeteer',          // Browser automation
    'sequential-thinking', // Chain-of-thought tools
    'fetch',              // HTTP request tools
    'duckduckgo-search',  // Web search (built-in version)
    'deepwiki',           // GitHub repository Q&A
    'webReader'           // Web content reading (dynamically discovered)
  ];

  /**
   * Infer built-in MCP servers from permission list
   *
   * Strategy:
   * 1. Extract all mcp__ prefixed permissions
   * 2. Parse server name (split by last '__')
   * 3. Count tools per server
   * 4. Iterate through ALL BUILTIN_MCPS to ensure all are displayed
   * 5. Use tool count from permissions (0 if no permissions granted)
   */
  private inferBuiltInMcpServers(
    permissions: string[]
  ): Map<string, McpToolItem> {
    const builtInMcps = new Map<string, McpToolItem>();
    const mcpPermissions = permissions.filter(p => p.startsWith('mcp__'));

    // Count tools per server
    const serverToolCounts = new Map<string, number>();

    for (const perm of mcpPermissions) {
      const mcpPart = perm.substring(5); // Remove mcp__ prefix
      const lastDoubleUnderscore = mcpPart.lastIndexOf('__');

      if (lastDoubleUnderscore > 0) {
        const serverName = mcpPart.substring(0, lastDoubleUnderscore);
        const currentCount = serverToolCounts.get(serverName) || 0;
        serverToolCounts.set(serverName, currentCount + 1);
      }
    }

    // Add all built-in MCP servers from BUILTIN_MCPS list
    // This ensures all 8 built-in MCPs are displayed, even without permissions
    for (const serverName of this.BUILTIN_MCPS) {
      const toolCount = serverToolCounts.get(serverName) || 0;

      if (!builtInMcps.has(serverName)) {
        builtInMcps.set(serverName, {
          id: `mcp__${serverName}`,
          name: serverName,
          server: serverName,
          description: `Built-in MCP Server (${toolCount} tools)`,
          toolCount: toolCount
        });
        console.log(`[ConfigReader] Inferred built-in MCP: ${serverName} (${toolCount} tools)`);
      }
    }

    return builtInMcps;
  }

  /**
   * Get MCP tools from .mcp.json and settings.local.json
   * Returns individual tool items (not server-grouped)
   */
  async getMcpTools(): Promise<McpToolItem[]> {
    const allMcpTools = new Map<string, McpToolItem>();

    // Source 1: Discover MCP servers from .mcp.json files
    const discoveredServers = await this.discoverMcpServers();
    for (const server of discoveredServers) {
      allMcpTools.set(server.id, server);
    }

    // Source 2: Read from permissions list and infer built-in MCPs
    try {
      const settings = await this.getLocalSettings();
      const permissions = settings.permissions?.allow || [];
      const mcpPermissions = permissions.filter((p: string) => p.startsWith('mcp__'));

      console.log('[ConfigReader] Raw permissions:', permissions);
      console.log('[ConfigReader] MCP permissions:', mcpPermissions);
      console.log('[ConfigReader] Total MCP permissions:', mcpPermissions.length);

      // Parse individual tools from permissions
      for (const perm of mcpPermissions) {
        const mcpPart = perm.substring(5);
        const lastDoubleUnderscore = mcpPart.lastIndexOf('__');

        if (lastDoubleUnderscore > 0) {
          const serverName = mcpPart.substring(0, lastDoubleUnderscore);
          const toolName = mcpPart.substring(lastDoubleUnderscore + 2);
          const toolId = `mcp__${serverName}__${toolName}`;

          allMcpTools.set(toolId, {
            id: toolId,
            name: toolName,
            server: serverName,
            description: `Tool: ${toolName} from ${serverName}`,
            toolCount: 1
          });
        }
      }

      // Source 3: Infer built-in MCP servers from permission list
      const builtInMcps = this.inferBuiltInMcpServers(permissions);
      for (const [serverName, mcp] of builtInMcps) {
        const serverId = `mcp__${serverName}`;
        if (!allMcpTools.has(serverId)) {
          allMcpTools.set(serverId, mcp);
        }
      }
    } catch (error) {
      console.log('[ConfigReader] Error reading permissions:', error);
    }

    console.log(`[ConfigReader] Total MCP tools detected: ${allMcpTools.size}`);

    return Array.from(allMcpTools.values());
  }

  /**
   * Get MCP server list (for backward compatibility)
   * @deprecated Use getMcpTools() instead
   */
  async getMcpServerList(): Promise<McpToolInfo[]> {
    try {
      const mcpTools = new Map<string, McpToolInfo>();

      // Source 1: Read MCP server configs from .mcp.json
      try {
        const mcpConfigPath = path.join(this.claudePath, '.mcp.json');
        const content = await fs.readFile(mcpConfigPath, 'utf-8');
        const config = JSON.parse(content);

        if (config.mcpServers) {
          for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
            const command = (serverConfig as any)?.command || serverName;
            mcpTools.set(serverName, {
              id: `mcp__${serverName}`,
              name: serverName,
              description: `Server: ${command}`,
              server: serverName,
              toolCount: 1
            });
          }
        }
      } catch (error) {
        console.log('[ConfigReader] No .mcp.json found or error reading:', error);
      }

      // Source 2: Read from permissions list in settings.local.json
      try {
        const settings = await this.getLocalSettings();
        const permissions = settings.permissions?.allow || [];
        const mcpPermissions = permissions.filter((p: string) => p.startsWith('mcp__'));

        for (const perm of mcpPermissions) {
          // Extract mcp__ prefix to get the part after it
          const mcpPart = perm.substring(5);

          // Find of last '__' to separate server name from tool name
          const lastDoubleUnderscore = mcpPart.lastIndexOf('__');

          if (lastDoubleUnderscore > 0) {
            const serverName = mcpPart.substring(0, lastDoubleUnderscore);
            const toolName = mcpPart.substring(lastDoubleUnderscore + 2);

            // If exists, update tool count; otherwise add new entry
            if (mcpTools.has(serverName)) {
              const existing = mcpTools.get(serverName)!;
              existing.toolCount = (existing.toolCount || 0) + 1;
              existing.description = `${existing.toolCount} tool(s) available`;
            } else {
              mcpTools.set(serverName, {
                id: `mcp__${serverName}`,
                name: serverName,
                description: '1 tool(s) available',
                server: serverName,
                toolCount: 1
              });
            }
          }
        }
      } catch (error) {
        console.log('[ConfigReader] No permissions found or error reading:', error);
      }

      return Array.from(mcpTools.values());
    } catch (error) {
      console.error('Failed to read MCP tools:', error);
      return [];
    }
  }
}
