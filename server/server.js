const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const app = require('./app');
const { initSchema, seedData } = require('./database/schema');
const { initSocketHandlers } = require('./sockets/chat');

const PORT = process.env.PORT || 4000;

// 업로드 디렉토리 보장 (볼륨 마운트 후 하위 폴더가 없을 수 있음)
const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// DB 초기화
initSchema();
seedData();

const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// app.js와 동일한 session 인스턴스 공유 (MemoryStore 동기화)
const sessionMiddleware = app.sessionMiddleware;

const io = new Server(server, {
  cors: {
    origin: [CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:4000'],
    credentials: true,
  },
});

io.engine.use(sessionMiddleware);
initSocketHandlers(io);

// 라우트에서 io 접근 가능하도록 공유
app.set('io', io);

server.listen(PORT, () => {
  console.log(`\n🚀 NEXUS 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   Socket.io 준비 완료\n`);
});

module.exports = { server, io };
