/**
 * settings.js
 * Manages user preferences:
 *   - Camera resolution
 *   - App theme (white / black)
 *   - API server URL
 * All saved to localStorage so they persist after closing the app.
 */

const Settings = (() => {

  // ── DEFAULTS ───────────────────────────────────────────────────
  const DEFAULTS = {
    resolution: '1080',
    theme:      'white',
    apiUrl:     '',
  };

  const RES_INFO = {
    '720':  '1280 × 720 — Fast scan, good for clear text',
    '1080': '1920 × 1080 — Balanced quality and speed',
    '2160': '3840 × 2160 — Best quality, slower processing',
  };

  // Current settings object
  let current = { ...DEFAULTS };

  // ── LOAD / SAVE ────────────────────────────────────────────────
  function load() {
    try {
      const saved = localStorage.getItem('tps_settings');
      if (saved) current = { ...DEFAULTS, ...JSON.parse(saved) };
    } catch (_) {}
    applyTheme(current.theme);
  }

  function save() {
    try { localStorage.setItem('tps_settings', JSON.stringify(current)); } catch (_) {}
  }

  // ── GETTERS ────────────────────────────────────────────────────
  function getResolution() { return current.resolution; }
  function getTheme()      { return current.theme;      }
  function getApiUrl()     { return current.apiUrl;     }

  // ── THEME ──────────────────────────────────────────────────────
  function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    current.theme = theme;

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'black' ? '#0d0d0d' : '#ffffff';
  }

  // ── BIND SETTINGS UI ──────────────────────────────────────────
  function bindUI() {
    // Resolution pills
    document.querySelectorAll('.res-pill').forEach(pill => {
      if (pill.dataset.res === current.resolution) pill.classList.add('active');
      else pill.classList.remove('active');

      pill.addEventListener('click', () => {
        document.querySelectorAll('.res-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        current.resolution = pill.dataset.res;
        document.getElementById('res-info').textContent = RES_INFO[current.resolution];
        save();
      });
    });

    // Set initial res info text
    document.getElementById('res-info').textContent = RES_INFO[current.resolution];

    // Theme options
    document.querySelectorAll('.theme-opt').forEach(opt => {
      if (opt.dataset.theme === current.theme) opt.classList.add('active');
      else opt.classList.remove('active');

      opt.addEventListener('click', () => {
        document.querySelectorAll('.theme-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        // Toggle checkmarks
        document.getElementById('check-white').classList.toggle('hidden', opt.dataset.theme !== 'white');
        document.getElementById('check-black').classList.toggle('hidden', opt.dataset.theme !== 'black');

        applyTheme(opt.dataset.theme);
        save();
      });
    });

    // Sync checkmarks to saved theme
    document.getElementById('check-white').classList.toggle('hidden', current.theme !== 'white');
    document.getElementById('check-black').classList.toggle('hidden', current.theme !== 'black');

    // API URL input
    const apiInput = document.getElementById('api-url-input');
    apiInput.value = current.apiUrl;
    apiInput.addEventListener('change', () => {
      current.apiUrl = apiInput.value.trim();
      save();
    });

    // Test connection button
    document.getElementById('btn-test-api').addEventListener('click', testConnection);
  }

  // ── TEST API CONNECTION ────────────────────────────────────────
  async function testConnection() {
    const statusEl = document.getElementById('api-status');
    const url = current.apiUrl;

    if (!url) {
      statusEl.className = 'api-status err';
      statusEl.textContent = '⚠️  Please enter your API server URL first.';
      statusEl.classList.remove('hidden');
      return;
    }

    statusEl.className = 'api-status';
    statusEl.textContent = '⏳  Testing connection…';
    statusEl.classList.remove('hidden');

    try {
      // Try to reach the /health endpoint of your API server
      const res = await fetch(`${url.replace(/\/$/, '')}/health`, { method: 'GET', signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        statusEl.className = 'api-status ok';
        statusEl.textContent = '✅  Connection successful! Server is reachable.';
      } else {
        statusEl.className = 'api-status err';
        statusEl.textContent = `❌  Server responded with status ${res.status}. Check your URL.`;
      }
    } catch (e) {
      statusEl.className = 'api-status err';
      statusEl.textContent = '❌  Cannot reach server. Check the URL and your internet connection.';
    }
  }

  return { load, save, bindUI, getResolution, getTheme, getApiUrl, applyTheme };

})();
