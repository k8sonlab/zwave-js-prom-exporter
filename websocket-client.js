const WebSocket = require('ws');
const logger = require('./logger');

class ZwaveWebSocketClient {
  constructor(url, promClient) {
    this.url = url;
    this.promClient = promClient;
    this.ws = null;
    this.messageId = 1;
    this.nodes = new Map();
    this.reconnectDelay = 3000;
    this.startListeningMsgId = null;
  }

  connect() {
    if (this.isReconnecting) return; // Prevent multiple connection attempts

    const createWS = () => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info('Connected to zwave-js-server');
        this.sendInitialize();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        //this.scheduleReconnect();
      });

      this.ws.on('close', () => {
        logger.info('WebSocket connection closed');
        this.scheduleReconnect();
      });
    };
      
    setTimeout(createWS, this.reconnectDelay);
    }

  scheduleReconnect() {
    const delay = 10000; // Fixed 10 second delay
    logger.info(`Attempting to reconnect in ${delay}ms`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  sendCommand(command, params = {}) {
    const message = {
      messageId: this.messageId++,
      command,
      ...params
    };
    this.ws.send(JSON.stringify(message));
  }

  sendInitialize() {
    this.sendCommand('initialize', { schemaVersion: 0 });
  }

  sendStartListening() {
    this.startListeningMsgId = this.messageId;
    this.sendCommand('start_listening');
  }

  handleMessage(message) {
    if (message.type === 'version') {
      logger.info('Server version:', message);
      this.sendStartListening();
    } else if (message.type === 'result') {
      if (message.messageId === this.startListeningMsgId) {
        this.parseState(message.result);
      } else {
        logger.debug('Command result:', message);
      }
    } else if (message.type === 'event') {
      this.handleEvent(message.event);
    } else {
      logger.warn('Unknown message type:', message);
    }
  }

  parseState(result) {
    if (result && result.state && result.state.nodes) {
      result.state.nodes.forEach(node => {
        this.nodes.set(node.nodeId, {
          name: node.name || '',
          location: node.location || ''
        });
      });
      logger.info(`Parsed ${this.nodes.size} nodes from state`);
      this.promClient.setNodes(this.nodes);

      // Set initial values
      result.state.nodes.forEach(node => {
        if (node.values) {
          Object.values(node.values).forEach(valueData => {
            // Exclude certain command classes
            if ([112, 114, 134, 96].includes(valueData.commandClass)) {
              return;
            }
            const simulatedEvent = {
              source: 'node',
              event: 'value updated',
              nodeId: node.nodeId,
              args: {
                commandClass: valueData.commandClass,
                commandClassName: valueData.commandClassName || valueData.commandClass,
                endpoint: valueData.endpoint,
                property: valueData.property,
                propertyKey: valueData.propertyKey,
                propertyName: valueData.propertyName,
                propertyKeyName: valueData.propertyKeyName,
                newValue: valueData.value
              }
            };
            this.promClient.handleEvent(simulatedEvent);
          });
        }
      });
      logger.info('Set initial values from state');
    }
  }

  handleEvent(event) {
    // Handle node name/location changes
    if (event.source === 'node' && event.event === 'value updated' && event.args.commandClass === 119) {
      const node = this.nodes.get(event.nodeId);
      if (node) {
        if (event.args.property === 'name') {
          node.name = event.args.newValue;
        } else if (event.args.property === 'location') {
          node.location = event.args.newValue;
        }
        // Update promClient with new node info
        this.promClient.setNodes(this.nodes);
      }
    }

    logger.debug('Event:', event);
    // Pass to prom client
    this.promClient.handleEvent(event);
  }
}

module.exports = ZwaveWebSocketClient;