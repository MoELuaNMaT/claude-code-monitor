import { TerminalEvent, PlanProgress } from '../types';
import { ItemTypeResolver } from './itemTypeResolver';

/**
 * Output parser for Claude Code terminal output
 *
 * Parses various types of events:
 * - Tool calls: [Bash], [Read], [Write], etc.
 * - Skill calls: [skill] name: action
 * - Agent calls: [agent] name: action
 * - Plugin calls: ● plugin-name (detected via ItemTypeResolver)
 * - Plan progress: Plan mode steps
 * - User messages: Messages from the user
 */
export class OutputParser {
  private itemTypeResolver?: ItemTypeResolver;
  // Regex patterns
  private readonly TOOL_CALL_PATTERN = /^\[([A-Z][a-zA-Z]*)\]\s+(.+)$/;
  private readonly SKILL_CALL_PATTERN = /^\[skill\]\s+(\w+):\s*(.+)$/;
  private readonly AGENT_CALL_PATTERN = /^\[agent\]\s+(\w+):\s*(.+)$/;
  // Claude Code Skill format: ● /name(description) or ● /name
  private readonly SKILL_FORMAT_PATTERN = /^●\s*\/\s*([\w-]+)(?:\(([^)]+)\))?$/;
  // Claude Code Agent/Plugin format: ● name(description) or ● name
  private readonly AGENT_FORMAT_PATTERN = /^●\s*([\w-]+)(?:\(([^)]+)\))?$/;
  // MCP format: ● mcp-server-name(description) or similar
  private readonly MCP_FORMAT_PATTERN = /^●\s*mcp[-_:]([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?$/;
  // MCP result format: serverName_result_summary or similar
  private readonly MCP_RESULT_PATTERN = /^(\w+)_result_\w+/;
  private readonly PLAN_STEP_PATTERN = /^\s*[✓☐]\s+(\d+\.\s*)?(.+)$/;
  private readonly USER_MESSAGE_PATTERN = /^>\s*(.+)$/;

  // Dynamic MCP discovery - tracks MCP servers discovered from terminal output
  private discoveredMcps: Set<string> = new Set();

  /**
   * Parse terminal output and extract events
   */
  parse(output: string): TerminalEvent[] {
    // 清理 ANSI 转义序列（颜色代码、控制序列）
    const cleanOutput = output.replace(/\[\d+m|\[\d+[;]?\d*[m;]*|[\x1b\x0f]\[[0-9;]*[a-zA-Z]/g, '');

    const events: TerminalEvent[] = [];
    const lines = cleanOutput.split('\n');

    for (const line of lines) {
      const event = this.parseLine(line.trim());
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Parse a single line with format prefix priority
   *
   * Priority Order:
   * 1. Format Prefix: ● /name → Skill, ● mcp-* → MCP
   * 2. Map Cache Lookup: Check itemTypeResolver cache
   * 3. Fixed Priority Fallback: MCP > Plugin > Skill > Agent
   */
  private parseLine(line: string): TerminalEvent | null {
    if (!line) {
      return null;
    }

    const trimmedLine = line.trim();

    // Debug: 打印包含 ● 或 [ 的行
    if (trimmedLine.includes('\u25CF') || trimmedLine.includes('[')) {
      console.log('[OutputParser] Parsing line:', trimmedLine.substring(0, Math.min(80, trimmedLine.length)));
    }

    // ========== Level 1: Format Prefix Priority (Highest) ==========

    // 1.1 Check Skill format: ● /name or ● /name(description)
    const skillFormatMatch = trimmedLine.match(this.SKILL_FORMAT_PATTERN);
    if (skillFormatMatch) {
      const skillName = skillFormatMatch[1];
      const description = skillFormatMatch[2] || skillName;
      console.log('[OutputParser] Format Prefix → Skill:', skillName, description);

      return {
        type: 'skill_call',
        timestamp: new Date(),
        content: description,
        details: {
          skill: skillName,
          name: skillName,
          raw: line
        }
      };
    }

    // 1.2 Check MCP format: ● mcp-* or ● mcp-*:*
    const mcpMatch = trimmedLine.match(this.MCP_FORMAT_PATTERN);
    if (mcpMatch) {
      const serverName = mcpMatch[1];
      const description = mcpMatch[2] || `MCP: ${serverName}`;
      console.log('[OutputParser] Format Prefix → MCP:', serverName, description);

      // Dynamically update discovered MCPs
      if (this.itemTypeResolver) {
        this.itemTypeResolver.updateDynamicMcps([serverName]);
      }

      return {
        type: 'mcp_call',
        timestamp: new Date(),
        content: description,
        details: {
          mcp: serverName,
          name: serverName,
          raw: line
        }
      };
    }

    // ========== Level 2: Map Cache Lookup ==========

    // 2.1 Check generic ● name format (without format prefix)
    const agentFormatMatch = trimmedLine.match(this.AGENT_FORMAT_PATTERN);
    if (agentFormatMatch) {
      const itemName = agentFormatMatch[1];
      const description = agentFormatMatch[2] || itemName;
      console.log('[OutputParser] Generic format → Checking cache for:', itemName);

      // Determine type using ItemTypeResolver cache
      let eventType: 'agent_call' | 'skill_call' | 'plugin_call' | 'mcp_call' = 'agent_call';
      let detailKey: 'agent' | 'skill' | 'plugin' | 'mcp' | 'name' = 'agent';

      if (this.itemTypeResolver) {
        const cachedMcps = this.itemTypeResolver.getCachedMcps?.() || [];
        const cachedPlugins = this.itemTypeResolver.getCachedPlugins();
        const cachedSkills = this.itemTypeResolver.getCachedSkills();
        const cachedAgents = this.itemTypeResolver.getCachedAgents();

        // Priority: MCP > Plugin > Skill > Agent
        if (cachedMcps.includes(itemName)) {
          eventType = 'mcp_call';
          detailKey = 'mcp';
          console.log('[OutputParser] Cache → MCP:', itemName);
        } else if (cachedPlugins.includes(itemName)) {
          eventType = 'plugin_call';
          detailKey = 'plugin';
          console.log('[OutputParser] Cache → Plugin:', itemName);
        } else if (cachedSkills.includes(itemName)) {
          eventType = 'skill_call';
          detailKey = 'skill';
          console.log('[OutputParser] Cache → Skill:', itemName);
        } else if (cachedAgents.includes(itemName)) {
          eventType = 'agent_call';
          detailKey = 'agent';
          console.log('[OutputParser] Cache → Agent:', itemName);
        } else {
          // Default to agent_call for unknown items
          console.log('[OutputParser] Cache miss → Default to agent_call:', itemName);
        }
      }

      return {
        type: eventType,
        timestamp: new Date(),
        content: description,
        details: {
          [detailKey]: itemName,
          name: itemName,
          raw: line
        }
      };
    }

    // Try skill call pattern
    const skillMatch = trimmedLine.match(this.SKILL_CALL_PATTERN);
    if (skillMatch) {
      console.log('[OutputParser] Matched SKILL_CALL:', skillMatch[1]);
      return {
        type: 'skill_call',
        timestamp: new Date(),
        content: skillMatch[2],
        details: {
          skill: skillMatch[1],
          raw: line
        }
      };
    }

    // Try agent call pattern
    const agentMatch = trimmedLine.match(this.AGENT_CALL_PATTERN);
    if (agentMatch) {
      console.log('[OutputParser] Matched AGENT_CALL:', agentMatch[1]);
      return {
        type: 'agent_call',
        timestamp: new Date(),
        content: agentMatch[2],
        details: {
          agent: agentMatch[1],
          raw: line
        }
      };
    }

    // Try tool call pattern
    const toolMatch = trimmedLine.match(this.TOOL_CALL_PATTERN);
    if (toolMatch) {
      console.log('[OutputParser] Matched TOOL_CALL:', toolMatch[1]);
      return {
        type: 'tool_call',
        timestamp: new Date(),
        content: toolMatch[2],
        details: {
          tool: toolMatch[1],
          raw: line
        }
      };
    }

    // Try plan step pattern
    const planMatch = trimmedLine.match(this.PLAN_STEP_PATTERN);
    if (planMatch) {
      console.log('[OutputParser] Matched PLAN_STEP');
      return {
        type: 'plan_progress',
        timestamp: new Date(),
        content: planMatch[2],
        details: {
          completed: trimmedLine.includes('✓'),
          raw: line
        }
      };
    }

    // Try MCP result pattern for dynamic discovery
    // Format: serverName_result_summary, serverName_result_content, etc.
    const mcpResultMatch = trimmedLine.match(this.MCP_RESULT_PATTERN);
    if (mcpResultMatch) {
      const serverName = mcpResultMatch[1];
      // Only discover if it looks like an MCP server (not a common word)
      if (serverName.length > 3 && !['error', 'output', 'result'].includes(serverName.toLowerCase())) {
        const wasNew = !this.discoveredMcps.has(serverName);
        this.discoveredMcps.add(serverName);
        if (wasNew) {
          console.log('[OutputParser] Discovered MCP server:', serverName);
        }
      }
    }

    return null;
  }

  /**
   * Set the item type resolver for distinguishing agents from plugins
   */
  setItemTypeResolver(resolver: ItemTypeResolver): void {
    this.itemTypeResolver = resolver;
  }

  /**
   * Get the list of dynamically discovered MCP servers
   */
  getDiscoveredMcps(): string[] {
    return Array.from(this.discoveredMcps);
  }
  parsePlanProgress(output: string): PlanProgress | null {
    const lines = output.split('\n');
    const steps: { description: string; completed: boolean }[] = [];

    for (const line of lines) {
      const match = line.trim().match(this.PLAN_STEP_PATTERN);
      if (match) {
        steps.push({
          description: match[2],
          completed: line.includes('✓')
        });
      }
    }

    if (steps.length === 0) {
      return null;
    }

    const current = steps.filter(s => s.completed).length;
    const total = steps.length;

    return {
      current,
      total,
      steps: steps.map((s, i) => ({
        ...s,
        inProgress: i === current
      }))
    };
  }

  /**
   * Check if output is from Claude Code
   */
  isClaudeCodeOutput(output: string): boolean {
    // Check for Claude Code specific patterns
    return output.includes('[agent]') ||
           output.includes('[skill]') ||
           output.includes('Plan mode is active') ||
           output.includes('Claude Code');
  }
}
