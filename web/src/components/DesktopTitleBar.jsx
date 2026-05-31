import { Maximize2, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DesktopTitleBar() {
  const desktop = window.eMessengerDesktop;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cleanup;
    desktop?.isMaximized?.().then(setMaximized).catch(() => {});
    cleanup = desktop?.onWindowState?.(state => setMaximized(Boolean(state.maximized)));
    return () => cleanup?.();
  }, [desktop]);

  if (!desktop?.isDesktop) return null;

  return (
    <header className="desktop-titlebar">
      <div className="desktop-drag-region">
        <img className="desktop-titlebar-icon" src="/icon-192.png" alt="" />
        <div className="desktop-titlebar-copy">
          <strong>E-Messenger</strong>
          <span>Company Chat</span>
        </div>
      </div>
      <div className="desktop-window-controls">
        <button type="button" onClick={() => desktop.minimize()} title="최소화">
          <Minus size={17} />
        </button>
        <button type="button" onClick={() => desktop.toggleMaximize()} title={maximized ? '이전 크기' : '최대화'}>
          {maximized ? <Square size={14} /> : <Maximize2 size={15} />}
        </button>
        <button type="button" className="desktop-close-button" onClick={() => desktop.close()} title="닫기">
          <X size={17} />
        </button>
      </div>
    </header>
  );
}
