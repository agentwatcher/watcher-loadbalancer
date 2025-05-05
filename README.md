# Agent Watcher AI

A standalone, comprehensive monitoring and observability platform for AI agents. Agent Watcher provides advanced tracking, debugging, and performance analysis to ensure reliable and efficient operation of AI agent systems.

## Features

- **Multiple Monitoring Methods**:

  - Real-time agent activity tracking (default)
  - Historical performance analysis
  - Anomaly detection

- **Smart Health Checking**:

  - Automatic detection of underperforming agents
  - Configurable monitoring intervals and thresholds
  - Proactive alerts for potential issues

- **Advanced Metrics and Monitoring**:

  - Prometheus integration for metrics collection
  - Detailed agent execution metrics
  - Agent health status monitoring
  - Ready for Grafana dashboards

- **Admin Panel**:

  - Status monitoring of all agents
  - Manual agent inspection
  - Per-agent configuration

- **Security**:

  - Authentication for monitoring access
  - Rate limiting
  - CORS support
  - Helmet security headers

- **Real-time Communication**:
  - WebSocket support for live updates
  - Event streaming for agent activities

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your agents:
   - Copy `.env.example` to `.env` and customize
   - Or edit `src/config/agents.js` to define your agents
4. Start Agent Watcher:
   ```
   npm start
   ```

### Running with Docker

You can use Docker to run Agent Watcher along with all required services:

```
docker-compose up
```

This will start Agent Watcher, agent monitoring services, and Prometheus/Grafana for monitoring visualization.

## Configuration

### Command Line Options

```
Options:
  -p, --port     Port to run Agent Watcher on                [default: 8000]
  -c, --config   Path to custom config file
  -h, --help     Show help
  -v, --version  Show version
```

### Environment Variables

Create a `.env` file with the following variables:

```
# Server configuration
PORT=8000
NODE_ENV=development
LOG_LEVEL=info

# Agent Endpoints (comma-separated lists of agent instances)
CONVERSATION_AGENTS=http://conv-agent-1:5000,http://conv-agent-2:5000,http://conv-agent-3:5000
PLANNING_AGENTS=http://planning-1:3001,http://planning-2:3001
REASONING_AGENTS=http://reasoning:5002
EXECUTION_AGENTS=http://execution-1:5003,http://execution-2:5003
WEBSOCKET_ENDPOINTS=ws://agent-events:5004

# Monitoring Methods (real-time, historical, anomaly-detection)
CONVERSATION_MONITORING=real-time
PLANNING_MONITORING=real-time
REASONING_MONITORING=historical
EXECUTION_MONITORING=anomaly-detection
EVENTS_MONITORING=real-time

# Health check configuration
HEALTH_CHECK_INTERVAL=10000  # Health check interval in ms
HEALTH_CHECK_TIMEOUT=5000    # Health check timeout in ms

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100           # Maximum requests per window
```

## API Endpoints

### Agent Watcher Endpoints

| Endpoint         | Description                                   |
| ---------------- | --------------------------------------------- |
| `/health`        | Health check endpoint for Agent Watcher       |
| `/metrics`       | Prometheus metrics for monitoring             |
| `/admin/status`  | Admin interface showing status of all agents  |
| `/admin/health`  | Detailed health status of all agents          |
| `/admin/refresh` | Trigger manual agent status refresh           |

### Monitored Endpoints

These are the endpoints that are monitored by Agent Watcher:

| Endpoint                   | Agent Type      | Description                    |
| -------------------------- | --------------- | ------------------------------ |
| `/api/v1/conversation/*`   | Conversation    | Conversation agent endpoints   |
| `/api/v1/planning/*`       | Planning        | Planning agent endpoints       |
| `/api/v1/reasoning/*`      | Reasoning       | Reasoning agent endpoints      |
| `/api/v1/execution/*`      | Execution       | Execution agent endpoints      |
| `/api/v1/tools/*`          | Tool            | Tool usage endpoints           |
| `/api/v1/analytics/*`      | Analytics       | Analytics endpoints            |
| `/api/v1/memory/*`         | Memory          | Memory storage endpoints       |
| `/webhooks/*`              | Webhook         | Webhook endpoints              |
| `/ws`                      | Event Stream    | WebSocket connections          |

## Monitoring

### Metrics

Prometheus metrics are available at `/metrics` and include:

- Agent execution counts and status codes
- Task completion times and success rates
- Agent health statistics
- Agent availability metrics

### Grafana

A pre-configured Grafana dashboard is included when running with Docker. Access it at `http://localhost:3000` (default credentials: admin/admin)

## Advanced Usage

### Custom Configuration

You can create a custom configuration file and load it with the `--config` option:

```
node src/index.js --config ./my-config.js
```

### Extending Agent Watcher

The modular design allows for easy extension:

1. Add new monitoring methods in `src/utils/agentMonitor.js`
2. Add new middleware in `src/middleware/`
3. Add new metrics in `src/utils/metrics.js`

## Architecture

```
                      ┌─────────────┐
                      │    User     │
                      └──────┬──────┘
                             │
                             ▼
┌───────────────────────────────────────────────┐
│               Agent Watcher                   │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─────────────┐  ┌─────────────┐             │
│  │    Auth     │  │  Metrics    │             │
│  │ Middleware  │  │  Collection │             │
│  └─────────────┘  └─────────────┘             │
│                                               │
│  ┌─────────────┐  ┌─────────────┐             │
│  │    Rate     │  │   Agent     │             │
│  │  Limiting   │  │  Monitoring │             │
│  └─────────────┘  └─────────────┘             │
│                                               │
└─┬─────────────┬─────────────┬─────────────┬───┘
  │             │             │             │
  ▼             ▼             ▼             ▼
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│Conv-1  │   │Conv-2  │   │Conv-3  │   │Plan-1  │
└────────┘   └────────┘   └────────┘   └────────┘
                                            │
┌────────┐   ┌────────┐   ┌────────┐       │
│Exec-1  │   │Exec-2  │   │Reason  │◄──────┘
└────────┘   └────────┘   └────────┘
```

## License

MIT
