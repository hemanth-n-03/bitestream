let sharedAudioCtx = null;

/**
 * Plays a gentle two-tone chime using the browser Web Audio API.
 * Safe when AudioContext is unavailable or blocked before user interaction.
 */
export function playNewOrderChime() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const now = sharedAudioCtx.currentTime;
    const notes = [659.25, 880]; // E5 -> A5 pleasant bell interval

    notes.forEach((freq, idx) => {
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.32);

      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.34);
    });
  } catch {
    // Ignore audio API errors safely
  }
}
