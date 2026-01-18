# Requirements Document

## Project Overview

Claude Code Monitor is a VSCode extension that provides real-time monitoring of Claude Code terminal activity, focusing on API quota usage, plugin status, and execution tracking.

## User Stories

### Story 1: API Quota Monitoring

**As a** Claude Code user
**I want to** see my API quota usage in real-time
**So that** I can avoid exceeding my subscription limits

**Acceptance Criteria**:
- Display quota usage for each configured API provider
- Show progress bar with percentage
- Color-coded warnings (green < 50%, yellow 50-80%, red > 80%)
- Auto-refresh every 5 minutes
- Manual refresh button

### Story 2: Terminal Activity Monitoring

**As a** Claude Code user
**I want to** see real-time activity in the terminal
**So that** I can understand what Claude Code is doing

**Acceptance Criteria**:
- Display tool calls ([Bash], [Read], etc.)
- Display skill invocations
- Display agent operations
- Highlight user messages
- Show timestamp for each event

### Story 3: Plugin Management

**As a** Claude Code user
**I want to** see which plugins are installed
**So that** I can manage my Claude Code extensions

**Acceptance Criteria**:
- List all installed plugins
- Show plugin version
- Show installation scope (user/local)
- Show installation path

### Story 4: Plan Progress Tracking

**As a** Claude Code user
**I want to** see Plan mode execution progress
**So that** I know how much work is remaining

**Acceptance Criteria**:
- Display current step / total steps
- Show completion status for each step
- Highlight current step

## Functional Requirements

### FR-1: Quota Monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Support Anthropic API quota monitoring | High |
| FR-1.2 | Support GLM/Zhipu API quota monitoring | High |
| FR-1.3 | Display used/limit/percentage | High |
| FR-1.4 | Auto-refresh every 5 minutes | Medium |
| FR-1.5 | Manual refresh button | Medium |
| FR-1.6 | Color-coded progress bars | High |

### FR-2: Activity Monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Monitor terminal output in real-time | High |
| FR-2.2 | Parse tool calls | High |
| FR-2.3 | Parse skill calls | High |
| FR-2.4 | Parse agent calls | High |
| FR-2.5 | Highlight user messages | Medium |
| FR-2.6 | Show event timestamps | Medium |
| FR-2.7 | Clear events button | Low |

### FR-3: Plugin Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Read installed_plugins.json | High |
| FR-3.2 | Display plugin list | High |
| FR-3.3 | Show plugin metadata | Medium |

### FR-4: Plan Progress

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Parse Plan mode output | Medium |
| FR-4.2 | Calculate step progress | Medium |
| FR-4.3 | Display progress indicator | Low |

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-1.1 | UI responsiveness | < 100ms |
| NFR-1.2 | Memory usage | < 50MB |
| NFR-1.3 | CPU usage | < 5% when idle |

### NFR-2: Reliability

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-2.1 | Extension stability | No crashes in 24h usage |
| NFR-2.2 | API failure handling | Graceful degradation |
| NFR-2.3 | Cache validity | 5 minutes |

### NFR-3: Usability

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-3.1 | Installation time | < 2 minutes |
| NFR-3.2 | First-use configuration | Automatic (zero config) |
| NFR-3.3 | Learning curve | Minimal (intuitive UI) |

### NFR-4: Compatibility

| ID | Requirement | Version |
|----|-------------|---------|
| NFR-4.1 | VSCode | >= 1.85.0 |
| NFR-4.2 | Node.js | >= 16.x |
| NFR-4.3 | Claude Code CLI | Latest |
| NFR-4.4 | Operating System | Windows, macOS, Linux |

## Data Requirements

### DR-1: Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| installed_plugins.json | ~/.claude/ | Plugin list |
| settings.json | ~/.claude/ | Claude Code config |
| history.jsonl | ~/.claude/ | Token usage history |

### DR-2: API Endpoints

| Provider | Endpoint | Purpose |
|----------|----------|---------|
| GLM | /api/monitor/usage/quota/limit | Quota data |
| Anthropic | N/A | No public API |

## Technical Constraints

### TC-1: Architecture

- Must be a VSCode extension (not standalone app)
- Must use Webview for UI
- Must not interfere with Claude Code operation

### TC-2: Security

- Must not expose API keys
- Must respect user privacy
- Must handle sensitive data securely

### TC-3: Maintenance

- Code must be well-documented
- Must follow VSCode extension best practices
- Must be easily extensible for new providers
