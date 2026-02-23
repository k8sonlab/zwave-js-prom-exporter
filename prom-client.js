const promClient = require('prom-client');
const http = require('http');
const logger = require('./logger');
const statisticsClasses = ['commandsDroppedRX', 'commandsDroppedTX', 'commandsRX', 'commandsTX'];
const controllerStatisticsClasses = ['messagesDroppedRX', 'messagesDroppedTX', 'messagesRX', 'messagesTX', 'timeoutACK', 'timeoutCallback', 'timeoutResponse'];
const nodeStates = {
  'sleep': 0,
  'wake up': 1,
  'alive': 2,
  'dead': 3
};
class PromClient {
  constructor(port = 9090, wsClient = null) {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    this.gauges = new Map();
    this.nodes = new Map();
    this.wsClient = wsClient;

    this.server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', this.register.contentType);
        this.register.metrics().then(metrics => {
          res.end(metrics);
        });
      } else if (req.url === '/healthz') {
        if (this.wsClient && this.wsClient.isWebSocketConnected()) {
          res.statusCode = 200;
          res.end('OK');
        } else {
          res.statusCode = 503;
          res.end('Service Unavailable');
        }
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    this.server.listen(port, () => {
      logger.info(`Prometheus metrics server listening on port ${port}`);
    });
  }
  returnEpoch(timestamp) {
    return new Date(timestamp).getTime();
  }
  setWebSocketClient(wsClient) {
    this.wsClient = wsClient;
  }

  setNodes(nodes) {
    this.nodes = nodes;
  }
  gaugeHandling(metricName, value, labels, labelNames, help = '') {
    // Create gauge if it doesn't exist
    if (!this.gauges.has(metricName)) {
    this.gauges.set(metricName, new promClient.Gauge({
      name: metricName,
      help: `Z-Wave metric ${help}`,
      labelNames: labelNames,
      registers: [this.register]
    }));
  }

  // Update gauge value
  const gauge = this.gauges.get(metricName);
  gauge.set(labels, value);
  }

  handleEvent(event) {
    if (event.source === 'node') { 
      if (event.event === 'value updated') {
        const { nodeId, args } = event;
        const { commandClass, commandClassName, endpoint, property, propertyKey, propertyName, propertyKeyName, newValue } = args;

        // Exclude certain command classes
        if ([112, 114, 134, 96].includes(commandClass)) {
          return;
        }
        logger.info(`Handling event for node ${nodeId}, commandClass: ${commandClass}, property: ${property}, propertyKey: ${propertyKey}, newValue: ${newValue}`);
        // Convert to number if possible
        let value = newValue;
        if (typeof value === 'boolean') {
          value = value ? 1 : 0;
        } else if (typeof value !== 'number') {
          // Skip non-numeric values for now
          return;
        }

        // Add suffix on specific metrics
        let metricNameSuffix = '';
        if (commandClass === 50 && propertyKey == 65537) {
          logger.debug('Adding _total suffix for Multilevel Sensor Scale property');
          metricNameSuffix = '_total';
        }

        // Create metric name based on command class
        const metricName = 'zwavejs_' + commandClassName.toLowerCase().replace(/\s+/g, '_') + metricNameSuffix;
        
        const labels = {
          node_id: nodeId,
          name: this.nodes.get(nodeId)?.name || '',
          location: this.nodes.get(nodeId)?.location || '',
          property: propertyName || property,
          property_key: propertyKeyName || propertyKey || '',
          endpoint: endpoint || 0
        };
        
        this.gaugeHandling(
          metricName,
          value,
          labels,
          Object.keys(labels),
          `for ${commandClassName} values`
        )

      } else if (event.event === 'statistics updated') {
        const { nodeId, statistics, timestamp } = event;
        const { commandsDroppedRX, commandsDroppedTX, commandsRX, commandsTX } = statistics;
        const unixstamp = new Date(timestamp).getTime();
        logger.debug(`Handling statistics event for node ${nodeId}, commandsRX: ${commandsRX}, commandsTX: ${commandsTX}, commandsDroppedRX: ${commandsDroppedRX}, commandsDroppedTX: ${commandsDroppedTX} at timestamp: ${unixstamp.toString()}`);
        
        const metricName = 'zwavejs_statistics';

        const labels = {
          node_id: nodeId,
          name: this.nodes.get(nodeId)?.name || '',
          location: this.nodes.get(nodeId)?.location || ''
        };

        statisticsClasses.forEach((statistic) => {
          const fullMetricName = `${metricName}_${statistic.toLowerCase()}`;
          logger.debug(`Processing statistic ${statistic} for node ${nodeId}, full metric name: ${fullMetricName}, value: ${statistics[statistic]}`);

          this.gaugeHandling(
            fullMetricName,
            statistics[statistic],
            labels,
            Object.keys(labels),
            `statistic ${statistic}`
          )
        });
      } else if (event.event === 'sleep' || event.event === 'wake up' || event.event === 'alive' || event.event === 'dead') {
        const labels = {
          node_id: event.nodeId,
          name: this.nodes.get(event.nodeId)?.name || '',
          location: this.nodes.get(event.nodeId)?.location || ''
        };

        this.gaugeHandling(
          'zwavejs_node_state',
          nodeStates[event.event],
          labels,
          Object.keys(labels),
          `node state`
        )
      }
    } else if (event.source === 'controller') {
      const { nodeId, statistics, timestamp } = event;
      const { messagesDroppedRX, messagesDroppedTX, messagesRX, messagesTX, timeoutACK, timeoutCallback, timeoutResponse } = statistics;
      const unixstamp = new Date(timestamp).getTime();
      logger.debug(`Handling statistics event for node ${nodeId}, messagesRX: ${messagesRX}, messagesTX: ${messagesTX}, messagesDroppedRX: ${messagesDroppedRX}, messagesDroppedTX: ${messagesDroppedTX}, timeoutACK: ${timeoutACK}, timeoutCallback: ${timeoutCallback}, timeoutResponse: ${timeoutResponse} at timestamp: ${unixstamp.toString()}`);
      
      const metricName = 'zwavejs_controller_statistics';

      const labels = {
      };

      controllerStatisticsClasses.forEach((statistic) => {
        const fullMetricName = `${metricName}_${statistic.toLowerCase()}`;
        logger.debug(`Processing statistic ${statistic} for node controller, full metric name: ${fullMetricName}, value: ${statistics[statistic]}`);

        this.gaugeHandling(
          fullMetricName,
          statistics[statistic],
          labels,
          Object.keys(labels),
          `statistic ${statistic}`
        )
      });
    }
  }
}


module.exports = PromClient;
