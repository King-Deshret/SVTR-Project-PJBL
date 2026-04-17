/**
 * app.js
 * Main application controller.
 * Handles:
 *   - Screen navigation (Home → Camera → Result → Settings)
 *   - Shutter button → capture → OCR → show result
 *   - Save photo to device
 *   - Toast notifications
 *   - Page visibility (stop camera when tab hidden)
 */

const App = (() => {

  // ── STATE ─────────────────────────────────────────────────────
  let lastDataUrl = null;   // last captured image (base64)
  let lastText    = '';     // last OCR result text

  // ── SCREEN NAVIGATION ─────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // ── INIT ──────────────────────────────────────────────────────
  function init() {
    Settings.load();
    Settings.bindUI();
    bindAllEvents();
    showScreen('screen-home');
  }

  // ── BIND ALL EVENTS ───────────────────────────────────────────
  function bindAllEvents() {

    // HOME → Open Camera
    document.getElementById('btn-open-camera').addEventListener('click', () => {
      showScreen('screen-camera');
      Camera.start();
    });

    // HOME → Settings
    document.getElementById('btn-open-settings').addEventListener('click', () => {
      showScreen('screen-settings');
    });

    // SETTINGS → Back
    document.getElementById('settings-back').addEventListener('click', () => {
      showScreen('screen-home');
    });

    // CAMERA → Back (go home, stop camera)
    document.getElementById('cam-back').addEventListener('click', () => {
      Camera.stop();
      TTS.stop();
      showScreen('screen-home');
    });

    // CAMERA → Flip
    document.getElementById('cam-flip').addEventListener('click', () => {
      Camera.flip();
    });

    // CAMERA → Mode pills
    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', () => Camera.setMode(pill.dataset.mode));
    });

    // CAMERA → Shutter button
    document.getElementById('shutter-btn').addEventListener('click', handleShutter);

    // CAMERA → Thumbnail (view last result)
    document.getElementById('thumb-btn').addEventListener('click', () => {
      if (lastDataUrl) {
        showResultScreen(lastDataUrl, lastText, 0, null);
      } else {
        showToast('No capture yet');
      }
    });

    // RESULT → Back to camera
    document.getElementById('result-back-cam').addEventListener('click', () => {
      TTS.stop();
      showScreen('screen-camera');
    });

    // RESULT → Home
    document.getElementById('result-home').addEventListener('click', () => {
      TTS.stop();
      Camera.stop();
      showScreen('screen-home');
    });

    // RESULT → Read Aloud
    document.getElementById('act-speak').addEventListener('click', () => {
      if (TTS.isSpeaking()) {
        TTS.stop();
      } else {
        const text = document.getElementById('result-textbox').textContent;
        TTS.speak(text);
      }
    });

    // RESULT → Copy Text
    document.getElementById('act-copy').addEventListener('click', () => {
      const text = document.getElementById('result-textbox').textContent;
      copyText(text);
    });

    // RESULT → Save Photo
    document.getElementById('act-save').addEventListener('click', () => {
      savePhoto(lastDataUrl);
    });

    // RESULT → TTS Stop
    document.getElementById('tts-stop').addEventListener('click', () => TTS.stop());

    // RESULT → Scan Again
    document.getElementById('scan-again-btn').addEventListener('click', () => {
      TTS.stop();
      showScreen('screen-camera');
    });

    // Stop camera when user switches tab / app
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Camera.stop();
        TTS.stop();
      } else {
        // Restart camera only if camera screen is active
        if (document.getElementById('screen-camera').classList.contains('active')) {
          Camera.start();
        }
      }
    });
  }

  // ── SHUTTER HANDLER ───────────────────────────────────────────
  async function handleShutter() {
    if (!document.getElementById('screen-camera').classList.contains('active')) return;

    // 1. Capture frame from camera
    const dataUrl = Camera.capture();
    if (!dataUrl) {
      showToast('Camera not ready', 'err');
      return;
    }

    lastDataUrl = dataUrl;

    // 2. Flash effect
    triggerFlash();

    // Update thumbnail
    updateThumb(dataUrl);

    const mode = Camera.getMode();

    if (mode === 'scan') {
      // 3. Show processing overlay
      OCR.showProc();
      OCR.setStep(0); // "Capturing image"

      // Small delay so user sees the capture flash before overlay
      await new Promise(r => setTimeout(r, 150));
      OCR.setStep(1); // "Sending to API server"

      // 4. Send to API server → backend
      const result = await OCR.sendToServer(dataUrl);

      // 5. Hide processing overlay
      OCR.hideProc();

      lastText = result.text || '';

      // 6. Navigate to result screen
      showResultScreen(dataUrl, result.text, result.confidence, result.error);

    } else {
      // PHOTO mode — just show the image, no OCR
      lastText = '';
      showResultScreen(dataUrl, '', 0, null);
    }
  }

  // ── SHOW RESULT SCREEN ────────────────────────────────────────
  function showResultScreen(dataUrl, text, confidence, error) {
    // Set image
    document.getElementById('result-img').src = dataUrl;

    // Set text
    const textbox = document.getElementById('result-textbox');
    if (text && text.trim()) {
      textbox.textContent = text;
      textbox.style.color = '';
    } else {
      textbox.innerHTML = '<span class="placeholder-text">No text detected in this image.</span>';
    }

    // Word count
    const wc = text ? text.split(/\s+/).filter(Boolean).length : 0;
    document.getElementById('word-count-chip').textContent = `${wc} word${wc !== 1 ? 's' : ''}`;

    // Confidence badge
    const confChip = document.getElementById('conf-chip');
    if (confidence > 0) {
      confChip.textContent = `${confidence}% confidence`;
      confChip.style.display = '';
    } else {
      confChip.style.display = 'none';
    }

    // Error banner
    const errBanner = document.getElementById('error-banner');
    if (error) {
      document.getElementById('error-msg').textContent = error;
      errBanner.classList.remove('hidden');
    } else {
      errBanner.classList.add('hidden');
    }

    // Hide TTS bar (from any previous result)
    document.getElementById('tts-bar').classList.add('hidden');
    document.getElementById('speak-label').textContent = 'Read Aloud';

    showScreen('screen-result');
  }

  // ── SAVE PHOTO ────────────────────────────────────────────────
  /**
   * Save photo to device.
   * On Android Chrome: uses Web Share API (native share sheet → save to gallery)
   * Fallback: triggers a download
   */
  function savePhoto(dataUrl) {
    if (!dataUrl) { showToast('No photo to save', 'err'); return; }

    // Try native Web Share API (Android Chrome → allows "Save to Gallery")
    if (navigator.share && navigator.canShare) {
      fetch(dataUrl)
        .then(r => r.blob())
        .then(blob => {
          const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            return navigator.share({
              files: [file],
              title: 'TextProduct Scanner',
              text: 'Scan result from TextProduct Scanner',
            });
          }
          throw new Error('file share not supported');
        })
        .then(() => showToast('Photo shared / saved! ✅', 'ok'))
        .catch(() => downloadFallback(dataUrl));
    } else {
      downloadFallback(dataUrl);
    }
  }

  // Fallback: trigger browser download
  function downloadFallback(dataUrl) {
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = `scan_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Photo downloaded! 📥', 'ok');
  }

  // ── COPY TEXT ─────────────────────────────────────────────────
  function copyText(text) {
    if (!text || !text.trim()) { showToast('No text to copy', 'err'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast('Text copied! ✅', 'ok');
          const lbl = document.getElementById('copy-label');
          if (lbl) { lbl.textContent = 'Copied!'; setTimeout(() => lbl.textContent = 'Copy Text', 2000); }
        })
        .catch(() => legacyCopy(text));
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Text copied! ✅', 'ok');
  }

  // ── FLASH EFFECT ─────────────────────────────────────────────
  function triggerFlash() {
    const el = document.getElementById('flash-overlay');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 300);
  }

  // ── UPDATE THUMBNAIL ─────────────────────────────────────────
  function updateThumb(dataUrl) {
    const empty = document.getElementById('thumb-empty');
    const img   = document.getElementById('thumb-img');
    if (empty) empty.classList.add('hidden');
    if (img)   { img.src = dataUrl; img.classList.remove('hidden'); }
  }

  // ── TOAST ─────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast' + (type ? ` ${type}` : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // ── PUBLIC ────────────────────────────────────────────────────
  return { init, showToast, showScreen, savePhoto, copyText };

})();

// ── BOOT ──────────────────────────────────────────────────────────
window.addEventListener('load', () => App.init());
