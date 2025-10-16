// Compatibility shim: Blockly v12 deprecated Workspace.getAllVariables; map it to the new API
if (Blockly && Blockly.Workspace && typeof Blockly.Workspace.prototype.getAllVariables !== 'function') {
  try {
    Blockly.Workspace.prototype.getAllVariables = function() {
      // Prefer getVariableMap if available
      if (typeof this.getVariableMap === 'function' && this.getVariableMap()) {
        try { return this.getVariableMap().getAllVariables(); } catch (e) { /* fallback below */ }
      }
      // Fallback to returning empty array to avoid breaking callers
      return [];
    };
    console.info('Applied compatibility shim: Workspace.getAllVariables -> getVariableMap().getAllVariables()');
  } catch (e) {
    // ignore silently if we can't patch
  }
}

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: document.getElementById('toolbox'),
  trashcan: true,
  scrollbars: true
});

// Ensure Start block exists
function ensureStartBlock() {
  if (!workspace.getAllBlocks(false).some(b => b.type === 'start')) {
    const startBlock = workspace.newBlock('start');
    workspace.addTopBlock(startBlock);
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(50, 50);
  }
}
workspace.addChangeListener(() => ensureStartBlock());

// Utility to dynamically load a script
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve(url);
    s.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

// Ensure kjua is available; try multiple CDNs if necessary
async function ensureKjua() {
  if (typeof kjua === 'function') return;
  const sources = [
    'https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/kjua/0.1.1/kjua.min.js',
    'https://unpkg.com/kjua@0.1.1/kjua.min.js'
  ];
  for (const src of sources) {
    try {
      await loadScript(src);
      if (typeof kjua === 'function') return;
    } catch (e) {
      // try next source
      console.warn('Failed to load kjua from', src, e && e.message ? e.message : e);
    }
  }
  throw new Error('kjua library could not be loaded from any CDN');
}

// Generate QR (tries to load kjua dynamically if missing)
document.getElementById('generateBtn').addEventListener('click', async () => {
  const plan = generatePlanJSON();
  if (!plan.length) return;

  const b64 = compressAndEncode(plan);
  document.getElementById('info').textContent = `Plan steps: ${plan.length} | Data length: ${b64.length}`;
  warnIfLargePayload(b64);

  const qrContainer = document.getElementById('qr');
  qrContainer.innerHTML = '';

  try {
    await ensureKjua();
    const qr = kjua({ render: 'svg', text: b64, size: 400, ecLevel: 'H' });
    qrContainer.appendChild(qr);
  } catch (e) {
    // Try an image-based QR API as a fallback (works if the device has internet).
    // Note: very large payloads may exceed URL length limits and fail.
    document.getElementById('info').textContent += ' | kjua missing: trying public QR image API...';
    console.warn('kjua is not available. Attempting image-based QR fallback.', e);

    try {
      // Use api.qrserver.com which accepts larger payloads than some other services
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(b64);
      const img = document.createElement('img');
      img.alt = 'QR code';
      img.src = qrUrl;
      img.style.maxWidth = '100%';
      img.onload = () => {
        qrContainer.appendChild(img);
        document.getElementById('info').textContent = `Plan steps: ${plan.length} | Data length: ${b64.length} | QR from image API`;
      };
      img.onerror = () => {
        // If image fails (likely due to payload length or network), fall back to raw payload
        console.warn('Image-based QR API failed, falling back to payload view.');
        document.getElementById('info').textContent += ' | Error: QR image API failed. Showing payload below.';
        const pre = document.createElement('pre');
        pre.textContent = b64;
        qrContainer.appendChild(pre);
        const a = document.createElement('a');
        a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(b64);
        a.download = 'qr_payload.txt';
        a.textContent = 'Download payload';
        a.style.display = 'block';
        a.style.marginTop = '8px';
        qrContainer.appendChild(a);
      };
      qrContainer.appendChild(img);
    } catch (imgErr) {
      console.error('Image fallback failed', imgErr);
      document.getElementById('info').textContent += ' | Error: QR library (kjua) not available. Showing payload below.';
      const pre = document.createElement('pre');
      pre.textContent = b64;
      qrContainer.appendChild(pre);
      const a = document.createElement('a');
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(b64);
      a.download = 'qr_payload.txt';
      a.textContent = 'Download payload';
      a.style.display = 'block';
      a.style.marginTop = '8px';
      qrContainer.appendChild(a);
    }
  }

  localStorage.setItem('last_qr_payload', b64);
});

// Create a self-contained bundle in the browser (no console or shell required)
document.getElementById('bundleBtn').addEventListener('click', async () => {
  const info = document.getElementById('info');
  info.textContent = 'Building bundle...';

  // Read index.html
  const resp = await fetch(location.pathname);
  let html = await resp.text();

  // Helper to fetch a script by src (try relative first, then CDN)
  async function fetchScript(src) {
    try {
      const r = await fetch(src);
      if (!r.ok) throw new Error('bad');
      return await r.text();
    } catch (e) {
      // try absolute URL if src is relative
      try {
        const abs = new URL(src, location.href).href;
        const r2 = await fetch(abs);
        if (!r2.ok) throw new Error('bad2');
        return await r2.text();
      } catch (e2) { return null; }
    }
  }

  // Inline known script tags (blockly, pako, kjua, blocks_custom.js, app.js)
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  let match; const inlines = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    info.textContent = 'Inlining ' + src;
    let content = null;
    // try relative path first
    try { content = await fetchScript(src); } catch(e) { content = null; }
    if (!content) {
      // As a fallback, try the exact CDN URLs we used earlier
      if (src.includes('blockly')) content = await fetchScript('https://unpkg.com/blockly/blockly.min.js');
      if (src.includes('pako')) content = await fetchScript('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');
      if (src.includes('kjua')) content = await fetchScript('https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js');
    }
    if (content) {
      const inlineTag = `<script>\n/* inlined ${src} */\n${content}\n<\/script>`;
      html = html.replace(match[0], inlineTag);
    } else {
      // leave the original tag (CDN will be attempted when opened)
    }
  }

  // Inline CSS link tags
  const cssRegex = /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi;
  while ((match = cssRegex.exec(html)) !== null) {
    const href = match[1];
    info.textContent = 'Inlining ' + href;
    try {
      const r = await fetch(href);
      if (r.ok) {
        const css = await r.text();
        const inline = `<style>\n/* inlined ${href} */\n${css}\n</style>`;
        html = html.replace(match[0], inline);
      }
    } catch (e) { /* ignore */ }
  }

  // Trigger download of the built HTML
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bundle.html'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  info.textContent = 'Bundle downloaded (bundle.html). Copy this file to devices.';
});

// Clear workspace
document.getElementById('clearBtn').addEventListener('click', () => {
  workspace.getAllBlocks(false).forEach(b => b.dispose(true));
  localStorage.removeItem('last_qr_payload');
  document.getElementById('qr').innerHTML = '';
  document.getElementById('info').textContent = '';
  ensureStartBlock();
});

// Safe traverse starting from Start block
function generatePlanJSON() {
  const startBlock = workspace.getTopBlocks(true).find(b => b.type === 'start');
  if (!startBlock) return [];

  const plan = [];
  // Ensure the JavaScript code generator is initialized for this workspace.
  // Without this, calling Blockly.JavaScript.blockToCode will throw:
  // "CodeGenerator init was not called before blockToCode was called."
  if (Blockly && Blockly.JavaScript && typeof Blockly.JavaScript.init === 'function') {
    try {
      Blockly.JavaScript.init(workspace);
    } catch (e) {
      // ignore init errors and continue; blockToCode will throw if still uninitialized
      console.warn('Blockly.JavaScript.init() failed:', e);
    }
  }

  let current = startBlock.getNextBlock();

  while (current) {
    // If a generator function exists for this block type, use it. Otherwise log a clearer warning
    // and use the fallback serialization so generation can continue.
    const genFn = Blockly && Blockly.JavaScript && Blockly.JavaScript[current.type];
    if (typeof genFn === 'function') {
      // Call the registered generator directly. Our generators return JSON strings.
      try {
        let code = genFn(current);
        if (Array.isArray(code)) code = code[0];
        if (code && code !== 'undefined') {
          plan.push(code);
        } else {
          console.warn('Generator returned empty/undefined for', current.type);
        }
      } catch (e) {
        console.warn('Direct generator call threw for', current.type, e && e.message ? e.message : e);
        // Attempt previous fallback serialization
        try {
          let direct = genFn(current);
          if (Array.isArray(direct)) direct = direct[0];
          if (direct && direct !== 'undefined') {
            plan.push(direct);
            console.info('Fallback: used direct generator call for', current.type);
          }
        } catch (dErr) {
          console.warn('Direct generator call failed for', current.type, dErr && dErr.message ? dErr.message : dErr);
        }
      }
    } else {
      // No generator found for this block type
      const available = Object.keys(Blockly && Blockly.JavaScript ? Blockly.JavaScript : {}).filter(k => typeof Blockly.JavaScript[k] === 'function');
      console.warn('No code generator found for block type:', current.type, '| Available generators:', available.join(', '));

      // Fallback serialization: capture named field values into a JSON entry
      try {
        const fields = {};
        if (current.inputList && current.inputList.length) {
          current.inputList.forEach(input => {
            if (!input.fieldRow) return;
            input.fieldRow.forEach(field => {
              if (field && field.name) {
                try { fields[field.name] = current.getFieldValue(field.name); } catch (_) { /* ignore */ }
              }
            });
          });
        }
        if (Object.keys(fields).length) {
          plan.push(JSON.stringify(Object.assign({cmd: current.type}, fields)));
        } else {
          plan.push(JSON.stringify({cmd: current.type}));
        }
      } catch (serr) {
        console.warn('Fallback serialization failed for', current.type, serr);
      }
    }
    current = current.getNextBlock();
  }

  // Finish the generator so any post-processing occurs and internal state is cleaned up
  if (Blockly && Blockly.JavaScript && typeof Blockly.JavaScript.finish === 'function') {
    try { Blockly.JavaScript.finish(workspace); } catch (e) { /* ignore */ }
  }

  return plan;
}

// Compress + Base64 encode
function compressAndEncode(plan) {
  const json = JSON.stringify(plan);
  const gzip = pako.gzip(json);
  let binary = '';
  for (let i = 0; i < gzip.length; i++) binary += String.fromCharCode(gzip[i]);
  return btoa(binary);
}

// Service worker
// Service worker (register only on secure origin or localhost)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
}

// Warn when payload is likely too large for a single QR code (heuristic)
function warnIfLargePayload(b64) {
  // QR capacity varies by version and error correction; ~1200 chars is a conservative practical limit
  if (b64.length > 1200) {
    document.getElementById('info').textContent += ' | Warning: payload may be too large for a single QR code (consider splitting).';
    console.warn('Payload length', b64.length, 'may exceed single QR capacity');
  }
}
