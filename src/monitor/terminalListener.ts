import * as vscode from 'vscode';
import { TerminalEvent } from '../types';
import { OutputParser } from './outputParser';

/**
 * Terminal output listener
 *
 * Listens to all terminal data and parses Claude Code output
 */
export class TerminalListener {
  private disposables: vscode.Disposable[] = [];
  private eventBuffer: TerminalEvent[] = [];
  private parser: OutputParser;

  // 去重相关
  private recentEvents = new Map<string, number>(); // 内容 -> 最后一次时间戳
  private readonly DUPLICATE_WINDOW = 3000; // 3秒内相同内容视为重复

  // 活动项目跟踪（用于精确停止）- Map<id, type>
  private activeIds: Map<string, 'agent' | 'skill' | 'plugin' | 'mcp'> = new Map();

  // 超时检测 - Agent 不输出结束信号，使用超时自动取消高亮
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly AGENT_TIMEOUT = 10000; // 10秒超时（Agent/Skill/Plugin/MCP 开始工作后自动取消高亮）

  constructor(
    private onEvent: (events: TerminalEvent[]) => void,
    private onRunningState?: (id: string, name: string, type: 'agent' | 'skill' | 'plugin' | 'mcp', state: 'start' | 'stop') => void
  ) {
    this.parser = new OutputParser();
    this.startListening();
  }

  /**
   * Start listening to terminal output
   */
  private startListening(): void {
    console.log('[TerminalListener] Starting terminal listener...');

    // Check if API is available
    const hasApi = 'onDidWriteTerminalData' in (vscode.window as any);
    console.log('[TerminalListener] onDidWriteTerminalData available:', hasApi);

    if (!hasApi) {
      console.error('[TerminalListener] onDidWriteTerminalData is NOT available!');
      console.log('[TerminalListener] Available terminal APIs:', Object.keys(vscode.window).filter(k => k.toLowerCase().includes('terminal')));
      return;
    }

    // Listen to terminal data writes
    const disposable = (vscode.window as any).onDidWriteTerminalData((e: any) => {
      console.log('[TerminalListener] Event fired! Data type:', typeof e.data);

      // e.data might be a string directly or an object with readString method
      if (typeof e.data === 'string') {
        // Direct string data
        const data = e.data;
        console.log('[TerminalListener] Received string data:', data.length, 'chars');
        if (data.length > 0) {
          console.log('[TerminalListener] Data preview:', data.substring(0, Math.min(100, data.length)));
          this.handleTerminalData(data);
        }
      } else if (e.data && typeof e.data.readString === 'function') {
        // Object with readString method
        e.data.readString().then((data: string) => {
          console.log('[TerminalListener] readString result:', data.length > 0 ? 'YES (' + data.length + ' chars)' : 'NO');
          if (data && data.length > 0) {
            console.log('[TerminalListener] Data preview:', data.substring(0, 100));
            this.handleTerminalData(data);
          } else {
            console.log('[TerminalListener] No data received from readString()');
          }
        }).catch((err: any) => {
          console.error('[TerminalListener] readString error:', err);
        });
      } else {
        console.warn('[TerminalListener] Unknown data format:', typeof e.data);
      }
    });

    this.disposables.push(disposable);
    console.log('[TerminalListener] Terminal listener started');
  }

  /**
   * Handle terminal data
   */
  private handleTerminalData(data: string): void {
    console.log('[TerminalListener] Received data length:', data.length);

    // 第一层过滤：快速内容检查 - 只处理包含 Claude Code 特征的输出
    const quickPatterns = ['[Bash]', '[Read]', '[Write]', '[Skill]', '[Agent]', '[skill]', '[agent]', '[Plan]', '\u25CF']; // \u25CF = ● (黑圆圈 - Agent/Skill/Plugin 符号)
    const hasRelevantContent = quickPatterns.some(p => data.includes(p));

    if (!hasRelevantContent) {
      // 跳过无关内容
      return;
    }

    // 排除纯用户输入
    const trimmed = data.trim();
    if (trimmed.startsWith('> ') || trimmed.match(/^>\s/)) {
      console.log('[TerminalListener] Skipping user input');
      return;
    }

    // 第二层过滤：解析验证
    const events = this.parser.parse(data);
    console.log('[TerminalListener] Parsed', events.length, 'events');

    if (events.length === 0) {
      return; // 解析器也无法识别
    }

    // 去重处理
    const uniqueEvents = this.deduplicateEvents(events);

    // 处理有效事件
    for (const event of uniqueEvents) {
      console.log('[TerminalListener] Event:', event.type, event.content?.substring(0, 50));

      // 检测运行状态开始
      if (event.type === 'agent_call' && event.details?.agent) {
        const id = event.details.agent;
        this.activeIds.set(id, 'agent');

        // 设置超时自动取消（Agent 不输出结束信号）
        const timeout = setTimeout(() => {
          console.log('[TerminalListener] Agent timeout, auto-stopping:', id);
          this.onRunningState?.(id, '', 'agent', 'stop');
          this.activeIds.delete(id);
          this.activeTimeouts.delete(id);
        }, this.AGENT_TIMEOUT);
        this.activeTimeouts.set(id, timeout);

        this.onRunningState?.(id, event.content, 'agent', 'start');
      }
      if (event.type === 'skill_call' && event.details?.skill) {
        const id = event.details.skill;
        this.activeIds.set(id, 'skill');

        // Skill 也使用相同的超时机制
        const timeout = setTimeout(() => {
          console.log('[TerminalListener] Skill timeout, auto-stopping:', id);
          this.onRunningState?.(id, '', 'skill', 'stop');
          this.activeIds.delete(id);
          this.activeTimeouts.delete(id);
        }, this.AGENT_TIMEOUT);
        this.activeTimeouts.set(id, timeout);

        this.onRunningState?.(id, event.content, 'skill', 'start');
      }
      // 新增：plugin_call 处理
      if (event.type === 'plugin_call' && event.details?.plugin) {
        const id = event.details.plugin;
        this.activeIds.set(id, 'plugin');

        // Plugin 也使用相同的超时机制
        const timeout = setTimeout(() => {
          console.log('[TerminalListener] Plugin timeout, auto-stopping:', id);
          this.onRunningState?.(id, '', 'plugin', 'stop');
          this.activeIds.delete(id);
          this.activeTimeouts.delete(id);
        }, this.AGENT_TIMEOUT);
        this.activeTimeouts.set(id, timeout);

        this.onRunningState?.(id, event.content, 'plugin', 'start');
      }
      // MCP call 处理
      if (event.type === 'mcp_call' && event.details?.mcp) {
        const id = event.details.mcp;
        this.activeIds.set(id, 'mcp');

        // MCP 也使用相同的超时机制
        const timeout = setTimeout(() => {
          console.log('[TerminalListener] MCP timeout, auto-stopping:', id);
          this.onRunningState?.(id, '', 'mcp', 'stop');
          this.activeIds.delete(id);
          this.activeTimeouts.delete(id);
        }, this.AGENT_TIMEOUT);
        this.activeTimeouts.set(id, timeout);

        this.onRunningState?.(id, event.content, 'mcp', 'start');
      }

      // 检查结束信号 - 精确停止
      if (event.content) {
        const endPatterns = [
          /Done\s*\(\d+\s*tool uses/,
          /Finished/,
          /Complete/i,
          /⎿\s*Done/
        ];
        const isEndSignal = endPatterns.some(pattern => pattern.test(event.content));

        if (isEndSignal && this.activeIds.size > 0) {
          // 停止所有当前活动的项目（精确停止）
          console.log('[TerminalListener] End signal detected, stopping active items:', Array.from(this.activeIds.entries()));
          for (const [id, type] of this.activeIds.entries()) {
            // 清除超时
            const timeout = this.activeTimeouts.get(id);
            if (timeout) clearTimeout(timeout);
            this.activeTimeouts.delete(id);

            this.onRunningState?.(id, '', type, 'stop');
          }
          this.activeIds.clear();
        }
      }

      this.eventBuffer.push(event);
    }

    // Batch trigger callback with new events only
    if (uniqueEvents.length > 0) {
      this.onEvent(uniqueEvents);
    }

    // Keep buffer size manageable
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-500);
    }

    // 清理过期的去重记录
    this.cleanupDuplicateRecords();
  }

  /**
   * 去重事件
   */
  private deduplicateEvents(events: TerminalEvent[]): TerminalEvent[] {
    const uniqueEvents: TerminalEvent[] = [];
    const now = Date.now();

    for (const event of events) {
      // 生成唯一键（基于类型和内容）
      const eventKey = `${event.type}:${event.content?.substring(0, 100)}`;
      const lastSeen = this.recentEvents.get(eventKey);

      // 如果是重复事件且在时间窗口内，跳过
      if (lastSeen !== undefined && now - lastSeen < this.DUPLICATE_WINDOW) {
        console.log('[TerminalListener] Skipping duplicate event:', event.type, event.content?.substring(0, 30));
        continue;
      }

      // 记录新事件
      this.recentEvents.set(eventKey, now);
      uniqueEvents.push(event);
    }

    return uniqueEvents;
  }

  /**
   * 清理过期的去重记录
   */
  private cleanupDuplicateRecords(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, timestamp] of this.recentEvents) {
      if (now - timestamp > this.DUPLICATE_WINDOW * 2) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.recentEvents.delete(key);
    }
  }

  /**
   * Get event buffer
   */
  getEvents(): TerminalEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear event buffer
   */
  clearEvents(): void {
    this.eventBuffer = [];
  }

  /**
   * Set the item type resolver for distinguishing agents from plugins
   */
  setItemTypeResolver(resolver: any): void {
    this.parser.setItemTypeResolver(resolver);
  }

  /**
   * Get dynamically discovered MCP servers from terminal output
   */
  getDiscoveredMcps(): string[] {
    return this.parser.getDiscoveredMcps();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
