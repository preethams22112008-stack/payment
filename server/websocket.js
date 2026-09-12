const WebSocket = require('ws');

let wss = null;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'IDENTIFY') {
          ws.userRole = parsed.role;
          ws.studentId = parsed.studentId;
          ws.send(JSON.stringify({ type: 'IDENTIFIED', message: 'Client registered on event bus' }));
        }
      } catch (err) {
        // ignore non-json messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    // Send initial welcome
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      timestamp: new Date().toISOString(),
      activeClients: clients.size
    }));
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('WebSocket Server mounted on /ws');
}

function broadcast(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function notifyStudent(studentId, type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Send to matching student or broadcast if student ID not bound
      if (!client.studentId || client.studentId === studentId) {
        client.send(msg);
      }
    }
  });
}

module.exports = {
  initWebSocket,
  broadcast,
  notifyStudent
};
