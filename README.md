# zwave-js-prom-exporter
A WebSocket prometheus exporter for Zwave js ui

## Installation

```bash
npm install
```

## Usage

Set the WebSocket URL for zwave-js-server:

```bash
export ZWAVE_WS_URL=ws://localhost:3000
export PROM_PORT=9090
export LOG_LEVEL=info  # optional: error, warn, info, debug
npm start
```

The exporter will connect to the WebSocket, send initial commands (initialize and start_listening), and expose metrics at http://localhost:9090/metrics.

## Logging

The application uses Winston for structured logging. Set the log level with the `LOG_LEVEL` environment variable:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debug information including all events

## Initial Commands

The WebSocket client sends the following initial commands:

1. `initialize` with schemaVersion 0
2. `start_listening` to receive events

## Metrics

Dynamic metrics are created for each Z-Wave command class with the format `zwave_{command_class_name}` (e.g., `zwave_binary_switch`, `zwave_multilevel_switch`). Each metric includes labels for `node_id`, `property`, `property_key`, and `endpoint`.
