# Claude Code Monitor

> A powerful VSCode extension for real-time monitoring of Claude Code terminal activity, API quota usage, and execution tracking.

![Version](https://img.shields.io/visual-studio-marketplace/v/claude-code-monitor.claude-code-monitor)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/claude-code-monitor.claude-code-monitor)
![Rating](https://img.shields.io/visual-studio-marketplace/r/claude-code-monitor.claude-code-monitor)
![License](https://img.shields.io/github/license/username/claude-code-monitor)

## Features

### Real-Time Monitoring
- **Live Activity Feed**: Monitor Claude Code terminal output in real-time
- **Tool Call Tracking**: See all tool calls (`[Bash]`, `[Read]`, `[Write]`, etc.)
- **Skill/Agent Detection**: Highlight active skills and agents with color-coded indicators
- **MCP Tools Support**: Track Model Context Protocol tool usage

### API Quota Management
- **Multi-Provider Support**: Anthropic, GLM (Zhipu AI), and custom providers
- **Real-Time Usage Display**: See current token usage with visual progress bars
- **Color-Coded Warnings**:
  - <span style="color:#10b981">**Green**</span>: Usage < 50%
  - <span style="color:#f59e0b">**Yellow**</span>: Usage 50-80%
  - <span style="color:#ef4444">**Red**</span>: Usage > 80%
- **Auto-Refresh**: Quota data refreshes automatically (configurable interval)
- **Manual Refresh**: One-click quota refresh button

### Plugin & Skill Management
- **Installed Plugins**: View all installed Claude Code plugins
- **Available Skills**: Browse available skills with descriptions
- **Agent Discovery**: Automatically discover and list all configured agents
- **File Quick Access**: Click to open skill/agent definition files

### Plan Mode Tracking
- **Step Progress**: Monitor Plan mode execution progress
- **Step Completion**: See which steps are completed, in progress, or pending
- **Clear Visual Indicators**: Progress bar shows completion percentage

### Image Queue
- **Drag & Drop**: Queue images to send to Claude Code terminal
- **Queue Management**: Add, remove, and reorder images
- **Auto-Send**: Images automatically sent when you press Enter in terminal

## Screenshots

### Main Monitor Panel
![Main Panel](https://github.com/username/claude-code-monitor/raw/main/screenshots/main-panel.png)

### Quota Monitoring
![Quota Section](https://github.com/username/claude-code-monitor/raw/main/screenshots/quota-section.png)

### Activity Feed
![Activity Feed](https://github.com/username/claude-code-monitor/raw/main/screenshots/activity-feed.png)

## Installation

### From VSCode Marketplace

1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Claude Code Monitor"
4. Click "Install"

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/username/claude-code-monitor.git
cd claude-code-monitor

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Prerequisites

- VSCode >= 1.85.0
- Node.js >= 16.x
- Claude Code CLI installed
- `ANTHROPIC_AUTH_TOKEN` environment variable set (for Anthropic quota monitoring)

## Usage

### Opening the Monitor

1. Open Claude Code terminal in VSCode
2. Click the eye icon in the activity bar sidebar
3. The monitor panel will appear automatically

### Quick Actions

| Action | How |
|--------|-----|
| Refresh Quota | Click the refresh button in the Quota section |
| Clear Events | Click "Clear" button in the Activity section |
| Open Skill File | Click on a skill card to view its definition |
| Open Agent File | Click on an agent card to view its documentation |
| Queue Image | Drag & drop images into the panel or use the add button |

## Configuration

Configure the extension in VSCode settings (`Preferences > Settings > Extensions > Claude Monitor`):

```json
{
  // Auto-refresh interval (in minutes)
  "claudeMonitor.autoRefreshInterval": 5,

  // Show Plan execution progress
  "claudeMonitor.showPlanProgress": true,

  // Quota warning threshold (percentage)
  "claudeMonitor.quotaWarningThreshold": 80,

  // Auto-refresh interval (in seconds) for more granular control
  "claudeMonitor.autoRefreshIntervalSeconds": 30,

  // Running state highlight colors
  "claudeMonitor.colors.agent": "#10b981",
  "claudeMonitor.colors.skill": "#8b5cf6",
  "claudeMonitor.colors.plugin": "#007acc",
  "claudeMonitor.colors.mcp": "#f59e0b",

  // Messages without event before stopping highlight
  "claudeMonitor.runningStateMissThreshold": 5
}
```

## API Providers

### Anthropic
- Reads API key from `ANTHROPIC_AUTH_TOKEN` environment variable
- Parses `~/.claude/history.jsonl` for token usage
- Supports: Free, Pro, Team tiers

### GLM (Zhipu AI)
- Reads API configuration from `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`
- Queries `/api/monitor/usage/quota/limit` endpoint
- Supports: ZAI and ZHIPU platforms

### Custom Providers
You can add custom quota providers by extending the `BaseQuotaProvider` class. See the [Architecture Documentation](docs/architecture.md) for details.

## Commands

The following commands are available in the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Claude Monitor: Open Claude Monitor` | Opens the monitor panel |
| `Claude Monitor: Refresh Quota` | Manually refresh API quota data |

## Development

### Project Structure

```
claude-code-monitor/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── quota/                    # Quota monitoring
│   ├── monitor/                  # Terminal monitoring
│   ├── panels/                   # UI components
│   └── types/                   # TypeScript definitions
├── resources/                   # Icons and assets
├── docs/                       # Documentation
└── package.json                # Extension manifest
```

### Building

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run linter
npm run lint

# Run tests
npm run test
```

### Testing

1. Press `F5` in VSCode to launch the Extension Development Host
2. In the new window, open a Claude Code terminal
3. Use the monitor panel to test functionality

## Changelog

### Version 0.1.0
- Initial release
- API quota monitoring for Anthropic and GLM
- Real-time terminal activity tracking
- Plugin, skill, and agent discovery
- Plan mode progress tracking
- Image queue functionality

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/username/claude-code-monitor/issues)
- **Discussions**: Ask questions and share ideas in [GitHub Discussions](https://github.com/username/claude-code-monitor/discussions)

## Credits

Built with ❤️ for the Claude Code community.

Extension icon designed to represent "monitoring" with an eye containing the Claude Code symbol.

## Privacy

This extension:
- Reads local Claude Code configuration files from `~/.claude/`
- Does not send any data to external servers (except for quota API calls to your configured providers)
- Does not collect or transmit user information
- Stores quota data locally in VSCode's global state

---

**Made with ❤️ by [Your Name]**

[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=claude-code-monitor.claude-code-monitor) | [GitHub](https://github.com/username/claude-code-monitor)
