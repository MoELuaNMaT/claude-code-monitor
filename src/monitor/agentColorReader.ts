import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Agent Color Reader
 *
 * Reads color configuration from Agent markdown files in ~/.claude/agents/
 *
 * Supports two color formats:
 * 1. YAML frontmatter: color: #10b981
 * 2. Simple format: Color: #10b981
 */
export class AgentColorReader {
  private agentsPath: string;
  private colorCache: Map<string, string | null> = new Map();
  private cacheValid = false;

  constructor() {
    this.agentsPath = path.join(os.homedir(), '.claude', 'agents');
  }

  /**
   * Get the color configuration for an agent
   * @param agentName Agent name (e.g., 'Explore', 'Plan')
   * @returns Color value (e.g., '#10b981'), or null if not configured
   */
  async getAgentColor(agentName: string): Promise<string | null> {
    // Return from cache if valid
    if (this.cacheValid && this.colorCache.has(agentName)) {
      return this.colorCache.get(agentName) || null;
    }

    // Try to read the agent's markdown file
    const mdPath = path.join(this.agentsPath, `${agentName}.md`);

    try {
      const content = await fs.readFile(mdPath, 'utf-8');
      const color = this.extractColorFromMarkdown(content);

      // Cache the result
      this.colorCache.set(agentName, color);
      return color;
    } catch (error) {
      // File doesn't exist or read failed
      this.colorCache.set(agentName, null);
      return null;
    }
  }

  /**
   * Color name to hex code mapping
   */
  private readonly COLOR_NAME_MAP: { [key: string]: string } = {
    'blue': '#007acc',
    'green': '#10b981',
    'yellow': '#f59e0b',
    'red': '#f14c4c',
    'cyan': '#4ec9b0',
    'magenta': '#dcdcaa',
    'white': '#ffffff',
    'black': '#000000'
  };

  /**
   * Extract color field from Markdown content
   * Supports two formats:
   * 1. YAML frontmatter: color: yellow or color: #10b981
   * 2. Simple format: Color: yellow or Color: #10b981
   */
  private extractColorFromMarkdown(content: string): string | null {
    // Try to match color field in YAML frontmatter
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const colorMatch = yamlContent.match(/color:\s*(.+?)(?:\n|$)/i);
      if (colorMatch) {
        return this.normalizeColor(colorMatch[1].trim());
      }
    }

    // Try to match simple Color field format (case-insensitive)
    const simpleMatch = content.match(/^C(?:olor)?[:\s]+(.+?)(?:\n|$)/im);
    if (simpleMatch) {
      return this.normalizeColor(simpleMatch[1].trim());
    }

    return null;
  }

  /**
   * Normalize color to hex code
   * Supports both color names (yellow, blue, etc.) and hex codes (#10b981)
   */
  private normalizeColor(color: string): string | null {
    // If it's already a hex code, return it
    if (/^#[a-fA-F0-9]{6}$/.test(color) || /^#[a-fA-F0-9]{3}$/.test(color)) {
      return color;
    }

    // Convert to lowercase for case-insensitive matching
    const lowerColor = color.toLowerCase();

    // Look up in color name map
    if (lowerColor in this.COLOR_NAME_MAP) {
      return this.COLOR_NAME_MAP[lowerColor];
    }

    // Unknown color, return null
    return null;
  }

  /**
   * Get colors for multiple agents in batch
   */
  async getAgentColors(agentNames: string[]): Promise<Map<string, string>> {
    const colorMap = new Map<string, string>();

    for (const name of agentNames) {
      const color = await this.getAgentColor(name);
      if (color) {
        colorMap.set(name, color);
      }
    }

    return colorMap;
  }

  /**
   * Clear cache (call after config file updates)
   */
  clearCache(): void {
    this.cacheValid = false;
    this.colorCache.clear();
  }

  /**
   * Mark cache as valid
   */
  markCacheValid(): void {
    this.cacheValid = true;
  }
}
