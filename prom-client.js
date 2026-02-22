const promClient = require('prom-client');
const http = require('http');
const logger = require('./logger');

class PromClient {
  constructor(port = 9090) {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    this.gauges = new Map();
    this.nodes = new Map();

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
      logger.info(`Prometheus metrics server listening on port ${port}`);
    });
  }

  setNodes(nodes) {
    this.nodes = nodes;
  }

  handleEvent(event) {
    if (event.source === 'node' && event.event === 'value updated') {
      const { nodeId, args } = event;
      const { commandClass, commandClassName, endpoint, property, propertyKey, propertyName, propertyKeyName, newValue } = args;

      // Exclude certain command classes
      if ([112, 114, 134, 96].includes(commandClass)) {
        return;
      }

      // Convert to number if possible
      let value = newValue;
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      } else if (typeof value !== 'number') {
        // Skip non-numeric values for now
        return;
      }

      // Create metric name based on command class
      const metricName = 'zwavejs_' + commandClassName.toLowerCase().replace(/\s+/g, '_');

      // Create gauge if it doesn't exist
      if (!this.gauges.has(metricName)) {
        this.gauges.set(metricName, new promClient.Gauge({
          name: metricName,
          help: `Z-Wave ${commandClassName} values`,
          labelNames: ['node_id', 'Name', 'Location', 'property', 'property_key', 'endpoint'],
          registers: [this.register]
        }));
      }

      const gauge = this.gauges.get(metricName);

      const labels = {
        node_id: nodeId,
        Name: this.nodes.get(nodeId)?.name || '',
        Location: this.nodes.get(nodeId)?.location || '',
        property: propertyName || property,
        property_key: propertyKeyName || propertyKey || '',
        endpoint: endpoint || 0
      };

      gauge.set(labels, value);
    }
  }
}

module.exports = PromClient;