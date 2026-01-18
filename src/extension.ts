import * as vscode from 'vscode';
import { QuotaManager } from './quota/quotaManager';
import { TerminalListener } from './monitor/terminalListener';
import { ConfigReader } from './monitor/configReader';
import { MonitorPanel } from './panels/monitorPanel';
import { RunningStateManager, RunningItem } from './monitor/runningStateManager';
import { ItemTypeResolver } from './monitor/itemTypeResolver';
import { ColorConfigManager, ColorConfig } from './monitor/colorConfig';
import { ImageQueue } from './imageQueue/imageQueue';
import { TerminalInputListener } from './terminal/terminalInputListener';
import { ImageSender } from './imageSender/imageSender';
import { AgentDiscovery } from './monitor/agentDiscovery';
import { HookStateReceiver } from './monitor/hookStateReceiver';
import { AgentInfo } from './types';

/**
 * Activate extension
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Monitor is now active');

  // Test terminal events for debugging
  vscode.window.onDidOpenTerminal((terminal) => {
    console.log('[DEBUG] Terminal opened:', terminal.name);
  });

  vscode.window.onDidChangeTerminalState((terminal) => {
    console.log('[DEBUG] Terminal state changed:', terminal.name);
  });

  // Initialize managers
  const quotaManager = new QuotaManager(context);
  const configReader = new ConfigReader();
  const runningStateManager = new RunningStateManager();

  // Initialize Hook State Receiver for Claude Code Hook system integration
  const hookStateReceiver = new HookStateReceiver();
  hookStateReceiver.setStatusCallback((status) => {
    // Forward Hook status to RunningStateManager
    runningStateManager.handleHookStatus(status);
    console.log('[Extension] Hook status received:', status.event, status.agentName, status.type);

    // Notify webviews of running state update
    const runningItems = runningStateManager.getRunningItems();
    if (viewProvider?.webview) {
      viewProvider.webview.postMessage({
        type: 'runningStateUpdate',
        data: runningItems
      });
    }
    if (MonitorPanel.currentPanel?.webview) {
      MonitorPanel.currentPanel.webview.postMessage({
        type: 'runningStateUpdate',
        data: runningItems
      });
    }
  });
  console.log('[Extension] Hook state receiver initialized, pipe:', hookStateReceiver.getPipePath());

  // Initialize AgentDiscovery for dynamic agent detection
  const agentDiscovery = new AgentDiscovery();
  const discoveredAgents = await agentDiscovery.discoverAgents();
  console.log('[Extension] Discovered agents:', discoveredAgents.length);

  // Initialize image upload modules
  const imageQueue = new ImageQueue();
  const imageSender = new ImageSender(context);

  // Create terminal input listener to detect Enter key and send image paths
  // When user presses Enter, send all queued image paths to terminal, then clear queue
  const terminalInputListener = new TerminalInputListener(async () => {
    console.log('[TerminalInputCallback] Enter detected! Queue size:', imageQueue.getAll().length);

    // Send all queued image paths to terminal
    if (!imageQueue.isEmpty()) {
      try {
        const images = imageQueue.getAll();
        console.log('[TerminalInputCallback] Sending', images.length, 'image(s)');

        // Send each image path to terminal input
        for (const image of images) {
          await imageSender.sendPathToInput(image);
        }

        // Clear queue after sending
        imageQueue.clear();
        console.log('[TerminalInputCallback] Queue cleared. Size:', imageQueue.getAll().length);

        // Notify webviews of queue update
        const updatedQueue = imageQueue.getAll();
        if (viewProvider?.webview) {
          viewProvider.webview.postMessage({
            type: 'imageQueueUpdate',
            data: updatedQueue
          });
        }
        if (MonitorPanel.currentPanel?.webview) {
          MonitorPanel.currentPanel.webview.postMessage({
            type: 'imageQueueUpdate',
            data: updatedQueue
          });
        }
      } catch (error) {
        console.error('[TerminalInputCallback] Error sending images:', error);
      }
    } else {
      console.log('[TerminalInputCallback] Queue is empty, nothing to send');
    }
  });

  // Start listening to terminal input
  terminalInputListener.start();

  // Set up queue change notification to update webviews
  imageQueue.onChange(() => {
    const updatedQueue = imageQueue.getAll();
    if (viewProvider?.webview) {
      viewProvider.webview.postMessage({
        type: 'imageQueueUpdate',
        data: updatedQueue
      });
    }
    if (MonitorPanel.currentPanel?.webview) {
      MonitorPanel.currentPanel.webview.postMessage({
        type: 'imageQueueUpdate',
        data: updatedQueue
      });
    }
  });

  // Create item type resolver for distinguishing agents from plugins
  const itemTypeResolver = new ItemTypeResolver(
    () => configReader.getInstalledPlugins(),
    async () => discoveredAgents,
    () => configReader.getAvailableSkills(),
    // Add MCP callback, using adapter to convert McpToolInfo[] to { name: string }[]
    async () => {
      const mcpTools = await configReader.getMcpTools();
      return mcpTools.map(mcp => ({ name: mcp.name }));
    }
  );

  // Initialize ItemTypeResolver cache immediately to avoid "Unknown item" issue
  await itemTypeResolver.refreshCache();

  // Create color manager for color configuration
  const colorManager = new ColorConfigManager();

  // Get all agent names for reading colors
  const agentNames = discoveredAgents.map(a => a.name);

  // Get user's terminal execute keybinding
  // TODO: Auto-detect from VSCode keybindings.json
  // Currently hardcoded to Alt+Enter based on user's setup
  const terminalExecuteKey = 'Alt+Enter';
  console.log('[Extension] Terminal execute keybinding:', terminalExecuteKey);

  // Declare viewProvider variable first
  let viewProvider: MonitorViewProvider;

  // Create terminal listener with callback
  const terminalListener = new TerminalListener(
    (newEvents) => {
      // Handle terminal events (batch)
      console.log('Terminal events:', newEvents.length, 'new events');

      // Sync dynamically discovered MCPs to ItemTypeResolver
      const dynamicMcps = terminalListener.getDiscoveredMcps();
      if (dynamicMcps.length > 0) {
        itemTypeResolver.updateDynamicMcps(dynamicMcps);
        console.log('[Extension] Synced dynamic MCPs:', dynamicMcps);
      }

      // Get full buffer for display
      const allEvents = terminalListener.getEvents();

      // Notify sidebar webview
      if (viewProvider?.webview) {
        viewProvider.webview.postMessage({
          type: 'eventsUpdate',
          data: allEvents
        });
      }

      // Notify active panel if any
      if (MonitorPanel.currentPanel) {
        MonitorPanel.currentPanel.sendEventUpdate(allEvents);
      }
    },
    // Running state callback - simplified, no wildcard handling
    (id: string, name: string, type: 'agent' | 'skill' | 'plugin' | 'mcp', state: 'start' | 'stop') => {
      if (state === 'start') {
        runningStateManager.startRunning(id, name, type);
      } else {
        // Direct stop by ID, no wildcard handling
        runningStateManager.stopRunning(id);
      }

      // Notify WebView of running state changes
      const runningItems = runningStateManager.getRunningItems();
      viewProvider?.updateRunningState(runningItems);

      // Notify panel if active
      if (MonitorPanel.currentPanel) {
        MonitorPanel.currentPanel.updateRunningState(runningItems);
      }
    }
  );

  // Set item type resolver to parser for plugin/agent distinction
  terminalListener.setItemTypeResolver(itemTypeResolver);

  // Register webview view provider for sidebar (create after terminalListener)
  viewProvider = new MonitorViewProvider(context, quotaManager, terminalListener, configReader, colorManager, agentNames, imageQueue, imageSender, terminalExecuteKey, discoveredAgents);

  // Set up quota update callback to notify all active webviews
  quotaManager.onQuotaUpdate((quota) => {
    // Notify sidebar webview
    if (viewProvider?.webview) {
      viewProvider.webview.postMessage({
        type: 'quotaUpdate',
        data: quota
      });
    }

    // Notify panel webview if active
    if (MonitorPanel.currentPanel?.webview) {
      MonitorPanel.currentPanel.webview.postMessage({
        type: 'quotaUpdate',
        data: quota
      });
    }
  });

  // Set up color configuration change listener
  ColorConfigManager.onDidChangeConfiguration(async (newColors) => {
    // Re-fetch runtime config (includes agent-specific colors)
    const runtimeConfig = await colorManager.getRuntimeConfig(agentNames);

    // Notify sidebar webview
    if (viewProvider?.webview) {
      viewProvider.webview.postMessage({
        type: 'colorsUpdate',
        data: runtimeConfig
      });
    }

    // Notify panel webview if active
    if (MonitorPanel.currentPanel?.webview) {
      MonitorPanel.currentPanel.webview.postMessage({
        type: 'colorsUpdate',
        data: runtimeConfig
      });
    }
  });

  // Register open monitor command
  const openMonitorCommand = vscode.commands.registerCommand(
    'claudeMonitor.openMonitor',
    () => {
      MonitorPanel.createOrShow(context, quotaManager, terminalListener, configReader, imageQueue);
    }
  );

  // Register refresh quota command
  const refreshQuotaCommand = vscode.commands.registerCommand(
    'claudeMonitor.refreshQuota',
    async () => {
      await quotaManager.refreshQuota();
      vscode.window.showInformationMessage('Quota refreshed');
    }
  );

  // Add to disposables
  context.subscriptions.push(
    openMonitorCommand,
    refreshQuotaCommand,
    vscode.window.registerWebviewViewProvider('claudeMonitorView', viewProvider),
    quotaManager,
    terminalListener,
    terminalInputListener
  );

  // Show welcome message on first activation
  vscode.window.showInformationMessage(
    'Claude Code Monitor activated! Use "Open Claude Monitor" command to view the panel.'
  );
}

/**
 * Deactivate extension
 */
export function deactivate() {
  console.log('Claude Code Monitor is now deactivated');
}

/**
 * Monitor View Provider for sidebar
 */
class MonitorViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _discoveredAgents: AgentInfo[];

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _quotaManager: QuotaManager,
    private readonly _terminalListener: TerminalListener,
    private readonly _configReader: ConfigReader,
    private readonly _colorManager: ColorConfigManager,
    private readonly _agentNames: string[],
    private readonly _imageQueue: ImageQueue,
    private readonly _imageSender: ImageSender,
    private readonly _terminalExecuteKey: string,
    discoveredAgents: AgentInfo[]
  ) {
    this._discoveredAgents = discoveredAgents;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, 'src', 'panels', 'webview')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'getQuota':
          const quota = await this._quotaManager.getQuotaStatus();
          webviewView.webview.postMessage({
            type: 'quotaUpdate',
            data: quota
          });
          break;
        case 'refreshQuota':
          const refreshed = await this._quotaManager.getQuotaStatus(true);
          webviewView.webview.postMessage({
            type: 'quotaUpdate',
            data: refreshed
          });
          break;
        case 'getEvents':
          const events = this._terminalListener.getEvents();
          webviewView.webview.postMessage({
            type: 'eventsUpdate',
            data: events
          });
          break;
        case 'clearEvents':
          this._terminalListener.clearEvents();
          webviewView.webview.postMessage({
            type: 'eventsUpdate',
            data: []
          });
          break;
        case 'getPlugins':
          const plugins = await this._configReader.getInstalledPlugins();
          webviewView.webview.postMessage({
            type: 'pluginsUpdate',
            data: plugins
          });
          break;
        case 'getSkills':
          const skills = await this._configReader.getAvailableSkills();
          webviewView.webview.postMessage({
            type: 'skillsUpdate',
            data: skills
          });
          break;
        case 'getAgents':
          webviewView.webview.postMessage({
            type: 'agentsUpdate',
            data: this._discoveredAgents
          });
          break;
        case 'getColors':
          const runtimeConfig = await this._colorManager.getRuntimeConfig(this._agentNames);
          webviewView.webview.postMessage({
            type: 'colorsUpdate',
            data: runtimeConfig
          });
          break;
        case 'getMcpTools':
          const mcpTools = await this._configReader.getMcpTools();
          webviewView.webview.postMessage({
            type: 'mcpToolsUpdate',
            data: mcpTools
          });
          break;
        case 'addImageToQueue':
          // Add image to queue for display (don't send yet)
          console.log('[addImageToQueue] Adding image to queue');
          this._imageQueue.add(message.data);
          console.log('[addImageToQueue] Queue size after add:', this._imageQueue.getAll().length);
          break;
        case 'removeImageFromQueue':
          // Remove image from queue
          this._imageQueue.remove(message.data);
          break;
        case 'getImageQueue':
          // Get current queue state
          const queue = this._imageQueue.getAll();
          webviewView.webview.postMessage({
            type: 'imageQueueUpdate',
            data: queue
          });
          break;
        case 'openSkillFile':
          await this.handleOpenSkillFile(message.data);
          break;
        case 'openAgentFile':
          await this.handleOpenAgentFile(message.data);
          break;
      }
    });

    // Send initial data
    this.sendInitialData(webviewView);
  }

  private async sendInitialData(webviewView: vscode.WebviewView): Promise<void> {
    const quota = await this._quotaManager.getQuotaStatus();
    webviewView.webview.postMessage({
      type: 'quotaUpdate',
      data: quota
    });

    const plugins = await this._configReader.getInstalledPlugins();
    webviewView.webview.postMessage({
      type: 'pluginsUpdate',
      data: plugins
    });

    const events = this._terminalListener.getEvents();
    webviewView.webview.postMessage({
      type: 'eventsUpdate',
      data: events
    });

    const skills = await this._configReader.getAvailableSkills();
    webviewView.webview.postMessage({
      type: 'skillsUpdate',
      data: skills
    });

    webviewView.webview.postMessage({
      type: 'agentsUpdate',
      data: this._discoveredAgents
    });

    // Send MCP tools
    const mcpTools = await this._configReader.getMcpTools();
    webviewView.webview.postMessage({
      type: 'mcpToolsUpdate',
      data: mcpTools
    });

    // Send color configuration
    const runtimeConfig = await this._colorManager.getRuntimeConfig(this._agentNames);
    webviewView.webview.postMessage({
      type: 'colorsUpdate',
      data: runtimeConfig
    });

    // Send initial image queue state
    const imageQueue = this._imageQueue.getAll();
    webviewView.webview.postMessage({
      type: 'imageQueueUpdate',
      data: imageQueue
    });

    // Send terminal execute keybinding
    webviewView.webview.postMessage({
      type: 'terminalExecuteKey',
      data: this._terminalExecuteKey
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const path = require('path');
    const fs = require('fs');

    const htmlPath = path.join(
      this._context.extensionPath,
      'src',
      'panels',
      'webview',
      'index.html'
    );

    try {
      let html = fs.readFileSync(htmlPath, 'utf-8');
      return html;
    } catch (error) {
      return `<html><body><p>Error loading panel: ${error}</p></body></html>`;
    }
  }

  /**
   * Update running state in webview
   */
  updateRunningState(runningItems: RunningItem[]): void {
    if (this._view?.webview) {
      this._view.webview.postMessage({
        type: 'runningStateUpdate',
        data: runningItems
      });
    }
  }

  /**
   * Handle open skill file request
   */
  private async handleOpenSkillFile(skillData: { id: string; mdPath?: string }): Promise<void> {
    if (!skillData.mdPath) {
      vscode.window.showWarningMessage(`Skill file path not available for: ${skillData.id}`);
      return;
    }

    try {
      const uri = vscode.Uri.file(skillData.mdPath);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        vscode.window.showErrorMessage(`Skill file not found: ${skillData.mdPath}`);
        return;
      }

      // Open file in new editor
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open skill file: ${error}`);
    }
  }

  /**
   * Handle open agent file request
   */
  private async handleOpenAgentFile(agentData: { id: string; mdPath?: string; docUrl?: string; source?: string }): Promise<void> {
    // Builtin agent: open official documentation
    if (agentData.source === 'builtin' && agentData.docUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(agentData.docUrl));
      return;
    }

    // File agent: open local MD file
    if (!agentData.mdPath) {
      vscode.window.showWarningMessage(`Agent file path not available for: ${agentData.id}`);
      return;
    }

    try {
      const uri = vscode.Uri.file(agentData.mdPath);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        vscode.window.showErrorMessage(`Agent file not found: ${agentData.mdPath}`);
        return;
      }

      // Open file in new editor
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open agent file: ${error}`);
    }
  }

  get webview(): vscode.Webview | undefined {
    return this._view?.webview;
  }
}
