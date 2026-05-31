const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const app = require('./app');
const { initSchema, seedData } = require('./database/schema');
const { initSocketHandlers } = require('./sockets/chat');

const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

initSchema();
seedData();

const server = http.createServer(app);
const sessionMiddleware = app.sessionMiddleware;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || [
  CLIENT_ORIGIN,
  'https://e-messenger.fly.dev',
  'http://localhost:5173',
  'http://localhost:4000',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    credentials: true,
  },
});

io.engine.use(sessionMiddleware);
initSocketHandlers(io);
app.set('io', io);

server.listen(PORT, () => {
  console.log(`\nE-Messenger server running: http://localhost:${PORT}`);
  console.log('Socket.io ready\n');
});

module.exports = { server, io };
