# zwave-js-prom-exporter
A WebSocket prometheus exporter for Zwave js ui

## Installation

```bash
npm install
```

## Docker

Build and run with Docker:

```bash
# Build the image
docker build -t zwave-js-prom-exporter .

# Run the container
docker run -p 9090:9090 \
  -e ZWAVE_WS_URL=ws://host.docker.internal:3000 \
  -e LOG_LEVEL=info \
  zwave-js-prom-exporter
```

### Environment Variables

- `ZWAVE_WS_URL`: WebSocket URL for zwave-js-server (default: ws://localhost:3000)
- `PROM_PORT`: Port for Prometheus metrics (default: 9090)
- `LOG_LEVEL`: Logging level (default: info)

### Docker Compose Example

```yaml
version: '3.8'
services:
  zwave-js-prom-exporter:
    build: .
    ports:
      - "9090:9090"
    environment:
      - ZWAVE_WS_URL=ws://zwave-js-server:3000
      - LOG_LEVEL=info
    depends_on:
      - zwave-js-server
    restart: unless-stopped
```

## Logging

The application uses Winston for structured logging. Set the log level with the `LOG_LEVEL` environment variable:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debug information including all events

## Reconnection

The WebSocket client automatically reconnects in case of connection interruption using exponential backoff (starting at 1 second, doubling each attempt up to 10 attempts). This ensures reliable operation even with network issues or server restarts.

## Initial Commands

The WebSocket client sends the following initial commands:

1. `initialize` with schemaVersion 0
2. `start_listening` to receive events

## Metrics

Dynamic metrics are created for each Z-Wave command class with the format `zwave_{command_class_name}` (e.g., `zwave_binary_switch`, `zwave_multilevel_sensor`). Each metric includes labels for `node_id`, `Name`, `Location`, `property`, `property_key`, and `endpoint`.
