/**
 * Running state manager for Agent/Skill/Plugin/MCP execution tracking
 *
 * Supports two sources of state updates:
 * 1. Terminal output parsing (legacy)
 * 2. Hook system events (new, more reliable)
 */

export interface RunningItem {
  id: string;
  name: string;
  type: 'agent' | 'skill' | 'plugin' | 'mcp';
  startTime: number;
  color: string;
  source?: 'terminal' | 'hook'; // Track the source of the state
}

export interface HookStatus {
  event: 'START' | 'STOP';
  agentId: string;
  agentName: string;
  type: 'agent' | 'skill' | 'plugin' | 'mcp';
  timestamp: number;
  model?: string;
  description?: string;
}

export class RunningStateManager {
  private runningItems = new Map<string, RunningItem>();

  /**
   * Start tracking a running item
   */
  startRunning(id: string, name: string, type: 'agent' | 'skill' | 'plugin' | 'mcp', source: 'terminal' | 'hook' = 'terminal'): void {
    const color = this.getColor(type);
    this.runningItems.set(id, {
      id,
      name,
      type,
      startTime: Date.now(),
      color,
      source
    });
    console.log(`[RunningStateManager] Started (${source}): ${type} ${name} (${id})`);
  }

  /**
   * Stop tracking a running item
   */
  stopRunning(id: string): void {
    if (this.runningItems.has(id)) {
      const item = this.runningItems.get(id);
      console.log(`[RunningStateManager] Stopped: ${item?.type} ${item?.name} (${id})`);
      this.runningItems.delete(id);
    } else {
      console.log(`[RunningStateManager] No running item found with ID: ${id}`);
    }
  }

  /**
   * Handle Hook status update
   *
   * Process status updates from Claude Code Hook system.
   * This is the preferred method for tracking subagent execution.
   *
   * @param status Hook status from HookStateReceiver
   */
  handleHookStatus(status: HookStatus): void {
    const { event, agentId, agentName, type } = status;

    if (event === 'START') {
      // Start tracking with hook source
      this.startRunning(agentId, agentName, type, 'hook');
    } else if (event === 'STOP') {
      // Stop tracking
      this.stopRunning(agentId);
    }
  }

  /**
   * Stop all running items (for cleanup)
   */
  stopAll(): void {
    console.log(`[RunningStateManager] Stopping all ${this.runningItems.size} items`);
    this.runningItems.clear();
  }

  /**
   * Get all running items
   */
  getRunningItems(): RunningItem[] {
    return Array.from(this.runningItems.values());
  }

  /**
   * Check if an item is running
   */
  isRunning(id: string): boolean {
    return this.runningItems.has(id);
  }

  /**
   * Check if content contains end signal
   */
  checkEndSignal(content: string): boolean {
    const endPatterns = [
      /Done\s*\(\d+\s*tool uses/,
      /Finished/,
      /Complete/i,
      /⎿\s*Done/
    ];
    return endPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Get color for type
   */
  private getColor(type: string): string {
    switch (type) {
      case 'agent': return '#10b981';  // Green
      case 'skill': return '#8b5cf6';  // Purple
      case 'plugin': return '#007acc'; // Blue
      case 'mcp': return '#f59e0b';    // Orange
      default: return '#ffffff';
    }
  }
}
