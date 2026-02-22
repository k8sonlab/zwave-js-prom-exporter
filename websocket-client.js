const WebSocket = require('ws');

class ZwaveWebSocketClient {
  constructor(url, promClient) {
    this.url = url;
    this.promClient = promClient;
    this.ws = null;
    this.messageId = 1;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('Connected to zwave-js-server');
      this.sendInitialize();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
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
    this.sendCommand('start_listening');
  }

  handleMessage(message) {
    if (message.type === 'version') {
      console.log('Server version:', message);
      this.sendStartListening();
    } else if (message.type === 'result') {
      console.log('Command result:', message);
    } else if (message.type === 'event') {
      this.handleEvent(message.event);
    } else {
      console.log('Unknown message type:', message);
    }
  }

  handleEvent(event) {
    console.log('Event:', event);
    // Pass to prom client
    this.promClient.handleEvent(event);
  }
}

module.exports = ZwaveWebSocketClient;