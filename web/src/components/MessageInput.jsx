import { useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Paperclip, Send, X } from 'lucide-react';
import api, { apiUrl } from '../api/client';

export default function MessageInput({ channelId, onSend, onTyping }) {
  const [body, setBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimer.current);
      onTyping && onTyping(false);
    };
  }, [channelId, onTyping]);

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
      focusComposer();
    } catch (err) {
      alert(`파일 업로드 실패: ${err.response?.data?.error || err.message}`);
    } finally {
      setUploading(false);
    }
  }

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

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleSend(e) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed && pendingFiles.length === 0) {
      focusComposer();
      return;
    }

    const attachmentIds = pendingFiles.map(f => f.id);
    setBody('');
    setPendingFiles([]);
    resetTextareaHeight();
    onTyping && onTyping(false);
    onSend({ channelId, body: trimmed, attachmentIds });
    focusComposer();
  }

  function handlePointerDown(e) {
    e.preventDefault();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!uploading) handleSend(e);
    }
  }

  function handleChange(e) {
    setBody(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;

    onTyping && onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping && onTyping(false), 2000);
  }

  function removePending(idx) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    focusComposer();
  }

  function focusComposer() {
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  }

  function resetTextareaHeight() {
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  }

  return (
    <div
      className="composer"
      style={{ outline: dragOver ? '2px solid rgba(254, 229, 0, 0.9)' : 'none' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {pendingFiles.length > 0 && (
        <div className="pending-row">
          {pendingFiles.map((f, i) => {
            const displayName = repairFileName(f.fileName || f.file_name || '파일');
            return (
              <div key={`${f.id}-${i}`} className="pending-chip">
                {f.isImage
                  ? <img src={fileUrl(f.id)} alt={displayName} />
                  : <FileText size={18} />
                }
                <span className="pending-name" title={displayName}>{displayName}</span>
                <button
                  className="icon-button"
                  style={{ width: 24, height: 24 }}
                  onPointerDown={handlePointerDown}
                  onClick={() => removePending(i)}
                  title="첨부 삭제"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form className="composer-row" onSubmit={handleSend}>
        <button
          type="button"
          className="icon-button"
          title="파일 첨부"
          onPointerDown={handlePointerDown}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={21} className="spin" /> : <Paperclip size={21} />}
        </button>

        <textarea
          ref={textareaRef}
          className="message-textarea"
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={dragOver ? '파일을 여기에 놓으세요' : '메시지를 입력하세요'}
          rows={1}
        />

        <button
          type="submit"
          className="send-button"
          onPointerDown={handlePointerDown}
          disabled={uploading || (!body.trim() && pendingFiles.length === 0)}
          title="전송"
        >
          {pendingFiles.some(f => f.isImage) && !body.trim() ? <ImageIcon size={19} /> : <Send size={19} />}
        </button>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function fileUrl(id) {
  const url = apiUrl(`/files/${id}`);
  const token = localStorage.getItem('accessToken');
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function repairFileName(name) {
  const value = String(name || '').trim();
  if (!value) return '파일';
  try {
    const repaired = decodeURIComponent(escape(value));
    if (repaired && !repaired.includes('\uFFFD') && /[\uAC00-\uD7A3]/.test(repaired)) return repaired;
  } catch (_) {}
  return value;
}
