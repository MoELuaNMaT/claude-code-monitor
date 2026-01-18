import * as vscode from 'vscode';
import { AgentColorReader } from './agentColorReader';

export interface ColorConfig {
  agent: string;
  skill: string;
  plugin: string;
}

// Runtime color configuration (includes specific colors for each agent)
export interface RuntimeColorConfig {
  defaultColors: ColorConfig;  // Default colors
  agentColors: { [agentName: string]: string };  // Agent-specific colors {agentName: color}
}

export class ColorConfigManager {
  private static readonly DEFAULT_COLORS: ColorConfig = {
    agent: '#10b981',
    skill: '#8b5cf6',
    plugin: '#007acc'
  };

  private agentColorReader: AgentColorReader;

  constructor() {
    this.agentColorReader = new AgentColorReader();
  }

  /**
   * Get default color configuration (from VSCode settings)
   */
  static getDefaultConfig(): ColorConfig {
    const config = vscode.workspace.getConfiguration('claudeMonitor');
    const colors = config.get<any>('colors', {});

    return {
      agent: colors.agent || this.DEFAULT_COLORS.agent,
      skill: colors.skill || this.DEFAULT_COLORS.skill,
      plugin: colors.plugin || this.DEFAULT_COLORS.plugin
    };
  }

  /**
   * Get runtime color configuration (includes agent-specific colors)
   */
  async getRuntimeConfig(agentNames: string[]): Promise<RuntimeColorConfig> {
    const defaultColors = ColorConfigManager.getDefaultConfig();
    const agentColorsMap = await this.agentColorReader.getAgentColors(agentNames);

    // Convert Map to plain object for JSON serialization
    const agentColors: { [agentName: string]: string } = {};
    agentColorsMap.forEach((color, name) => {
      agentColors[name] = color;
    });

    return {
      defaultColors,
      agentColors
    };
  }

  /**
   * Get the color for a specific agent (prioritize own color, otherwise use default)
   */
  async getAgentColor(agentName: string): Promise<string> {
    const agentColor = await this.agentColorReader.getAgentColor(agentName);
    return agentColor || ColorConfigManager.getDefaultConfig().agent;
  }

  // Listen for configuration changes
  static onDidChangeConfiguration(callback: (config: ColorConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeMonitor.colors')) {
        callback(ColorConfigManager.getDefaultConfig());
      }
    });
  }
}
