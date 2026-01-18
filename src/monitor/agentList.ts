import { AgentInfo } from '../types';

/**
 * Built-in Claude Code agent types
 */
export const AGENT_LIST: AgentInfo[] = [
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
  },
  {
    id: 'claude-code-guide',
    name: 'claude-code-guide',
    description: 'Guide agent for Claude Code and Claude Agent SDK documentation',
    category: 'documentation',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code'
  },
  {
    id: 'electron-pro',
    name: 'electron-pro',
    description: 'Desktop application specialist for secure cross-platform solutions',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'e2e-test-planner',
    name: 'e2e-test-planner',
    description: 'Create comprehensive E2E testing strategies and acceptance plans',
    category: 'testing',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'fullstack-developer',
    name: 'fullstack-developer',
    description: 'End-to-end feature owner with expertise across the entire stack',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'frontend-developer',
    name: 'frontend-developer',
    description: 'Expert UI engineer focused on crafting robust, scalable frontend solutions',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'backend-developer',
    name: 'backend-developer',
    description: 'Senior backend engineer specializing in scalable API development',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'data-scientist',
    name: 'data-scientist',
    description: 'Data analysis expert for SQL queries, BigQuery operations, and insights',
    category: 'data',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'ui-designer',
    name: 'ui-designer',
    description: 'Expert visual designer specializing in creating intuitive, beautiful UIs',
    category: 'design',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'ui-design-system-architect',
    name: 'ui-design-system-architect',
    description: 'Create comprehensive UI design systems and component libraries',
    category: 'design',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'mobile-developer',
    name: 'mobile-developer',
    description: 'Cross-platform mobile specialist building performant native experiences',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'bug-debugger',
    name: 'bug-debugger',
    description: 'Systematically analyze possible causes when encountering bugs or issues',
    category: 'debugging',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'product-requirement-analyzer',
    name: 'product-requirement-analyzer',
    description: 'Analyze and clarify product requirements from a PM perspective',
    category: 'product',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  },
  {
    id: 'code-reviewer',
    name: 'code-reviewer',
    description: 'Review code after development phases are completed',
    category: 'development',
    source: 'builtin',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code/agents'
  }
];
