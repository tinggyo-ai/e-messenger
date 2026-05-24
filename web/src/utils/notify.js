let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// 첫 클릭 시 오디오 컨텍스트 활성화 (브라우저 정책)
export function unlockAudio() {
  try { getAudioCtx(); } catch (_) {}
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    // 두 음 차임벨
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (_) {}
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
  } catch (_) {}
}

export async function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function notify(senderName, body, channelName) {
  playChime();
  vibrate();

  // 탭이 백그라운드일 때만 시스템 알림 표시
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const title = channelName ? `${senderName} (${channelName})` : senderName;
    const n = new Notification(title, {
      body: body.length > 100 ? body.slice(0, 100) + '…' : body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      silent: true, // 시스템 소리 중복 방지 (우리가 직접 재생)
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  }
}
