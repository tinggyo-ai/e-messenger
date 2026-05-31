const express = require('express');
const path = require('path');
const fs = require('fs');
const { get, run, now } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const { originalname, filename, mimetype, size } = req.file;
  const displayName = decodeUploadFileName(originalname);
  const isImage = mimetype.startsWith('image/');

  const attachId = run(`
    INSERT INTO attachments (file_name, stored_name, mime_type, file_size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [displayName, filename, mimetype, size, req.user.id, now()]).lastInsertRowid;

  res.json({
    id: attachId,
    fileName: displayName,
    mimeType: mimetype,
    fileSize: size,
    isImage,
    url: `/api/files/${attachId}`,
    downloadUrl: `/api/files/${attachId}/download`,
  });
});

router.get('/avatar/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  if (!/^[0-9a-f-]+\.[a-zA-Z]{2,5}$/.test(filename)) {
    return res.status(400).json({ error: '올바르지 않은 파일명입니다.' });
  }
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 없습니다.' });
  res.sendFile(filePath);
});

router.get('/:id/download', requireAuth, (req, res) => {
  sendAttachment(req, res, 'attachment');
});

router.get('/:id', requireAuth, (req, res) => {
  sendAttachment(req, res, 'inline');
});

function sendAttachment(req, res, disposition) {
  const attachment = get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
  if (!attachment) return res.status(404).json({ error: '파일이 없습니다.' });

  const filePath = path.join(UPLOAD_DIR, attachment.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 삭제되었습니다.' });

  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
  res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
}

function decodeUploadFileName(name) {
  if (!name) return 'file';
  const cleaned = String(name).replace(/[\\/:*?"<>|]/g, '_').trim();

  try {
    const repaired = Buffer.from(cleaned, 'latin1').toString('utf8');
    const safeRepaired = repaired.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (looksBetter(safeRepaired, cleaned)) return safeRepaired;
  } catch (_) {}

  return cleaned || 'file';
}

function looksBetter(repaired, original) {
  if (!repaired || repaired.includes('\uFFFD')) return false;
  const originalBrokenScore = (original.match(/[ÃÂìíëêð]/g) || []).length;
  const repairedKoreanScore = (repaired.match(/[\uAC00-\uD7A3]/g) || []).length;
  return repairedKoreanScore > 0 || originalBrokenScore >= 2;
}

module.exports = router;
