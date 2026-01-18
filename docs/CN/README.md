# Claude Code Monitor

> 一个功能强大的 VSCode 扩展，用于实时监控 Claude Code 终端活动、API 配额使用和执行跟踪。

![Version](https://img.shields.io/visual-studio-marketplace/v/claude-code-monitor.claude-code-monitor)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/claude-code-monitor.claude-code-monitor)
![Rating](https://img.shields.io/visual-studio-marketplace/r/claude-code-monitor.claude-code-monitor)
![License](https://img.shields.io/github/license/username/claude-code-monitor)

## 功能特性

### 实时监控
- **实时活动流**: 实时监控 Claude Code 终端输出
- **工具调用跟踪**: 查看所有工具调用（`[Bash]`、`[Read]`、`[Write]` 等）
- **技能/代理检测**: 使用颜色编码指示器高亮显示活跃的技能和代理
- **MCP 工具支持**: 跟踪模型上下文协议（MCP）工具使用情况

### API 配额管理
- **多提供商支持**: Anthropic、GLM（智谱AI）和自定义提供商
- **实时使用显示**: 查看当前令牌使用情况和可视化进度条
- **颜色编码警告**:
  - <span style="color:#10b981">**绿色**</span>: 使用量 < 50%
  - <span style="color:#f59e0b">**黄色**</span>: 使用量 50-80%
  - <span style="color:#ef4444">**红色**</span>: 使用量 > 80%
- **自动刷新**: 配额数据自动刷新（可配置间隔）
- **手动刷新**: 一键刷新配额按钮

### 插件和技能管理
- **已安装插件**: 查看所有已安装的 Claude Code 插件
- **可用技能**: 浏览可用技能及其描述
- **代理发现**: 自动发现并列出所有配置的代理
- **文件快速访问**: 点击即可打开技能/代理定义文件

### 计划模式跟踪
- **步骤进度**: 监控计划模式执行进度
- **步骤完成**: 查看哪些步骤已完成、进行中或待处理
- **清晰的视觉指示**: 进度条显示完成百分比

### 图片队列
- **拖放**: 将图片排队发送到 Claude Code 终端
- **队列管理**: 添加、删除和重新排列图片
- **自动发送**: 在终端中按 Enter 时自动发送图片

## 截图

### 主监控面板
![主面板](https://github.com/MoELuaNMaT/claude-code-monitor/raw/main/screenshots/main-panel.png)

### 配额监控
![配额部分](https://github.com/MoELuaNMaT/claude-code-monitor/raw/main/screenshots/quota-section.png)

### 活动流
![活动流](https://github.com/MoELuaNMaT/claude-code-monitor/raw/main/screenshots/activity-feed.png)

## 安装

### 从 VSCode Marketplace 安装

1. 打开 VSCode
2. 进入扩展（`Ctrl+Shift+X` 或 `Cmd+Shift+X`）
3. 搜索 "Claude Code Monitor"
4. 点击 "Install"

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/MoELuaNMaT/claude-code-monitor.git
cd claude-code-monitor

# 安装依赖
npm install

# 编译 TypeScript
npm run compile
```

### 前置要求

- VSCode >= 1.85.0
- Node.js >= 16.x
- 已安装 Claude Code CLI
- 已设置 `ANTHROPIC_AUTH_TOKEN` 环境变量（用于 Anthropic 配额监控）

## 使用方法

### 打开监控器

1. 在 VSCode 中打开 Claude Code 终端
2. 点击活动栏侧边栏中的眼睛图标
3. 监控面板将自动出现

### 快捷操作

| 操作 | 方法 |
|------|------|
| 刷新配额 | 点击配额部分中的刷新按钮 |
| 清除事件 | 点击活动部分中的 "清除" 按钮 |
| 打开技能文件 | 点击技能卡片查看其定义 |
| 打开代理文件 | 点击代理卡片查看其文档 |
| 排队图片 | 将图片拖放到面板中或使用添加按钮 |

## 配置

在 VSCode 设置中配置扩展（`首选项 > 设置 > 扩展 > Claude Monitor`）：

```json
{
  // 自动刷新间隔（分钟）
  "claudeMonitor.autoRefreshInterval": 5,

  // 显示计划执行进度
  "claudeMonitor.showPlanProgress": true,

  // 配额警告阈值（百分比）
  "claudeMonitor.quotaWarningThreshold": 80,

  // 更精细的自动刷新间隔控制（秒）
  "claudeMonitor.autoRefreshIntervalSeconds": 30,

  // 运行状态高亮颜色
  "claudeMonitor.colors.agent": "#10b981",
  "claudeMonitor.colors.skill": "#8b5cf6",
  "claudeMonitor.colors.plugin": "#007acc",
  "claudeMonitor.colors.mcp": "#f59e0b",

  // 停止高亮前没有事件的消息数
  "claudeMonitor.runningStateMissThreshold": 5
}
```

## API 提供商

### Anthropic
- 从 `ANTHROPIC_AUTH_TOKEN` 环境变量读取 API 密钥
- 解析 `~/.claude/history.jsonl` 以获取令牌使用情况
- 支持：免费、专业、团队套餐

### GLM（智谱AI）
- 从 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` 读取 API 配置
- 查询 `/api/monitor/usage/quota/limit` 端点
- 支持：ZAI 和 ZHIPU 平台

### 自定义提供商
您可以通过扩展 `BaseQuotaProvider` 类来添加自定义配额提供商。有关详细信息，请参阅[架构文档](../architecture.md)。

## 命令

以下命令可在命令面板中使用（`Ctrl+Shift+P` 或 `Cmd+Shift+P`）：

| 命令 | 描述 |
|------|------|
| `Claude Monitor: Open Claude Monitor` | 打开监控面板 |
| `Claude Monitor: Refresh Quota` | 手动刷新 API 配额数据 |

## 开发

### 项目结构

```
claude-code-monitor/
├── src/
│   ├── extension.ts              # 扩展入口
│   ├── quota/                    # 配额监控
│   ├── monitor/                  # 终端监控
│   ├── panels/                   # UI 组件
│   └── types/                   # TypeScript 定义
├── resources/                   # 图标和资源
├── docs/                       # 文档
└── package.json                # 扩展清单
```

### 构建

```bash
# 编译 TypeScript
npm run compile

# 监视更改
npm run watch

# 运行 linter
npm run lint

# 运行测试
npm run test
```

### 测试

1. 在 VSCode 中按 `F5` 启动扩展开发主机
2. 在新窗口中打开 Claude Code 终端
3. 使用监控面板测试功能

## 更新日志

### 版本 0.1.0
- 首次发布
- Anthropic 和 GLM 的 API 配额监控
- 实时终端活动跟踪
- 插件、技能和代理发现
- 计划模式进度跟踪
- 图片队列功能

## 贡献

欢迎贡献！请：

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 提交拉取请求

有关详细指南，请参阅 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 许可证

MIT 许可证 - 详见 [LICENSE](../../LICENSE) 文件。

## 支持

- **问题**: 在 [GitHub Issues](https://github.com/MoELuaNMaT/claude-code-monitor/issues) 上报告错误和请求功能
- **讨论**: 在 [GitHub Discussions](https://github.com/MoELuaNMaT/claude-code-monitor/discussions) 中提问和分享想法

## 致谢

为 Claude Code 社区用 ❤️ 构建。

扩展图标设计为用包含 Claude Code 符号的眼睛来代表"监控"。

## 隐私

此扩展：
- 从 `~/.claude/` 读取本地 Claude Code 配置文件
- 不向任何外部服务器发送数据（除了对您配置的提供商的配额 API 调用）
- 不收集或传输用户信息
- 在 VSCode 的全局状态中本地存储配额数据

---

**由 [您的名字] 用 ❤️ 制作**

[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=claude-code-monitor.claude-code-monitor) | [GitHub](https://github.com/MoELuaNMaT/claude-code-monitor)
