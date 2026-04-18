/**
 * camera.js
 * Handles everything related to the camera:
 *   - Start / stop camera stream
 *   - Flip between front and back camera
 *   - Capture a frame from the video
 *   - Apply resolution from settings
 */

const Camera = (() => {

  let stream      = null;
  let facingMode  = 'environment'; // 'environment' = back, 'user' = front
  let currentMode = 'scan';        // 'scan' | 'photo'

  const video  = document.getElementById('cam-video');
  const canvas = document.getElementById('cam-canvas');
  const ctx    = canvas.getContext('2d');

  // ── START CAMERA ──────────────────────────────────────────────
  async function start() {
    stop(); // Always stop previous stream first

    const noCamEl = document.getElementById('no-cam');
    noCamEl.classList.add('hidden');

    // Map resolution setting to camera constraints
    const resMap = {
      '720':  { width: { ideal: 1280 },  height: { ideal: 720  } },
      '1080': { width: { ideal: 1920 },  height: { ideal: 1080 } },
      '2160': { width: { ideal: 3840 },  height: { ideal: 2160 } },
    };
    const res = resMap[Settings.getResolution()] || resMap['1080'];

    const constraints = {
      video: { facingMode: { ideal: facingMode }, ...res },
      audio: false,
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.error('Camera error:', err);
      let msg = 'Please allow camera permission to continue.';
      if (err.name === 'NotAllowedError')
        msg = 'Camera permission denied. Tap the 🔒 lock icon in your browser address bar → Permissions → Allow Camera → reload.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera found on this device.';
      else if (err.name === 'NotReadableError')
        msg = 'Camera is in use by another app. Close it and retry.';

      document.getElementById('no-cam-msg').textContent = msg;
      noCamEl.classList.remove('hidden');

      // Retry with minimal constraints (no resolution preference)
      if (err.name !== 'NotAllowedError' && err.name !== 'NotFoundError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video.srcObject = stream;
          await video.play();
          noCamEl.classList.add('hidden');
        } catch (_) {}
      }
    }
  }

  // ── STOP CAMERA ───────────────────────────────────────────────
  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      video.srcObject = null;
    }
  }

  // ── FLIP CAMERA ───────────────────────────────────────────────
  function flip() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    start();
    App.showToast(facingMode === 'environment' ? '📷 Back camera' : '🤳 Front camera');
  }

  // ── CAPTURE FRAME → returns dataUrl (JPEG base64 string) ──────
  function capture() {
    if (!stream) return null;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  // ── SET MODE ──────────────────────────────────────────────────
  function setMode(mode) {
    currentMode = mode;

    const badge    = document.getElementById('cam-badge');
    const hint     = document.getElementById('cam-hint');
    const overlay  = document.getElementById('scan-overlay');
    const dot      = document.getElementById('shutter-dot');
    const btn      = document.getElementById('shutter-btn');
    const beam     = document.getElementById('scan-beam');
    const label    = document.getElementById('cam-mode-label');

    if (mode === 'scan') {
      badge.textContent       = 'SCAN';
      hint.textContent        = 'Point at text and tap the button';
      overlay.style.display   = 'block';
      dot.className           = 'shutter-dot scan-mode';
      btn.classList.add('scan-mode');
      label.textContent       = 'SCAN MODE';
    } else {
      badge.textContent       = 'PHOTO';
      hint.textContent        = 'Tap the button to capture';
      overlay.style.display   = 'none';
      dot.className           = 'shutter-dot';
      btn.classList.remove('scan-mode');
      label.textContent       = 'PHOTO MODE';
    }

    // Update mode pills
    document.querySelectorAll('.mode-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.mode === mode);
    });
  }

  function getMode() { return currentMode; }

  return { start, stop, flip, capture, setMode, getMode };

})();
