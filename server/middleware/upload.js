const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // 실행 파일 차단
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      const err = new Error('허용되지 않는 파일 형식입니다.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = upload;
