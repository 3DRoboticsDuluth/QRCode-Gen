// app.js
// Main logic: init Blockly, handle generate/compress/base64/QR, caching.

const genBtn = document.getElementById('genQR');
const saveBtn = document.getElementById('savePayload');
const loadBtn = document.getElementById('loadPayload');
const downloadBtn = document.getElementById('downloadPNG');
const jsonPreview = document.getElementById('jsonPreview');
const payloadArea = document.getElementById('payload');
const qrDiv = document.getElementById('qr');
const statusSpan = document.getElementById('status');
const savedList = document.getElementById('savedList');

localforage.config({ name: 'ftc-qr-gen' });

function setStatus(msg, timeout=2500){
  statusSpan.textContent = msg;
  if (timeout) setTimeout(()=>{ if(statusSpan.textContent===msg) statusSpan.textContent=''; }, timeout);
}

// Initialize Blockly workspace with our toolbox
const blocklyDiv = document.getElementById('blocklyDiv');
const toolboxXml = window.FTC_TOOLBOX_XML || document.getElementById('toolbox').outerHTML;

const workspace = Blockly.inject(blocklyDiv, {
  toolbox: toolboxXml,
  grid: { spacing: 20, length: 3, colour: '#ddd', snap: true },
  trashcan: true,
  zoom: { controls: true, wheel: true }
});

// Load default starter blocks
const starterXml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="intake_block" x="20" y="20"></block>
  <block type="deposit_block" x="20" y="120"></block>
  <block type="delay_block" x="20" y="240"></block>
</xml>`;
Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(starterXml), workspace);

// Utility: workspace -> JSON array (human readable)
function buildJsonFromWorkspace() {
  const arr = window.FTC_workspaceToJsonArray(workspace);
  return arr;
}

// Compression helpers
function utf8Encode(str){ return new TextEncoder().encode(str); }
function deflateBytes(u8){ return pako.deflate(u8, { level: 6 }); }
function base64FromUint8(u8) {
  let binary = '';
  for (let i=0;i<u8.length;i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

function base64ToUint8(b64) {
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// QR generation (qrcode-generator). Attempts Byte mode using raw bytes.
function makeQrFromBase64(b64) {
  qrDiv.innerHTML = '';
  const typeNumber = 0;
  const qr = qrcode(typeNumber, 'H'); // H = high error correction
  try {
    const raw = atob(b64);
    qr.addData(raw, 'Byte');
  } catch (e) {
    qr.addData(b64);
  }
  qr.make();
  // create image and show
  const imgTag = qr.createImgTag(4); // scale 4
  qrDiv.innerHTML = imgTag;
  // Provide payload textarea filled
  payloadArea.value = b64;
}

async function refreshSavedList() {
  const items = await localforage.getItem('saved_list') || [];
  savedList.innerHTML = '';
  items.slice().reverse().forEach((entry, idx) => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.style.flex = '1 1 auto';
    left.innerHTML = `<strong>${new Date(entry.ts).toLocaleString()}</strong><div style="color:#666;font-size:12px">${entry.summary}</div>`;
    const right = document.createElement('div');
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = async () => {
      // load entry
      const payload = entry.payload;
      payloadArea.value = payload;
      try {
        const arr = entry.json;
        jsonPreview.value = JSON.stringify(arr, null, 2);
        makeQrFromBase64(payload);
        setStatus('Loaded saved payload');
      } catch(e) { setStatus('Load failed'); console.error(e); }
    };
    const delBtn = document.createElement('button');
    delBtn.style.marginLeft = '8px';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      items.splice(items.indexOf(entry), 1);
      await localforage.setItem('saved_list', items);
      await refreshSavedList();
    };
    right.appendChild(loadBtn);
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);
    savedList.appendChild(li);
  });
}

genBtn.addEventListener('click', ()=>{
  try {
    const arr = buildJsonFromWorkspace();
    const jsonText = JSON.stringify(arr);
    jsonPreview.value = jsonText ? JSON.stringify(arr, null, 2) : '[]';

    // compress + base64
    const utf8 = utf8Encode(jsonText);
    const deflated = deflateBytes(utf8);
    const b64 = base64FromUint8(deflated);
    payloadArea.value = b64;
    makeQrFromBase64(b64);
    setStatus('QR generated ✔');
  } catch (err) {
    console.error(err);
    setStatus('Generate failed');
  }
});

saveBtn.addEventListener('click', async ()=>{
  try {
    const arr = buildJsonFromWorkspace();
    const jsonText = JSON.stringify(arr);
    const utf8 = utf8Encode(jsonText);
    const deflated = deflateBytes(utf8);
    const b64 = base64FromUint8(deflated);

    // store entry
    const items = await localforage.getItem('saved_list') || [];
    const entry = {
      ts: Date.now(),
      summary: arr.length + ' steps',
      json: arr,
      payload: b64
    };
    items.push(entry);
    await localforage.setItem('saved_list', items);
    await refreshSavedList();
    setStatus('Saved payload ✔');
  } catch (err) {
    console.error(err);
    setStatus('Save failed');
  }
});

loadBtn.addEventListener('click', async ()=>{
  try {
    const last = (await localforage.getItem('saved_list')) || [];
    if (!last.length) { setStatus('No saved payloads'); return; }
    const entry = last[last.length - 1];
    jsonPreview.value = JSON.stringify(entry.json, null, 2);
    payloadArea.value = entry.payload;
    makeQrFromBase64(entry.payload);
    setStatus('Loaded last saved');
  } catch (err) {
    console.error(err);
    setStatus('Load failed');
  }
});

// Download QR as PNG (render qrDiv's img into canvas)
downloadBtn.addEventListener('click', ()=>{
  try {
    const img = qrDiv.querySelector('img');
    if (!img) { setStatus('No QR to download'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ftc_qr_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus('PNG downloaded');
  } catch (err) {
    console.error(err);
    setStatus('Download failed');
  }
});

// On load, refresh saved list
refreshSavedList();

// Register service worker (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').then(function(reg){
      console.log('SW registered', reg);
    }).catch(function(err){ console.warn('SW reg failed', err); });
  });
}
