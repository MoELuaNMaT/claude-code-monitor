#!/usr/bin/env node

/**
 * Hook Status Sender
 *
 * Sends status updates from Claude Code Hook system to VSCode Extension.
 *
 * Usage:
 *   node send-status.mjs START <agentId> <agentName> <type> [model] [description]
 *   node send-status.mjs STOP <agentId>
 *
 * Environment Variables:
 *   - CLAUDE_PLUGIN_ROOT: Root directory of the plugin
 *   - VSCodeMonitor_HOOK_PIPE: Path to status pipe file (optional)
 *
 * Output Format:
 *   JSON with hookSpecificOutput containing:
 *   - hookEventName: "SubagentStart" or "SubagentStop"
 *   - additionalContext: JSON string with status details
 *   - systemMessage: Human-readable message
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node send-status.mjs <START|STOP> <agentId> [agentName] [type] [model] [description]');
  process.exit(1);
}

const event = args[0]; // START or STOP
const agentId = args[1];
const agentName = args[2] || agentId;
const type = args[3] || 'agent';
const model = args[4];
const description = args[5];

// Get pipe path from environment or use default
const pipePath = process.env.VSCodeMonitor_HOOK_PIPE ||
  path.join(os.tmpdir(), 'vscode-monitor-hook-status.pipe');

// Create status object
const status = {
  event: event,
  agentId: agentId,
  agentName: agentName,
  type: type,
  timestamp: Date.now(),
  ...(model && { model }),
  ...(description && { description })
};

// Create hook-specific output format
const hookOutput = {
  hookSpecificOutput: {
    hookEventName: event === 'START' ? 'SubagentStart' : 'SubagentStop',
    additionalContext: JSON.stringify(status),
    systemMessage: event === 'START'
      ? `I'm going to use the Task tool to launch a ${agentName} ${type}${description ? ` specialized in ${description}` : ''}`
      : `The ${agentName} ${type} has completed`
  }
};

// Write to pipe file
try {
  // Ensure directory exists
  const dir = path.dirname(pipePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write status to pipe file
  fs.writeFileSync(pipePath, JSON.stringify(hookOutput), 'utf-8');

  // Output to console (Hook system captures this)
  console.log(JSON.stringify(hookOutput));
} catch (error) {
  console.error('[HookStatusSender] Failed to write status:', error);
  process.exit(1);
}
