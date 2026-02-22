const ZwaveWebSocketClient = require('./websocket-client');
const PromClient = require('./prom-client');

const ZWAVE_WS_URL = process.env.ZWAVE_WS_URL || 'ws://localhost:3000';
const PROM_PORT = process.env.PROM_PORT || 9090;

const promClient = new PromClient(PROM_PORT);
const wsClient = new ZwaveWebSocketClient(ZWAVE_WS_URL, promClient);

wsClient.connect();