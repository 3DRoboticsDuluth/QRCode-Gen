// ============================
// Inject Blockly workspace
// ============================
const workspace = Blockly.inject('blocklyDiv', {
  toolbox: document.getElementById('toolbox'),
  trashcan: true,
  scrollbars: true
});

// ============================
// Ensure Start block exists safely
// ============================
function ensureStartBlock() {
  // Only add Start block if none exists and workspace is ready
  if (!workspace.getAllBlocks(false).some(b => b.type === 'start')) {
    const startBlock = workspace.newBlock('start');
    workspace.addTopBlock(startBlock); // mark as top-level
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(50, 50);
  }
}

// Delay insertion until workspace fully initializes
setTimeout(() => ensureStartBlock(), 100);

// ============================
// Generate QR button
// ============================
document.getElementById('generateBtn').addEventListener('click', () => {
  const plan = generatePlanJSON();
  if (!plan.length) return;

  const b64 = compressAndEncode(plan);
  document.getElementById('info').textContent = `Plan steps: ${plan.length} | Data length: ${b64.length}`;

  const qrContainer = document.getElementById('qr');
  qrContainer.innerHTML = '';
  const qr = kjua({ render: 'svg', text: b64, size: 400, ecLevel: 'H' });
  qrContainer.appendChild(qr);

  localStorage.setItem('last_qr_payload', b64);
});

// ============================
// Clear workspace button
// ============================
document.getElementById('clearBtn').addEventListener('click', () => {
  // Dispose all blocks safely
  workspace.getAllBlocks(false).forEach(b => b.dispose(true));

  localStorage.removeItem('last_qr_payload');
  document.getElementById('qr').innerHTML = '';
  document.getElementById('info').textContent = '';

  // Re-add Start block safely
  ensureStartBlock();
});

// ============================
// Helpers
// ============================

// Generate JSON plan from blocks
function generatePlanJSON() {
  const startBlock = workspace.getTopBlocks(true).find(b => b.type === 'start');
  if (!startBlock) return [];
  const code = Blockly.JavaScript.blockToCode(startBlock);
  try {
    return JSON.parse(code);
  } catch (e) {
    console.error("Failed to parse plan JSON", e, code);
    alert("Error parsing blocks into JSON!");
    return [];
  }
}

// Compress plan JSON and encode as Base64
function compressAndEncode(plan) {
  const json = JSON.stringify(plan);
  const gzip = pako.gzip(json);
  let binary = '';
  for (let i = 0; i < gzip.length; i++) binary += String.fromCharCode(gzip[i]);
  return btoa(binary);
}

// ============================
// Service Worker for Offline
// ============================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
