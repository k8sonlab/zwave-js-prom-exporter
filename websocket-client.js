const WebSocket = require('ws');
const logger = require('./logger');

class ZwaveWebSocketClient {
  constructor(url, promClient) {
    this.url = url;
    this.promClient = promClient;
    this.ws = null;
    this.messageId = 1;
    this.nodes = new Map();
    this.startListeningMsgId = null;
  }

  connect() {
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
    });

    this.ws.on('close', () => {
      logger.info('WebSocket connection closed');
    });
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
    }
  }

  handleEvent(event) {
    logger.debug('Event:', event);
    // Pass to prom client
    this.promClient.handleEvent(event);
  }
}

module.exports = ZwaveWebSocketClient;