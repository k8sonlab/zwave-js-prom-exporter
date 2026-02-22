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
npm start
```

The exporter will connect to the WebSocket, send initial commands (initialize and start_listening), and expose metrics at http://localhost:9090/metrics.

## Initial Commands

The WebSocket client sends the following initial commands:

1. `initialize` with schemaVersion 0
2. `start_listening` to receive events

## Metrics

- `zwave_value`: Gauge for Z-Wave node values with labels for node_id, command_class, property, etc.
