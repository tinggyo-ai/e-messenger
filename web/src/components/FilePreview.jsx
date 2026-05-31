import { Archive, Download, File, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';
import { apiUrl } from '../api/client';

export default function FilePreview({ attachment }) {
  const fileName = repairFileName(attachment.file_name || attachment.fileName || '\uD30C\uC77C');
  const mimeType = attachment.mime_type || attachment.mimeType;
  const fileSize = attachment.file_size || attachment.fileSize;
  const id = attachment.id;
  const isImage = mimeType && mimeType.startsWith('image/');
  const previewUrl = fileUrl(id, false);
  const downloadUrl = fileUrl(id, true);

  function handleDownload() {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (isImage) {
    return (
      <div className="image-preview">
        <button type="button" className="image-preview-button" onClick={handleDownload} title={fileName}>
          <img
            src={previewUrl}
            alt={fileName}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        </button>
        <div className="file-actions-row">
          <span className="file-name" title={fileName}>{fileName}</span>
          <button type="button" className="file-open-button" onClick={handleDownload} title="\uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC">
            <Download size={14} />
            <span>\uB2E4\uC6B4\uB85C\uB4DC</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="file-chip" onClick={handleDownload} title={fileName}>
      <FileIcon mime={mimeType} />
      <span className="file-info">
        <span className="file-name">{fileName}</span>
        {fileSize && <span className="file-size">{formatSize(fileSize)}</span>}
      </span>
      <span className="file-open-button">
        <Download size={14} />
        <span>\uB2E4\uC6B4\uB85C\uB4DC</span>
      </span>
    </button>
  );
}

function fileUrl(id, download) {
  const url = apiUrl(`/files/${id}${download ? '/download' : ''}`);
  const token = localStorage.getItem('accessToken');
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function FileIcon({ mime }) {
  if (!mime) return <File size={20} />;
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) return <FileText size={20} />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return <FileSpreadsheet size={20} />;
  if (mime.includes('zip') || mime.includes('compressed')) return <Archive size={20} />;
  if (mime.includes('image')) return <ImageIcon size={20} />;
  return <File size={20} />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function repairFileName(name) {
  const value = String(name || '').trim();
  if (!value) return '\uD30C\uC77C';
  try {
    const repaired = decodeURIComponent(escape(value));
    if (repaired && !repaired.includes('\uFFFD') && /[\uAC00-\uD7A3]/.test(repaired)) return repaired;
  } catch (_) {}
  return value;
}
