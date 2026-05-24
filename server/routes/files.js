const express = require('express');
const path = require('path');
const fs = require('fs');
const { get, run, now } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');

// POST /api/upload - 파일 업로드 (메시지 전송 전에 미리 업로드)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const { originalname, filename, mimetype, size } = req.file;

  // 이미지 크기 추출 (간단히 mime 타입으로 구분)
  const isImage = mimetype.startsWith('image/');

  const attachId = run(`
    INSERT INTO attachments (file_name, stored_name, mime_type, file_size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [originalname, filename, mimetype, size, req.user.id, now()]).lastInsertRowid;

  res.json({
    id: attachId,
    fileName: originalname,
    mimeType: mimetype,
    fileSize: size,
    isImage,
    url: `/api/files/${attachId}`,
  });
});

// GET /api/files/avatar/:filename - 아바타 이미지 서빙
router.get('/avatar/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  if (!/^[0-9a-f-]+\.[a-zA-Z]{2,5}$/.test(filename)) {
    return res.status(400).json({ error: '잘못된 파일명' });
  }
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });
  res.sendFile(filePath);
});

// GET /api/files/:id - 파일 다운로드 (인증 필수)
router.get('/:id', requireAuth, (req, res) => {
  const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
  if (!attachment) return res.status(404).json({ error: '파일 없음' });

  const filePath = path.join(UPLOAD_DIR, attachment.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 삭제되었습니다.' });

  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
  res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
});

module.exports = router;
