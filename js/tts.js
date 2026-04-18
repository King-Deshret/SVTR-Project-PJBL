/**
 * tts.js
 * Text-to-Speech using the browser's built-in Web Speech API.
 * Works on Android Chrome using the device's Google TTS engine.
 * No internet required — runs entirely on the device.
 */

const TTS = (() => {

  let speaking = false;

  // ── SPEAK ─────────────────────────────────────────────────────
  /**
   * Speak the given text out loud.
   * @param {string} text — the text to read
   * @param {Function} onDone — called when speech finishes
   */
  function speak(text, onDone) {
    if (!('speechSynthesis' in window)) {
      App.showToast('Text-to-Speech is not supported on this browser', 'err');
      return;
    }
    if (!text || !text.trim()) {
      App.showToast('No text to speak', 'err');
      return;
    }

    stop(); // Cancel any ongoing speech first

    const utterance      = new SpeechSynthesisUtterance(text);
    utterance.lang       = 'en-US';
    utterance.rate       = 0.92;   // slightly slower than default
    utterance.pitch      = 1.0;
    utterance.volume     = 1.0;

    utterance.onstart = () => {
      speaking = true;
      showTTSBar();
      updateSpeakBtn(true);
    };

    utterance.onend = utterance.onerror = () => {
      speaking = false;
      hideTTSBar();
      updateSpeakBtn(false);
      if (onDone) onDone();
    };

    window.speechSynthesis.speak(utterance);
  }

  // ── STOP ─────────────────────────────────────────────────────
  function stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speaking = false;
    hideTTSBar();
    updateSpeakBtn(false);
  }

  function isSpeaking() { return speaking; }

  // ── UI HELPERS ────────────────────────────────────────────────
  function showTTSBar() {
    document.getElementById('tts-bar').classList.remove('hidden');
  }
  function hideTTSBar() {
    document.getElementById('tts-bar').classList.add('hidden');
  }
  function updateSpeakBtn(active) {
    const btn   = document.getElementById('act-speak');
    const label = document.getElementById('speak-label');
    if (!btn || !label) return;
    label.textContent = active ? 'Stop Speaking' : 'Read Aloud';
    btn.classList.toggle('act-green', true);
  }

  return { speak, stop, isSpeaking };

})();
