let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function unlockAudio() {
  try { getAudioCtx(); } catch (_) {}
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  } catch (_) {}
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([120, 70, 120]);
  } catch (_) {}
}

export async function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function notify(senderName, body = '', channelName) {
  playChime();
  vibrate();

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const title = channelName ? `${senderName} (${channelName})` : senderName;
    const n = new Notification(title, {
      body: body.length > 100 ? `${body.slice(0, 100)}...` : body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      silent: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  }
}
