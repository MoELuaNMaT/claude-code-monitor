/**
 * Terminal Input Listener Module
 *
 * Listens to terminal input events and detects when the user presses Enter
 * to trigger image attachment
 */

import * as vscode from 'vscode';

export interface EnterDetectedEvent {
  terminalName: string;
  timestamp: number;
}

export type EnterCallback = (event: EnterDetectedEvent) => void;

/**
 * Terminal Input Listener
 *
 * Monitors terminal write events to detect when the user presses Enter
 */
export class TerminalInputListener {
  private disposable: vscode.Disposable | undefined;
  private terminalName?: string;
  private inputBuffer: Map<string, string> = new Map();

  constructor(private onEnter: EnterCallback) {}

  /**
   * Start listening to terminal input
   */
  start(): void {
    if (this.disposable) {
      return; // Already started
    }

    // Check if API is available (experimental API)
    if (!('onDidWriteTerminalData' in (vscode.window as any))) {
      console.warn('[TerminalInputListener] onDidWriteTerminalData API not available');
      return;
    }

    // Listen to terminal write events
    this.disposable = (vscode.window as any).onDidWriteTerminalData((event: any) => {
      this.handleTerminalData(event);
    });
  }

  /**
   * Stop listening to terminal input
   */
  stop(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = undefined;
    }
    this.inputBuffer.clear();
  }

  /**
   * Handle terminal data write event
   */
  private handleTerminalData(event: { terminal: vscode.Terminal; data: string }): void {
    try {
      const { terminal, data } = event;
      const terminalName = terminal.name;

      // [DEBUG] Log event trigger
      console.log('[TerminalInputListener] handleTerminalData called, terminal:', terminalName, 'data length:', data.length);

      // Check if this is a Claude Code terminal
      const isClaude = this.isClaudeTerminal(terminalName);
      console.log('[TerminalInputListener] isClaudeTerminal:', isClaude, 'for terminal:', terminalName);

      if (!isClaude) {
        return;
      }

      // Get or initialize input buffer for this terminal
      let buffer = this.inputBuffer.get(terminalName) || '';

      // Append new data to buffer
      buffer += data;
      this.inputBuffer.set(terminalName, buffer);

      // Check if Enter was pressed (newline character)
      const hasEnter = this.detectEnterKey(data);
      console.log('[TerminalInputListener] detectEnterKey:', hasEnter, 'data contains \\n:', data.includes('\n'), 'data contains \\r:', data.includes('\r'));

      if (hasEnter) {
        console.log('[TerminalInputListener] Enter detected! Triggering callback...');
        // Trigger callback
        this.onEnter({
          terminalName,
          timestamp: Date.now()
        });

        // Clear buffer after Enter
        this.inputBuffer.set(terminalName, '');
      }
    } catch (error) {
      console.error('[TerminalInputListener] Error handling terminal data:', error);
    }
  }

  /**
   * Detect if the data contains an Enter key press
   * Checks if data contains newline characters
   * Note: May trigger on terminal output as well, but that's acceptable for our use case
   */
  private detectEnterKey(data: string): boolean {
    // Check if data contains newline characters (Enter key)
    const hasNewline = data.includes('\n') || data.includes('\r');

    // [DEBUG] Log for diagnosis
    console.log('[TerminalInputListener] detectEnterKey - hasNewline:', hasNewline);

    if (hasNewline) {
      console.log('[TerminalInputListener] Enter detected! Newline found in data.');
    }

    return hasNewline;
  }

  /**
   * Check if this is a Claude Code terminal
   * Returns true for Claude-related terminals or accepts any terminal as fallback
   */
  private isClaudeTerminal(name: string): boolean {
    if (!name) {
      return false;
    }

    const lowerName = name.toLowerCase();
    const isMatch = (
      lowerName.includes('claude') ||
      lowerName.includes('code') ||
      lowerName.includes('bash') ||
      lowerName.includes('powershell') ||
      lowerName.includes('pwsh')
    );

    // Fallback: accept any terminal if no specific match
    // This allows the image queue to work with any terminal (e.g., node)
    if (!isMatch) {
      console.log('[TerminalInputListener] Using fallback for terminal:', name);
      return true;
    }

    return true;
  }

  /**
   * Get the current input buffer for a terminal
   */
  getBuffer(terminalName: string): string {
    return this.inputBuffer.get(terminalName) || '';
  }

  /**
   * Clear the input buffer for a terminal
   */
  clearBuffer(terminalName: string): void {
    this.inputBuffer.set(terminalName, '');
  }

  /**
   * Dispose the terminal input listener
   */
  dispose(): void {
    this.stop();
  }
}
