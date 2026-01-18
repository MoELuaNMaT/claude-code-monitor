# 架构设计

## 系统概述

Claude Code Monitor 是一个 VSCode 扩展，提供对 Claude Code 终端活动和 API 配额使用的实时监控。

```
┌─────────────────────────────────────────────────────────────┐
│                     VSCode 进程                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌────────────────────┐         │
│  │ Claude Code     │        │ 监控扩展           │         │
│  │ 终端            │───┬───>│                    │         │
│  └─────────────────┘   │    │ - TerminalListener │         │
│                       │    │ - QuotaManager     │         │
│                       │    │ - ConfigReader     │         │
│                       │    └────────────────────┘         │
│                       │                │                   │
│                       │                v                   │
│                       │    ┌────────────────────┐         │
│                       │    │ 监控面板           │         │
│                       │    │ (Webview)          │         │
│                       │    └────────────────────┘         │
│                       │                                     │
│  ┌─────────────────┐   │    ┌────────────────────┐         │
│  │ Claude Code     │   │    │ API 提供商         │         │
│  │ 配置文件        │───┴───>│ - Anthropic        │         │
│  │ ~/.claude/      │        │ - GLM              │         │
│  └─────────────────┘        └────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 模块架构

### 1. 扩展核心 (`extension.ts`)

**职责**：
- 扩展激活/停用
- 命令注册
- Webview 提供商注册
- 组件初始化

**关键类**：
- `activate()` - 初始化扩展
- `deactivate()` - 清理
- `MonitorViewProvider` - 侧边栏 webview 提供商

### 2. 配额监控模块 (`quota/`)

**目的**：监控多个提供商的 API 配额使用

```
QuotaManager
    ├── ProviderRegistry
    │   ├── AnthropicProvider
    │   └── GLMProvider
    └── QuotaStore (VSCode GlobalState)
```

**关键类**：

| 类 | 职责 |
|-----|------|
| `QuotaManager` | 协调提供商、缓存、自动刷新 |
| `BaseQuotaProvider` | 提供商抽象基类 |
| `AnthropicProvider` | Anthropic API 配额 |
| `GLMProvider` | GLM/智谱 API 配额 |
| `ProviderRegistry` | 提供商注册和发现 |

**数据流**：
```
用户操作（刷新）
       ↓
QuotaManager.refreshQuota()
       ↓
循环遍历提供商
       ↓
Provider.getQuota() → API 调用 / 文件解析
       ↓
聚合结果
       ↓
更新缓存 + 通知 webview
```

### 3. 终端监控模块 (`monitor/`)

**目的**：监控 Claude Code 终端输出

```
TerminalListener
    ├── OutputParser
    │   ├── ToolCallParser
    │   ├── SkillCallParser
    │   └── AgentCallParser
    └── EventBuffer (循环缓冲区)
```

**关键类**：

| 类 | 职责 |
|-----|------|
| `TerminalListener` | 监听 `onDidWriteTerminalData` 事件 |
| `OutputParser` | 解析终端输出获取事件 |
| `ConfigReader` | 读取 Claude Code 配置文件 |

**事件类型**：
```typescript
type TerminalEventType =
  | 'tool_call'      // [Bash]、[Read] 等
  | 'skill_call'     // [skill] name: action
  | 'agent_call'     // [agent] name: action
  | 'user_message'   // 用户输入
  | 'plan_progress'  // Plan 模式步骤
  | 'other';         // 未分类
```

### 4. UI 模块 (`panels/`)

**目的**：在 webview 中显示监控数据

```
MonitorPanel
    └── Webview (HTML/CSS/JS)
        ├── 配额部分
        ├── 事件部分
        └── 插件部分
```

**通信**：
```
扩展 ──────消息──────> Webview
      <─────消息──────
```

**消息类型**：
```typescript
// 扩展 → Webview
{ type: 'quotaUpdate', data: QuotaStatus[] }
{ type: 'eventsUpdate', data: TerminalEvent[] }
{ type: 'pluginsUpdate', data: PluginInfo[] }

// Webview → 扩展
{ type: 'getQuota' }
{ type: 'refreshQuota' }
{ type: 'getEvents' }
{ type: 'clearEvents' }
{ type: 'getPlugins' }
```

## 数据模型

### QuotaStatus

```typescript
interface QuotaStatus {
  provider: string;      // 提供商名称
  used: number;          // 当前使用量
  limit: number;         // 总限额
  percentage: number;    // 使用百分比
  currency: string;      // 单位（tokens、CNY）
  resetDate?: Date;      // 重置日期
  error?: string;        // 错误消息
}
```

### TerminalEvent

```typescript
interface TerminalEvent {
  type: TerminalEventType;
  timestamp: Date;
  content: string;
  details?: Record<string, any>;
}
```

### PluginInfo

```typescript
interface PluginInfo {
  name: string;
  version: string;
  scope: string;
  installPath: string;
  isLocal: boolean;
}
```

## API 提供商系统

### 可扩展性

可以通过以下方式添加新提供商：

1. 扩展 `BaseQuotaProvider` 或 `TokenBasedProvider`
2. 实现必需方法：
   ```typescript
   getName(): string
   getQuota(): Promise<QuotaStatus>
   isConfigured(): Promise<boolean>
   ```
3. 在 `ProviderRegistry` 中注册

### 提供商示例

**基于 Token 的提供商**（Anthropic）：
- 解析历史文件获取 token 计数
- 从限额计算百分比

**基于 API 的提供商**（GLM）：
- 查询 API 端点
- 解析 JSON 响应
- 提取使用数据

## 缓存策略

### 配额数据

- **存储**：VSCode GlobalState
- **持续时间**：5 分钟
- **失效**：手动刷新或超时

### 事件缓冲区

- **存储**：内存数组
- **大小**：1000 个事件（循环）
- **修剪**：超过限制时保留最后 500 个

## 线程模型

- **主线程**：VSCode API 调用
- **Webview 线程**：UI 渲染（隔离）
- **API 调用**：异步/promises（非阻塞）

## 错误处理

### 提供商错误

```typescript
try {
  const status = await provider.getQuota();
} catch (error) {
  // 返回错误状态而不是抛出
  return {
    provider: name,
    error: error.message,
    // ... 默认值
  };
}
```

### Webview 通信

```typescript
webview.onDidReceiveMessage(async message => {
  try {
    // 处理消息
  } catch (error) {
    webview.postMessage({
      type: 'error',
      message: error.message
    });
  }
});
```

## 安全考虑

1. **API 密钥**：永远不要在 webview 或日志中暴露
2. **文件访问**：限制在 `~/.claude/` 目录
3. **网络**：仅使用 HTTPS，设置超时
4. **数据存储**：GlobalState 中无敏感数据

## 性能优化

1. **防抖**：对终端解析事件进行防抖
2. **延迟加载**：按需加载插件
3. **缓存**：配额数据缓存 5 分钟
4. **缓冲区限制**：限制事件缓冲区大小

## 未来可扩展性

### 计划功能

1. **自定义提供商**：用户定义的配额提供商
2. **警报**：配额超过阈值时通知
3. **导出**：将使用数据导出为 CSV
4. **图表**：历史使用可视化

### 扩展点

```typescript
// 添加自定义提供商
quotaManager.registerProvider(new CustomProvider());

// 添加自定义解析器
terminalListener.addParser(new CustomParser());

// 添加自定义 UI 部分
panel.registerSection(new CustomSection());
```
