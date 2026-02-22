const promClient = require('prom-client');
const http = require('http');

class PromClient {
  constructor(port = 9090) {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    // Create a gauge for Z-Wave values
    this.zwaveValueGauge = new promClient.Gauge({
      name: 'zwave_value',
      help: 'Z-Wave node values',
      labelNames: ['node_id', 'command_class', 'property', 'property_key', 'endpoint'],
      registers: [this.register]
    });

    this.server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', this.register.contentType);
        this.register.metrics().then(metrics => {
          res.end(metrics);
        });
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    this.server.listen(port, () => {
      console.log(`Prometheus metrics server listening on port ${port}`);
    });
  }

  handleEvent(event) {
    if (event.source === 'node' && event.event === 'value updated') {
      const { nodeId, args } = event;
      const { commandClass, endpoint, property, propertyKey, newValue } = args[0];

      // Convert to number if possible
      let value = newValue;
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      } else if (typeof value !== 'number') {
        // Skip non-numeric values for now
        return;
      }

      const labels = {
        node_id: nodeId,
        command_class: commandClass,
        property: property,
        property_key: propertyKey || '',
        endpoint: endpoint || 0
      };

      this.zwaveValueGauge.set(labels, value);
    }
  }
}

module.exports = PromClient;