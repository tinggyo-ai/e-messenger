import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/client';

export default function MessageInput({ channelId, onSend, onTyping }) {
  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);

  // 채널 변경 또는 언마운트 시 타이핑 타이머 정리
  useEffect(() => {
    return () => {
      clearTimeout(typingTimer.current);
      onTyping && onTyping(false);
    };
  }, [channelId]);

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(Array.from(files).map(uploadFile));
      setPendingFiles(prev => [...prev, ...uploads]);
    } catch (err) {
      alert('파일 업로드 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  }

  // Ctrl+V 클립보드 붙여넣기
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  }

  // 드래그앤드롭
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    const attachmentIds = pendingFiles.map(f => f.id);
    setBody('');
    setPendingFiles([]);
    onSend({ channelId, body: trimmed, attachmentIds });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!uploading) handleSend();
    }
  }

  function handleChange(e) {
    setBody(e.target.value);

    // 타이핑 디바운스
    onTyping && onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping && onTyping(false), 2000);
  }

  function removePending(idx) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div
      style={{ ...styles.root, borderColor: dragOver ? 'var(--border-active)' : 'var(--border)' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 첨부 파일 미리보기 */}
      {pendingFiles.length > 0 && (
        <div style={styles.pendingRow}>
          {pendingFiles.map((f, i) => (
            <div key={i} style={styles.pendingChip}>
              {f.isImage
                ? <img src={f.url} alt={f.fileName} style={styles.pendingThumb} />
                : <span style={styles.pendingIcon}>📎</span>
              }
              <span style={styles.pendingName}>{f.fileName}</span>
              <button style={styles.removeBtn} onClick={() => removePending(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.inputRow}>
        <button
          style={styles.attachBtn}
          title="파일 첨부"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳' : '📎'}
        </button>

        <textarea
          style={styles.textarea}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={dragOver ? '파일을 여기에 놓으세요' : '메시지를 입력하세요  (Shift+Enter: 줄바꿈)'}
          rows={1}
        />

        <button
          style={{
            ...styles.sendBtn,
            opacity: (body.trim() || pendingFiles.length > 0) ? 1 : 0.4,
          }}
          onClick={handleSend}
          disabled={uploading || (!body.trim() && pendingFiles.length === 0)}
        >
          ↑
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}

const styles = {
  root: {
    borderTop: '1px solid',
    borderColor: 'var(--border)',
    padding: '12px 16px',
    background: 'var(--bg-panel)',
    transition: 'border-color 0.15s',
  },
  pendingRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '10px',
  },
  pendingChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    maxWidth: '200px',
  },
  pendingThumb: { width: '32px', height: '32px', objectFit: 'cover', borderRadius: '2px' },
  pendingIcon: { fontSize: '18px' },
  pendingName: {
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    flexShrink: 0,
    padding: '2px',
  },
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  attachBtn: {
    fontSize: '20px',
    padding: '6px',
    color: 'var(--text-muted)',
    borderRadius: '4px',
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 12px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    lineHeight: '1.5',
    outline: 'none',
    maxHeight: '160px',
    overflowY: 'auto',
    fontFamily: 'var(--font-main)',
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    background: 'var(--accent-cyan)',
    color: '#000',
    borderRadius: '6px',
    fontSize: '18px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};
