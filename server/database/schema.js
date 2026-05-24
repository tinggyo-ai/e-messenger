const { db } = require('./db');
const bcrypt = require('bcryptjs');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      email         TEXT,
      department    TEXT,
      position      TEXT,
      avatar_path   TEXT,
      role          TEXT NOT NULL DEFAULT 'member',
      status        TEXT NOT NULL DEFAULT 'active',
      last_seen     TEXT,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      device_name TEXT,
      expires_at  TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL DEFAULT 'group',
      name        TEXT,
      description TEXT,
      created_by  INTEGER,
      is_archived INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS channel_members (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id   INTEGER NOT NULL,
      user_id      INTEGER NOT NULL,
      role         TEXT DEFAULT 'member',
      last_read_at TEXT,
      joined_at    TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_id, user_id),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id  INTEGER NOT NULL,
      sender_id   INTEGER NOT NULL,
      body        TEXT NOT NULL DEFAULT '',
      msg_type    TEXT NOT NULL DEFAULT 'text',
      reply_to_id INTEGER,
      is_deleted  INTEGER DEFAULT 0,
      edited_at   TEXT,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id)  REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id)   REFERENCES users(id),
      FOREIGN KEY (reply_to_id) REFERENCES messages(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id   INTEGER,
      file_name    TEXT NOT NULL,
      stored_name  TEXT NOT NULL,
      mime_type    TEXT,
      file_size    INTEGER,
      width        INTEGER,
      height       INTEGER,
      uploaded_by  INTEGER NOT NULL,
      created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id)  REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      expo_token TEXT NOT NULL UNIQUE,
      platform   TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_channel_members_user     ON channel_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_message      ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender          ON messages(sender_id);
  `);
}

function seedData() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existing) return;

  const hash = bcrypt.hashSync('admin1234', 10);
  const adminId = db.prepare(`
    INSERT INTO users (username, password_hash, name, department, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin', hash, '관리자', '관리팀', 'admin').lastInsertRowid;

  const user1Id = db.prepare(`
    INSERT INTO users (username, password_hash, name, department, position, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('user1', bcrypt.hashSync('user1234', 10), '김철수', '개발팀', '팀장', 'member').lastInsertRowid;

  const user2Id = db.prepare(`
    INSERT INTO users (username, password_hash, name, department, position, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('user2', bcrypt.hashSync('user1234', 10), '이영희', '경영지원팀', '과장', 'member').lastInsertRowid;

  // 전체공지 채널
  const ch1Id = db.prepare(`
    INSERT INTO channels (type, name, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run('group', '전체공지', '전사 공지사항 채널', adminId).lastInsertRowid;

  // 일반 채널
  const ch2Id = db.prepare(`
    INSERT INTO channels (type, name, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run('group', '자유채팅', '자유롭게 대화하는 채널', adminId).lastInsertRowid;

  // 멤버 추가
  const addMember = db.prepare(`
    INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)
  `);
  [ch1Id, ch2Id].forEach(chId => {
    addMember.run(chId, adminId, 'owner');
    addMember.run(chId, user1Id, 'member');
    addMember.run(chId, user2Id, 'member');
  });

  // 환영 메시지
  db.prepare(`
    INSERT INTO messages (channel_id, sender_id, body, msg_type)
    VALUES (?, ?, ?, ?)
  `).run(ch1Id, adminId, 'NEXUS 사내 메신저에 오신 것을 환영합니다.', 'system');

  console.log('[DB] 시드 데이터 생성 완료');
  console.log('  관리자: admin / admin1234');
  console.log('  사용자1: user1 / user1234');
  console.log('  사용자2: user2 / user1234');
}

module.exports = { initSchema, seedData };
