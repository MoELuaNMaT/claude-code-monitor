import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Hook Status Interface
 *
 * Represents the status of a subagent (agent/skill/plugin/mcp) from Hook system
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
 * Hook State Receiver
 *
 * Receives status updates from Claude Code Hook system via file-based IPC.
 *
 * Hook System Output Format:
 * {
 *   "hookSpecificOutput": {
 *     "hookEventName": "SubagentStart" | "SubagentStop",
 *     "additionalContext": "JSON string with status details"
 *   }
 * }
 *
 * Usage:
 * 1. Claude Code Hook scripts write status to a pipe file
 * 2. This receiver watches the file and parses updates
 * 3. Status changes trigger callbacks to update running state
 */
export class HookStateReceiver {
  private readonly statusPipePath: string;
  private statusCallback?: (status: HookStatus) => void;
  private isWatching = false;
  private watchInterval?: NodeJS.Timeout;

  constructor() {
    // Use environment variable or fallback to temp directory
    this.statusPipePath = process.env['VSCodeMonitor_HOOK_PIPE'] ||
      path.join(os.tmpdir(), 'vscode-monitor-hook-status.pipe');
  }

  /**
   * Set status callback and start watching
   */
  setStatusCallback(callback: (status: HookStatus) => void): void {
    this.statusCallback = callback;
    this.startWatching();
  }

  /**
   * Start watching the status pipe file
   */
  private startWatching(): void {
    if (this.isWatching) {
      console.log('[HookStateReceiver] Already watching');
      return;
    }

    this.isWatching = true;
    console.log('[HookStateReceiver] Starting to watch:', this.statusPipePath);

    // Poll-based watching (more reliable than fs.watch on Windows)
    this.watchInterval = setInterval(async () => {
      await this.readAndProcessStatus();
    }, 500); // Check every 500ms
  }

  /**
   * Stop watching the status pipe file
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = undefined;
    }
    this.isWatching = false;
    console.log('[HookStateReceiver] Stopped watching');
  }

  /**
   * Read and process status from the pipe file
   */
  private async readAndProcessStatus(): Promise<void> {
    try {
      // Check if file exists
      try {
        await fs.access(this.statusPipePath);
      } catch {
        // File doesn't exist yet, skip
        return;
      }

      // Read file content
      const content = await fs.readFile(this.statusPipePath, 'utf-8');

      // Skip if empty
      if (!content.trim()) {
        return;
      }

      // Parse JSON
      const data = JSON.parse(content);

      // Extract hook-specific output
      if (data.hookSpecificOutput) {
        const { hookEventName, additionalContext, systemMessage } = data.hookSpecificOutput;

        // Parse SubagentStart/SubagentStop events
        if (hookEventName === 'SubagentStart' || hookEventName === 'SubagentStop') {
          let status: HookStatus | undefined;

          // Try to parse additional context
          if (additionalContext) {
            try {
              status = JSON.parse(additionalContext);
            } catch {
              console.warn('[HookStateReceiver] Failed to parse additionalContext:', additionalContext);
            }
          }

          // Fallback: extract from systemMessage
          if (!status && systemMessage) {
            status = this.parseSystemMessage(hookEventName, systemMessage);
          }

          // Trigger callback if status parsed successfully
          if (status && this.statusCallback) {
            console.log('[HookStateReceiver] Received status:', status);
            this.statusCallback(status);
          }
        }
      }

      // Clear file after processing (optional)
      // await fs.writeFile(this.statusPipePath, '');

    } catch (error) {
      // Silent failure for JSON parse errors (might be partial write)
      if (!(error instanceof SyntaxError)) {
        console.error('[HookStateReceiver] Error reading status:', error);
      }
    }
  }

  /**
   * Parse system message to extract status
   *
   * Fallback method when additionalContext is not available.
   * Extracts status from the system message format.
   */
  private parseSystemMessage(event: string, message: string): HookStatus | undefined {
    // Example format:
    // "I'm going to use the Task tool to launch a bug-debugger agent specialized in..."
    // "I'm now using the commit skill..."

    const eventType = event === 'SubagentStart' ? 'START' : 'STOP';

    // Try to match agent/skill/plugin patterns
    const agentMatch = message.match(/(\w+)\s+agent/);
    const skillMatch = message.match(/(\w+)\s+skill/);
    const pluginMatch = message.match(/(\w+)\s+plugin/);

    if (agentMatch) {
      return {
        event: eventType,
        agentId: agentMatch[1],
        agentName: agentMatch[1],
        type: 'agent',
        timestamp: Date.now()
      };
    }

    if (skillMatch) {
      return {
        event: eventType,
        agentId: skillMatch[1],
        agentName: skillMatch[1],
        type: 'skill',
        timestamp: Date.now()
      };
    }

    if (pluginMatch) {
      return {
        event: eventType,
        agentId: pluginMatch[1],
        agentName: pluginMatch[1],
        type: 'plugin',
        timestamp: Date.now()
      };
    }

    return undefined;
  }

  /**
   * Get the status pipe path
   */
  getPipePath(): string {
    return this.statusPipePath;
  }

  /**
   * Check if currently watching
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopWatching();
    this.statusCallback = undefined;
  }
}
