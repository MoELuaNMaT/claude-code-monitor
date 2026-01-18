import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentInfo } from '../types';

/**
 * Agent Discovery - 从官方目录扫描 Agent 定义
 *
 * 扫描 ~/.claude/agents/ 目录，解析 Agent Markdown 文件
 * 支持 YAML frontmatter: name, description, model, color
 */
export class AgentDiscovery {
  private static readonly BUILTIN_AGENTS: AgentInfo[] = [
    {
      id: 'general-purpose',
      name: 'general-purpose',
      description: 'General-purpose agent for research, coding, and multi-step tasks',
      category: 'default',
      source: 'builtin',
      docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
    },
    {
      id: 'Explore',
      name: 'Explore',
      description: 'Fast agent specialized for exploring codebases',
      category: 'specialized',
      source: 'builtin',
      docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents/explore'
    },
    {
      id: 'Plan',
      name: 'Plan',
      description: 'Software architect agent for designing implementation plans',
      category: 'specialized',
      source: 'builtin',
      docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents/plan'
    }
    // ... 其他内置 agent 作为降级
  ];

  private readonly agentsPath: string;

  constructor() {
    this.agentsPath = path.join(os.homedir(), '.claude', 'agents');
  }

  /**
   * 扫描并返回所有 Agent
   * 优先级：CLI > 目录扫描 > 内置列表
   */
  async discoverAgents(): Promise<AgentInfo[]> {
    // 1. 尝试 CLI 查询（如果未来支持）
    // 2. 失败则扫描 ~/.claude/agents/ 目录
    // 3. 最终回退到内置列表

    const directoryAgents = await this.scanAgentsDirectory();

    if (directoryAgents.length > 0) {
      console.log('[AgentDiscovery] Discovered', directoryAgents.length, 'agents from directory');
      return directoryAgents;
    }

    // 降级到内置列表
    console.log('[AgentDiscovery] Falling back to', AgentDiscovery.BUILTIN_AGENTS.length, 'builtin agents');
    return AgentDiscovery.BUILTIN_AGENTS;
  }

  /**
   * 扫描 ~/.claude/agents/ 目录
   */
  private async scanAgentsDirectory(): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = [];

    try {
      const entries = await fs.readdir(this.agentsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        try {
          const fullPath = path.join(this.agentsPath, entry.name);
          const content = await fs.readFile(fullPath, 'utf-8');

          const agent = this.parseAgentMarkdown(entry.name, content, fullPath);
          agents.push(agent);
        } catch (error) {
          console.error(`[AgentDiscovery] Failed to parse ${entry.name}:`, error);
        }
      }

      console.log(`[AgentDiscovery] Scanned ${agents.length} agent files`);
      return agents;
    } catch (error) {
      console.error('[AgentDiscovery] Failed to scan agents directory:', error);
      return [];
    }
  }

  /**
   * 解析 Agent Markdown 文件
   */
  private parseAgentMarkdown(filePath: string, content: string, fullPath?: string): AgentInfo {
    // 提取 YAML frontmatter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    let name = '';
    let description = '';
    let category = 'default';
    let model = 'inherit';
    let color: string | null = null;

    if (frontMatterMatch) {
      const yamlContent = frontMatterMatch[1];

      // 解析 name
      const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
      if (nameMatch) {
        name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
      }

      // 解析 description - 支持多行并限制长度
      const descMatch = yamlContent.match(/^description:\s*(.+)$/m);
      if (descMatch) {
        let desc = descMatch[1].trim().replace(/^['"]|['"]$/g, '');

        // 处理多行描述（去除换行符和多余空格）
        desc = desc.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

        // 限制长度，截断过长的描述
        const MAX_DESC_LENGTH = 100;
        if (desc.length > MAX_DESC_LENGTH) {
          desc = desc.substring(0, MAX_DESC_LENGTH) + '...';
        }

        description = desc;
      }

      // 解析 category
      const catMatch = yamlContent.match(/^category:\s*(.+)$/m);
      if (catMatch) {
        category = catMatch[1].trim().replace(/^['"]|['"]$/g, '');
      }

      // 解析 model
      const modelMatch = yamlContent.match(/^model:\s*(.+)$/m);
      if (modelMatch) {
        model = modelMatch[1].trim();
      }
    }

    // 使用文件名作为 id
    const id = path.basename(filePath, '.md');

    // Fallback: 如果 name 为空，使用文件名作为 name
    if (!name) {
      name = id;
    }

    return {
      id,
      name,
      description,
      category,
      model,
      color,
      source: 'file',
      mdPath: fullPath || path.join(this.agentsPath, filePath)
    };
  }
}
