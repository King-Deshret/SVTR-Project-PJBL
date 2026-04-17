/**
 * ocr.js
 * Handles the full image → API Server → Backend → result pipeline.
 *
 * Flow:
 *   1. Frontend captures image (base64 JPEG)
 *   2. Frontend sends HTTP POST to your Azure API Server
 *   3. Azure API Server forwards to your Backend (SVTR + OCR)
 *   4. Backend returns JSON: { text, confidence, regions, method }
 *   5. Frontend displays result and enables TTS
 *
 * ─── HOW THE API SERVER RECEIVES THE IMAGE ───────────────────
 *   Your Azure API Server should expose this endpoint:
 *
 *   POST /api/scan
 *   Content-Type: application/json
 *   Body: {
 *     "image": "<base64 JPEG string>",
 *     "language": "eng"
 *   }
 *
 *   Expected response:
 *   {
 *     "status": "success",
 *     "text": "Indomie Goreng...",
 *     "confidence": 94.2,
 *     "regions": [...],      // optional: array of detected text boxes
 *     "method": "SVTR"       // optional: which OCR model was used
 *   }
 *
 * ─── HOW THE API SERVER FORWARDS TO BACKEND ──────────────────
 *   Your Azure API Server (Node.js / Python Flask) receives the
 *   image, then makes an INTERNAL request to your Backend server:
 *
 *   POST http://backend-server/process
 *   Body: { image: base64, language: "eng" }
 *
 *   The Backend runs:
 *     1. OpenCV preprocessing (grayscale, denoise, binarize)
 *     2. PaddleOCR text detection (find text regions)
 *     3. SVTR text recognition (read characters)
 *     4. Self-confidence scoring
 *   Then returns JSON to the API Server, which forwards it to Frontend.
 */

const OCR = (() => {

  // ── STEP LABELS (shown in processing overlay) ─────────────────
  const STEPS = [
    { id: 'step-capture',    label: '📸 Capturing image'         },
    { id: 'step-send',       label: '📤 Sending to API server'   },
    { id: 'step-preprocess', label: '🔧 Preprocessing image'     },
    { id: 'step-ocr',        label: '🔍 Running OCR + SVTR'      },
    { id: 'step-result',     label: '✅ Receiving result'         },
  ];

  // Mark a step as active (green) or done (grey)
  function setStep(index) {
    STEPS.forEach((s, i) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i < index)  el.classList.add('done');
      if (i === index) el.classList.add('active');
    });
    const textEl = document.getElementById('proc-text');
    if (textEl && STEPS[index]) textEl.textContent = STEPS[index].label;
  }

  // ── SHOW / HIDE PROCESSING OVERLAY ───────────────────────────
  function showProc()  { document.getElementById('proc-overlay').classList.remove('hidden'); }
  function hideProc()  { document.getElementById('proc-overlay').classList.add('hidden'); }

  // ── MAIN: SEND IMAGE TO API SERVER ───────────────────────────
  /**
   * @param {string} dataUrl - base64 JPEG image from camera.capture()
   * @returns {{ text, confidence, error }} — result object
   */
  async function sendToServer(dataUrl) {
    const apiUrl = Settings.getApiUrl();

    // ─── NO SERVER CONFIGURED: DEMO MODE ─────────────────────────
    if (!apiUrl) {
      // Simulate delay to show the processing steps
      await simulateSteps();
      return {
        text:       'DEMO MODE\n\nNo API server configured.\nGo to Settings and enter your Azure API server URL to enable real OCR.',
        confidence: 0,
        demo:       true,
      };
    }

    // ─── REAL MODE: SEND TO YOUR AZURE API SERVER ─────────────────
    setStep(1); // "Sending to API server"

    // Strip the data:image/jpeg;base64, prefix — send only raw base64
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image:    base64,
          language: 'eng',
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      setStep(4); // "Receiving result"

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'error' || data.error) {
        throw new Error(data.error || data.message || 'Unknown server error');
      }

      return {
        text:       (data.text || '').trim(),
        confidence: Math.round(data.confidence || 0),
        regions:    data.regions || [],
        method:     data.method || 'OCR',
      };

    } catch (err) {
      console.error('OCR API error:', err);
      let msg = err.message;
      if (err.name === 'TimeoutError') msg = 'Request timed out. Server took too long to respond.';
      if (err.name === 'TypeError')    msg = 'Cannot reach server. Check your internet and API URL in Settings.';
      return { text: '', confidence: 0, error: msg };
    }
  }

  // ── DEMO MODE SIMULATION ─────────────────────────────────────
  async function simulateSteps() {
    const delays = [400, 600, 800, 700, 500];
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }

  return { sendToServer, showProc, hideProc, setStep };

})();

{
  "name": "TextProduct Scanner",
  "short_name": "TextScanner",
  "description": "Scan text from food packaging. OCR, Text-to-Speech, Save Photo.",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' fill='%23ffffff' rx='32'/><rect x='24' y='52' width='144' height='100' rx='14' stroke='%2300a86b' stroke-width='8' fill='none'/><circle cx='96' cy='102' r='26' stroke='%2300a86b' stroke-width='8' fill='none'/><circle cx='96' cy='102' r='10' fill='%2300a86b'/><rect x='60' y='36' width='72' height='20' rx='10' fill='%2300a86b'/></svg>",
      "sizes": "192x192",
      "type": "image/svg+xml"
    }
  ],
  "categories": ["photography", "utilities", "productivity"]
}
