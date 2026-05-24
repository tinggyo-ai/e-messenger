export default function FilePreview({ attachment }) {
  const { file_name, mime_type, file_size, id } = attachment;
  const isImage = mime_type && mime_type.startsWith('image/');
  const url = `/api/files/${id}`;

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getFileColor(mime) {
    if (!mime) return 'var(--text-muted)';
    if (mime.includes('pdf')) return '#ff6b6b';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '#00d26a';
    if (mime.includes('word') || mime.includes('document')) return '#4d9eff';
    if (mime.includes('image')) return 'var(--accent-cyan)';
    if (mime.includes('zip') || mime.includes('compressed')) return 'var(--accent-amber)';
    return 'var(--text-muted)';
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={styles.imgLink}>
        <img
          src={url}
          alt={file_name}
          style={styles.img}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <span style={{ ...styles.imgName, color: 'var(--text-muted)' }}>{file_name}</span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" style={styles.chip}>
      <span style={{ ...styles.icon, color: getFileColor(mime_type) }}>
        {getFileIcon(mime_type)}
      </span>
      <span style={styles.info}>
        <span style={styles.name}>{file_name}</span>
        {file_size && <span style={styles.size}>{formatSize(file_size)}</span>}
      </span>
    </a>
  );
}

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📗';
  if (mime.includes('word') || mime.includes('document')) return '📘';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜';
  if (mime.includes('image')) return '🖼';
  return '📎';
}

const styles = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    textDecoration: 'none',
    maxWidth: '320px',
    transition: 'border-color 0.15s',
  },
  icon: { fontSize: '20px', flexShrink: 0 },
  info: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  name: {
    color: 'var(--text-primary)',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  size: { color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' },
  imgLink: {
    display: 'inline-block',
    textDecoration: 'none',
  },
  img: {
    display: 'block',
    maxWidth: '320px',
    maxHeight: '240px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    objectFit: 'contain',
    cursor: 'pointer',
  },
  imgName: { display: 'block', fontSize: '11px', marginTop: '4px' },
};
