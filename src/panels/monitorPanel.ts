import * as vscode from 'vscode';
import * as path from 'path';
import { QuotaManager } from '../quota/quotaManager';
import { TerminalListener } from '../monitor/terminalListener';
import { ConfigReader } from '../monitor/configReader';
import { TerminalEvent } from '../types';
import { AGENT_LIST } from '../monitor/agentList';
import { ColorConfigManager } from '../monitor/colorConfig';
import { ImageQueue } from '../imageQueue/imageQueue';

/**
 * Monitor panel - main webview panel
 */
export class MonitorPanel {
  public static currentPanel: MonitorPanel | undefined;
  public static readonly viewType = 'claudeMonitorView';

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private quotaManager: QuotaManager;
  private terminalListener: TerminalListener;
  private configReader: ConfigReader;
  private colorManager: ColorConfigManager;
  private agentNames: string[];
  private imageQueue: ImageQueue;

  /**
   * Create or show the panel
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    quotaManager: QuotaManager,
    terminalListener: TerminalListener,
    configReader: ConfigReader,
    imageQueue: ImageQueue
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (MonitorPanel.currentPanel) {
      MonitorPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      MonitorPanel.viewType,
      'Claude Monitor',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'src', 'panels', 'webview')
        ]
      }
    );

    MonitorPanel.currentPanel = new MonitorPanel(
      panel,
      context,
      quotaManager,
      terminalListener,
      configReader,
      imageQueue
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    quotaManager: QuotaManager,
    terminalListener: TerminalListener,
    configReader: ConfigReader,
    imageQueue: ImageQueue
  ) {
    this._panel = panel;
    this.quotaManager = quotaManager;
    this.terminalListener = terminalListener;
    this.configReader = configReader;
    this.imageQueue = imageQueue;
    this.colorManager = new ColorConfigManager();
    this.agentNames = AGENT_LIST.map(a => a.name);

    // Set the webview's initial HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'getQuota':
            await this.handleGetQuota();
            break;
          case 'refreshQuota':
            await this.handleRefreshQuota();
            break;
          case 'getEvents':
            await this.handleGetEvents();
            break;
          case 'clearEvents':
            this.handleClearEvents();
            break;
          case 'getPlugins':
            await this.handleGetPlugins();
            break;
        case 'getSkills':
            await this.handleGetSkills();
            break;
        case 'getAgents':
            this.handleGetAgents();
            break;
        case 'getColors':
            await this.handleGetColors();
            break;
          case 'addImageToQueue':
            this.handleAddImageToQueue(message.data);
            break;
          case 'removeImageFromQueue':
            this.handleRemoveImageFromQueue(message.data);
            break;
          case 'getImageQueue':
            this.handleGetImageQueue();
            break;
          case 'getMcpTools':
            await this.handleGetMcpTools();
            break;
          case 'openSkillFile':
            await this.handleOpenSkillFile(message.data);
            break;
          case 'openAgentFile':
            await this.handleOpenAgentFile(message.data);
            break;
        }
      },
      null,
      this._disposables
    );

    // Send initial data
    this.sendInitialData();
  }

  /**
   * Handle get quota request
   */
  private async handleGetQuota(): Promise<void> {
    const quota = await this.quotaManager.getQuotaStatus();
    this._panel.webview.postMessage({
      type: 'quotaUpdate',
      data: quota
    });
  }

  /**
   * Handle refresh quota request
   */
  private async handleRefreshQuota(): Promise<void> {
    const quota = await this.quotaManager.getQuotaStatus(true);
    this._panel.webview.postMessage({
      type: 'quotaUpdate',
      data: quota
    });
  }

  /**
   * Handle get events request
   */
  private async handleGetEvents(): Promise<void> {
    const events = this.terminalListener.getEvents();
    this._panel.webview.postMessage({
      type: 'eventsUpdate',
      data: events
    });
  }

  /**
   * Handle clear events request
   */
  private handleClearEvents(): void {
    this.terminalListener.clearEvents();
    this._panel.webview.postMessage({
      type: 'eventsUpdate',
      data: []
    });
  }

  /**
   * Handle get plugins request
   */
  private async handleGetPlugins(): Promise<void> {
    const plugins = await this.configReader.getInstalledPlugins();
    this._panel.webview.postMessage({
      type: 'pluginsUpdate',
      data: plugins
    });
  }

  /**
   * Handle get skills request
   */
  private async handleGetSkills(): Promise<void> {
    const skills = await this.configReader.getAvailableSkills();
    this._panel.webview.postMessage({
      type: 'skillsUpdate',
      data: skills
    });
  }

  /**
   * Handle get agents request
   */
  private handleGetAgents(): void {
    this._panel.webview.postMessage({
      type: 'agentsUpdate',
      data: AGENT_LIST
    });
  }

  /**
   * Handle get colors request
   */
  private async handleGetColors(): Promise<void> {
    const runtimeConfig = await this.colorManager.getRuntimeConfig(this.agentNames);
    this._panel.webview.postMessage({
      type: 'colorsUpdate',
      data: runtimeConfig
    });
  }

  /**
   * Handle add image to queue request
   */
  private handleAddImageToQueue(imageData: any): void {
    this.imageQueue.add(imageData);
  }

  /**
   * Handle remove image from queue request
   */
  private handleRemoveImageFromQueue(imageId: string): void {
    this.imageQueue.remove(imageId);
  }

  /**
   * Handle get image queue request
   */
  private handleGetImageQueue(): void {
    const queue = this.imageQueue.getAll();
    this._panel.webview.postMessage({
      type: 'imageQueueUpdate',
      data: queue
    });
  }

  /**
   * Handle get MCP tools request
   */
  private async handleGetMcpTools(): Promise<void> {
    console.log('[MonitorPanel] Handle get MCP tools request');
    const mcpTools = await this.configReader.getMcpTools();
    console.log('[MonitorPanel] MCP tools received:', mcpTools.length, 'tools');
    this._panel.webview.postMessage({
      type: 'mcpToolsUpdate',
      data: mcpTools
    });
    console.log('[MonitorPanel] Sent mcpToolsUpdate message');
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

  /**
   * Send initial data to webview
   */
  private async sendInitialData(): Promise<void> {
    console.log('[MonitorPanel] Sending initial data to webview');
    await this.handleGetQuota();
    await this.handleGetEvents();
    await this.handleGetPlugins();
    await this.handleGetSkills();
    this.handleGetAgents();
    await this.handleGetMcpTools();
    await this.handleGetColors();
    this.handleGetImageQueue();
    console.log('[MonitorPanel] Initial data sending complete');
  }

  /**
   * Get HTML content for webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(
      this.context.extensionPath,
      'src',
      'panels',
      'webview',
      'index.html'
    );

    try {
      const fs = require('fs');
      let html = fs.readFileSync(htmlPath, 'utf-8');

      // The HTML file is self-contained, so we return it as-is
      return html;
    } catch (error) {
      return `<html><body><p>Error loading panel: ${error}</p></body></html>`;
    }
  }

  /**
   * Dispose
   */
  public dispose(): void {
    MonitorPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Send event update to webview
   */
  public sendEventUpdate(events: TerminalEvent[]): void {
    this._panel.webview.postMessage({
      type: 'eventsUpdate',
      data: events
    });
  }

  /**
   * Send running state update to webview
   */
  public updateRunningState(runningItems: any[]): void {
    this._panel.webview.postMessage({
      type: 'runningStateUpdate',
      data: runningItems
    });
  }

  /**
   * Get the webview instance
   */
  get webview(): vscode.Webview | undefined {
    return this._panel?.webview;
  }
}
