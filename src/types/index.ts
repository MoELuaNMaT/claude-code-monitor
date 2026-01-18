/**
 * Quota status for API providers
 */
export interface QuotaStatus {
  provider: string;
  used: number;
  limit: number;
  percentage: number;
  resetDate?: Date;
  currency: string;
  error?: string;
  updatedAt?: Date;
}

/**
 * Quota provider interface
 */
export interface QuotaProvider {
  getName(): string;
  getQuota(): Promise<QuotaStatus>;
  isConfigured(): Promise<boolean>;
}

/**
 * Terminal event types
 */
export type TerminalEventType =
  | 'tool_call'
  | 'skill_call'
  | 'agent_call'
  | 'plugin_call'
  | 'mcp_call'
  | 'user_message'
  | 'plan_progress'
  | 'other';

/**
 * Terminal event
 */
export interface TerminalEvent {
  type: TerminalEventType;
  timestamp: Date;
  content: string;
  details?: Record<string, any>;
}

/**
 * Plan progress
 */
export interface PlanProgress {
  current: number;
  total: number;
  steps: PlanStep[];
}

/**
 * Plan step
 */
export interface PlanStep {
  description: string;
  completed: boolean;
  inProgress?: boolean;
}

/**
 * Plugin information
 */
export interface PluginInfo {
  id?: string;
  name: string;
  description?: string;
  version: string;
  scope: string;
  installPath: string;
  isLocal: boolean;
  isSubSkill?: boolean;
}

/**
 * Skill information
 */
export interface SkillInfo {
  id?: string;
  name: string;
  description: string;
  category?: string;
  /** SKILL.md file path */
  mdPath?: string;
  /** Skill installation directory */
  installPath?: string;
}

/**
 * Agent information
 */
export interface AgentInfo {
  id?: string;
  name: string;
  description: string;
  category?: string;
  model?: string;
  color?: string | null;
  source?: 'file' | 'builtin';
  /** Agent MD file path */
  mdPath?: string;
  /** Official documentation URL (for builtin agents) */
  docUrl?: string;
}

/**
 * Hook status from Claude Code Hook system
 */
export interface HookStatus {
  event: 'START' | 'STOP';
  agentId: string;
  agentName: string;
  type: 'agent' | 'skill' | 'plugin' | 'mcp';
  timestamp: number;
  model?: string;
  description?: string;
}

/**
 * Item cache entry for ItemTypeResolver
 */
export interface ItemCacheEntry {
  id: string;           // Unique ID (e.g., agent__bug-debugger)
  name: string;         // Display name
  type: 'mcp' | 'plugin' | 'skill' | 'agent';
  source: 'file' | 'builtin' | 'dynamic';
  metadata?: Record<string, any>;
}

/**
 * MCP tool information
 */
export interface McpToolInfo {
  id: string;
  name: string;
  description: string;
  server: string;
  toolCount: number;
}

/**
 * MCP tool item (individual tool)
 */
export interface McpToolItem {
  id: string;        // e.g., mcp__duckduckgo-search__search
  name: string;      // Tool name, e.g., search
  server: string;     // Server name, e.g., duckduckgo-search
  description?: string;
  toolCount: number;   // Number of tools for this server
}

/**
 * Unified extension item (merges plugins, skills, and MCP tools)
 */
export interface ExtensionItem {
  id: string;
  name: string;
  description?: string;
  version?: string;
  scope?: string;
  type: 'mcp' | 'plugin' | 'skill';
  installPath?: string;
  isSubSkill?: boolean;
  category?: string;
  toolCount?: number;
}

/**
 * Monitor state
 */
export interface MonitorState {
  quotaStatus: QuotaStatus[];
  terminalEvents: TerminalEvent[];
  planProgress?: PlanProgress;
  plugins: PluginInfo[];
  skills: SkillInfo[];
}
