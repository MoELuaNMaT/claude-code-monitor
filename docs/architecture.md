# Architecture Design

## System Overview

Claude Code Monitor is a VSCode extension that provides real-time monitoring of Claude Code terminal activity and API quota usage.

```
┌─────────────────────────────────────────────────────────────┐
│                     VSCode Process                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌────────────────────┐         │
│  │ Claude Code     │        │ Monitor Extension  │         │
│  │ Terminal        │───┬───>│                    │         │
│  └─────────────────┘   │    │ - TerminalListener │         │
│                       │    │ - QuotaManager     │         │
│                       │    │ - ConfigReader     │         │
│                       │    └────────────────────┘         │
│                       │                │                   │
│                       │                v                   │
│                       │    ┌────────────────────┐         │
│                       │    │ Monitor Panel      │         │
│                       │    │ (Webview)          │         │
│                       │    └────────────────────┘         │
│                       │                                     │
│  ┌─────────────────┐   │    ┌────────────────────┐         │
│  │ Claude Code     │   │    │ API Providers      │         │
│  │ Config Files    │───┴───>│ - Anthropic        │         │
│  │ ~/.claude/      │        │ - GLM              │         │
│  └─────────────────┘        └────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Module Architecture

### 1. Extension Core (`extension.ts`)

**Responsibilities**:
- Extension activation/deactivation
- Command registration
- Webview provider registration
- Component initialization

**Key Classes**:
- `activate()` - Initialize extension
- `deactivate()` - Cleanup
- `MonitorViewProvider` - Sidebar webview provider

### 2. Quota Monitoring Module (`quota/`)

**Purpose**: Monitor API quota usage across providers

```
QuotaManager
    ├── ProviderRegistry
    │   ├── AnthropicProvider
    │   └── GLMProvider
    └── QuotaStore (VSCode GlobalState)
```

**Key Classes**:

| Class | Responsibility |
|-------|---------------|
| `QuotaManager` | Coordinate providers, caching, auto-refresh |
| `BaseQuotaProvider` | Abstract base for providers |
| `AnthropicProvider` | Anthropic API quota |
| `GLMProvider` | GLM/Zhipu API quota |
| `ProviderRegistry` | Provider registration and discovery |

**Data Flow**:
```
User Action (Refresh)
       ↓
QuotaManager.refreshQuota()
       ↓
Loop through providers
       ↓
Provider.getQuota() → API Call / File Parse
       ↓
Aggregate results
       ↓
Update cache + Notify webview
```

### 3. Terminal Monitoring Module (`monitor/`)

**Purpose**: Monitor Claude Code terminal output

```
TerminalListener
    ├── OutputParser
    │   ├── ToolCallParser
    │   ├── SkillCallParser
    │   └── AgentCallParser
    └── EventBuffer (circular buffer)
```

**Key Classes**:

| Class | Responsibility |
|-------|---------------|
| `TerminalListener` | Listen to `onDidWriteTerminalData` events |
| `OutputParser` | Parse terminal output for events |
| `ConfigReader` | Read Claude Code config files |

**Event Types**:
```typescript
type TerminalEventType =
  | 'tool_call'      // [Bash], [Read], etc.
  | 'skill_call'     // [skill] name: action
  | 'agent_call'     // [agent] name: action
  | 'user_message'   // User input
  | 'plan_progress'  // Plan mode steps
  | 'other';         // Unclassified
```

### 4. UI Module (`panels/`)

**Purpose**: Display monitoring data in webview

```
MonitorPanel
    └── Webview (HTML/CSS/JS)
        ├── Quota Section
        ├── Events Section
        └── Plugins Section
```

**Communication**:
```
Extension ──────message──────> Webview
          <─────message──────
```

**Message Types**:
```typescript
// Extension → Webview
{ type: 'quotaUpdate', data: QuotaStatus[] }
{ type: 'eventsUpdate', data: TerminalEvent[] }
{ type: 'pluginsUpdate', data: PluginInfo[] }

// Webview → Extension
{ type: 'getQuota' }
{ type: 'refreshQuota' }
{ type: 'getEvents' }
{ type: 'clearEvents' }
{ type: 'getPlugins' }
```

## Data Models

### QuotaStatus

```typescript
interface QuotaStatus {
  provider: string;      // Provider name
  used: number;          // Current usage
  limit: number;         // Total limit
  percentage: number;    // Usage percentage
  currency: string;      // Unit (tokens, CNY)
  resetDate?: Date;      // Reset date
  error?: string;        // Error message
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

## API Provider System

### Extensibility

New providers can be added by:

1. Extending `BaseQuotaProvider` or `TokenBasedProvider`
2. Implementing required methods:
   ```typescript
   getName(): string
   getQuota(): Promise<QuotaStatus>
   isConfigured(): Promise<boolean>
   ```
3. Registering in `ProviderRegistry`

### Provider Examples

**Token-Based Provider** (Anthropic):
- Parse history file for token counts
- Calculate percentage from limit

**API-Based Provider** (GLM):
- Query API endpoint
- Parse JSON response
- Extract usage data

## Caching Strategy

### Quota Data

- **Storage**: VSCode GlobalState
- **Duration**: 5 minutes
- **Invalidation**: Manual refresh or timeout

### Event Buffer

- **Storage**: In-memory array
- **Size**: 1000 events (circular)
- **Trim**: Keep last 500 when exceeding limit

## Threading Model

- **Main Thread**: VSCode API calls
- **Webview Thread**: UI rendering (isolated)
- **API Calls**: Async/promises (non-blocking)

## Error Handling

### Provider Errors

```typescript
try {
  const status = await provider.getQuota();
} catch (error) {
  // Return error status instead of throwing
  return {
    provider: name,
    error: error.message,
    // ... default values
  };
}
```

### Webview Communication

```typescript
webview.onDidReceiveMessage(async message => {
  try {
    // Handle message
  } catch (error) {
    webview.postMessage({
      type: 'error',
      message: error.message
    });
  }
});
```

## Security Considerations

1. **API Keys**: Never expose in webview or logs
2. **File Access**: Restrict to `~/.claude/` directory
3. **Network**: Use HTTPS only, set timeouts
4. **Data Storage**: No sensitive data in GlobalState

## Performance Optimization

1. **Debouncing**: Debounce terminal parse events
2. **Lazy Loading**: Load plugins on demand
3. **Caching**: Cache quota data for 5 minutes
4. **Buffer Limits**: Limit event buffer size

## Future Extensibility

### Planned Features

1. **Custom Providers**: User-defined quota providers
2. **Alerts**: Notify when quota exceeds threshold
3. **Export**: Export usage data to CSV
4. **Charts**: Historical usage visualization

### Extension Points

```typescript
// Add custom provider
quotaManager.registerProvider(new CustomProvider());

// Add custom parser
terminalListener.addParser(new CustomParser());

// Add custom UI section
panel.registerSection(new CustomSection());
```
