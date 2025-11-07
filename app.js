// Compatibility shim: Blockly v12 deprecated Workspace.getAllVariables
if (Blockly && Blockly.Workspace && typeof Blockly.Workspace.prototype.getAllVariables !== 'function') {
  try {
    Blockly.Workspace.prototype.getAllVariables = function() {
      if (typeof this.getVariableMap === 'function' && this.getVariableMap()) {
        try { return this.getVariableMap().getAllVariables(); } catch (e) { }
      }
      return [];
    };
    console.info('Applied compatibility shim: Workspace.getAllVariables');
  } catch (e) { }
}

// Pedro Pathing Constants (placeholder - can be tuned)
const PEDRO_CONSTANTS = {
  xMovementVelocity: 30, // inches/sec
  yMovementVelocity: 30,
  turnVelocity: 90, // degrees/sec (converted to rad/sec in calcs)
  
  // Action times (seconds)
  intakeTime: 1.5,
  depositTime: 2.0,
  releaseGateTime: 1.0
};

// Initialize Blockly workspace
const workspace = Blockly.inject('blocklyDiv', {
  toolbox: document.getElementById('toolbox'),
  trashcan: true,
  scrollbars: true,
  zoom: { controls: true, wheel: true, startScale: 0.9 }
});

// Canvas setup for path visualization
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const FIELD_SIZE = 600;
const TILE_WIDTH = 23.5;
const FIELD_HALF = 72; // inches

let fieldImage = new Image();
let robotImage = new Image();
let imageLoaded = false;
let robotImageLoaded = false;
let currentPath = [];
let startPos = null;
let currentAlliance = 'RED';
let currentSide = 'NORTH';

// Animation state
let animationRunning = false;
let animationProgress = 0; // 0 to 1
let animationStartTime = 0;
let totalPathTime = 0;
let pathSegments = []; // {start, end, duration, type}

// Load field image
fieldImage.onload = function() {
  imageLoaded = true;
  updateVisualization();
};
fieldImage.onerror = function() {
  imageLoaded = false;
  updateVisualization();
};
fieldImage.src = 'FTC Field.jpg';

// Load robot image
robotImage.onload = function() {
  robotImageLoaded = true;
  updateVisualization();
};
robotImage.onerror = function() {
  robotImageLoaded = false;
  updateVisualization();
};
robotImage.src = 'robot.png';

// Start positions
const START_POSITIONS = {
  RED_NORTH: { 
    x: 2 * TILE_WIDTH,
    y: -1 * 2.75 * TILE_WIDTH,
    heading: 0 
  },
  RED_SOUTH: { 
    x: -3 * TILE_WIDTH,
    y: -1 * 0.5 * TILE_WIDTH,
    heading: 0 
  },
  BLUE_NORTH: { 
    x: 2 * TILE_WIDTH,
    y: 1 * 2.75 * TILE_WIDTH,
    heading: 0 
  },
  BLUE_SOUTH: { 
    x: -3 * TILE_WIDTH,
    y: 1 * 0.5 * TILE_WIDTH,
    heading: 0 
  }
};

// Named poses from NavSubsystem with alliance sign logic
function getAllianceSign() {
  return currentAlliance === 'RED' ? -1 : 1;
}

const NAMED_POSES = {
  spike_near: () => ({
    x: -1.5 * TILE_WIDTH,
    y: getAllianceSign() * 1.5 * TILE_WIDTH,
    heading: getAllianceSign() * 90 * Math.PI / 180
  }),
  spike_middle: () => ({
    x: -0.5 * TILE_WIDTH,
    y: getAllianceSign() * 1.5 * TILE_WIDTH,
    heading: getAllianceSign() * 90 * Math.PI / 180
  }),
  spike_far: () => ({
    x: 0.5 * TILE_WIDTH,
    y: getAllianceSign() * 1.5 * TILE_WIDTH,
    heading: getAllianceSign() * 90 * Math.PI / 180
  }),
  loading_zone: () => ({
    x: -2.5 * TILE_WIDTH,
    y: getAllianceSign() * -2.5 * TILE_WIDTH,
    heading: getAllianceSign() * 90 * Math.PI / 180
  }),
  launch_near: () => ({
    x: 0.5 * TILE_WIDTH,
    y: getAllianceSign() * 0.5 * TILE_WIDTH,
    heading: getAllianceSign() * 45 * Math.PI / 180
  }),
  launch_far: () => ({
    x: -2.5 * TILE_WIDTH,
    y: getAllianceSign() * -0.5 * TILE_WIDTH,
    heading: getAllianceSign() * 30 * Math.PI / 180
  }),
  gate: () => ({
    x: 0 * TILE_WIDTH,
    y: getAllianceSign() * 2 * TILE_WIDTH,
    heading: getAllianceSign() * -90 * Math.PI / 180
  }),
  base: () => ({
    x: -2 * TILE_WIDTH,
    y: getAllianceSign() * -1.4 * TILE_WIDTH,
    heading: getAllianceSign() * 180 * Math.PI / 180
  })
};

// Convert Pedro coordinates to canvas pixels
function pedroToCanvas(x, y) {
  return {
    x: (x + FIELD_HALF) * (FIELD_SIZE / (FIELD_HALF * 2)),
    y: (FIELD_HALF - y) * (FIELD_SIZE / (FIELD_HALF * 2))
  };
}

// Calculate time to move between two poses
function calculateMoveTime(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Heading difference
  let dHeading = to.heading - from.heading;
  while (dHeading > Math.PI) dHeading -= 2 * Math.PI;
  while (dHeading < -Math.PI) dHeading += 2 * Math.PI;
  const turnAmount = Math.abs(dHeading) * 180 / Math.PI;
  
  // Time for linear movement
  const linearTime = distance / Math.sqrt(
    PEDRO_CONSTANTS.xMovementVelocity ** 2 + 
    PEDRO_CONSTANTS.yMovementVelocity ** 2
  );
  
  // Time for turn
  const turnTime = turnAmount / PEDRO_CONSTANTS.turnVelocity;
  
  // Return max (simultaneous movement)
  return Math.max(linearTime, turnTime);
}

// Calculate path segments with timing
function calculatePathSegments() {
  if (!startPos || currentPath.length === 0) {
    pathSegments = [];
    totalPathTime = 0;
    return;
  }
  
  const segments = [];
  let currentPose = { ...startPos };
  let cumulativeTime = 0;
  
  currentPath.forEach((wp, idx) => {
    // Movement segment
    const moveTime = calculateMoveTime(currentPose, wp);
    segments.push({
      startPose: { ...currentPose },
      endPose: { x: wp.x, y: wp.y, heading: wp.heading },
      startTime: cumulativeTime,
      duration: moveTime,
      type: 'move',
      label: wp.label
    });
    cumulativeTime += moveTime;
    
    // Action segment
    let actionTime = 0;
    if (wp.type === 'intake') {
      actionTime = PEDRO_CONSTANTS.intakeTime;
    } else if (wp.type === 'deposit') {
      actionTime = PEDRO_CONSTANTS.depositTime;
    } else if (wp.type === 'action') {
      actionTime = PEDRO_CONSTANTS.releaseGateTime;
    }
    
    if (actionTime > 0) {
      segments.push({
        startPose: { x: wp.x, y: wp.y, heading: wp.heading },
        endPose: { x: wp.x, y: wp.y, heading: wp.heading },
        startTime: cumulativeTime,
        duration: actionTime,
        type: 'action',
        actionType: wp.type,
        label: wp.label
      });
      cumulativeTime += actionTime;
    }
    
    currentPose = { x: wp.x, y: wp.y, heading: wp.heading };
  });
  
  pathSegments = segments;
  totalPathTime = cumulativeTime;
  updateTimerDisplay();
}

// Get robot pose at a given time
function getRobotPoseAtTime(time) {
  if (pathSegments.length === 0) return null;
  
  for (const seg of pathSegments) {
    if (time >= seg.startTime && time < seg.startTime + seg.duration) {
      const t = (time - seg.startTime) / seg.duration;
      
      if (seg.type === 'action') {
        return { ...seg.startPose };
      }
      
      // Interpolate position
      const x = seg.startPose.x + (seg.endPose.x - seg.startPose.x) * t;
      const y = seg.startPose.y + (seg.endPose.y - seg.startPose.y) * t;
      
      // Interpolate heading
      let dh = seg.endPose.heading - seg.startPose.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      const heading = seg.startPose.heading + dh * t;
      
      return { x, y, heading };
    }
  }
  
  // Past end of path
  if (time >= totalPathTime && pathSegments.length > 0) {
    const lastSeg = pathSegments[pathSegments.length - 1];
    return { ...lastSeg.endPose };
  }
  
  return { ...startPos };
}

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

// Update visualization when blocks or alliance changes
workspace.addChangeListener(() => {
  ensureStartBlock();
  updateVisualization();
});

document.getElementById('alliance').addEventListener('change', (e) => {
  currentAlliance = e.target.value;
  updateVisualization();
});

document.getElementById('side').addEventListener('change', (e) => {
  currentSide = e.target.value;
  updateVisualization();
});

function updateVisualization() {
  const alliance = document.getElementById('alliance').value;
  const side = document.getElementById('side').value;
  currentAlliance = alliance;
  currentSide = side;
  
  const key = `${alliance}_${side}`;
  startPos = { ...START_POSITIONS[key] };
  startPos.heading = startPos.heading * Math.PI / 180;

  currentPath = extractPathFromBlocks();
  calculatePathSegments();
  updateWaypointsList();
  renderField();
}

function extractPathFromBlocks() {
  const path = [];
  const startBlock = workspace.getTopBlocks(true).find(b => b.type === 'start');
  if (!startBlock) return path;

  let current = startBlock.getNextBlock();
  while (current) {
    let waypoint = null;
    
    if (current.type === 'drive_to') {
      const mode = current.getFieldValue('mode');
      let x, y, heading;
      
      if (mode === 'tiles') {
        const tileX = Number(current.getFieldValue('tile_x')) || 0;
        const tileY = Number(current.getFieldValue('tile_y')) || 0;
        x = tileX * TILE_WIDTH;
        y = tileY * TILE_WIDTH;
        heading = (Number(current.getFieldValue('heading_tiles')) || 0) * Math.PI / 180;
      } else {
        x = Number(current.getFieldValue('x')) || 0;
        y = Number(current.getFieldValue('y')) || 0;
        heading = (Number(current.getFieldValue('heading_coords')) || 0) * Math.PI / 180;
      }
      
      waypoint = { x, y, heading, type: 'drive', label: 'Drive' };
    }
    
    else if (current.type === 'deposit_tile') {
      const tileX = Number(current.getFieldValue('tile_x')) || 0;
      const tileY = Number(current.getFieldValue('tile_y')) || 0;
      const heading = (Number(current.getFieldValue('heading')) || 0) * Math.PI / 180;
      waypoint = { 
        x: tileX * TILE_WIDTH, 
        y: tileY * TILE_WIDTH, 
        heading, 
        type: 'deposit',
        label: 'Deposit'
      };
    }
    
    else if (current.type === 'deposit_near_far') {
      const where = current.getFieldValue('where');
      const pose = where === 'near' ? NAMED_POSES.launch_near() : NAMED_POSES.launch_far();
      waypoint = {
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        type: 'deposit',
        label: `Deposit ${where}`
      };
    }
    
    else if (current.type === 'intake_row') {
      const row = Number(current.getFieldValue('row')) || 0;
      let pose;
      
      if (row === 0) {
        pose = NAMED_POSES.loading_zone();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Human Intake'
        };
      } else if (row === 1) {
        pose = NAMED_POSES.spike_near();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Near'
        };
      } else if (row === 2) {
        pose = NAMED_POSES.spike_middle();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Mid'
        };
      } else if (row === 3) {
        pose = NAMED_POSES.spike_far();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Far'
        };
      }
    }
    
    else if (current.type === 'intake_human') {
      const pose = NAMED_POSES.loading_zone();
      waypoint = {
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        type: 'intake',
        label: 'Human Intake'
      };
    }
    
    else if (current.type === 'release_gate') {
      const pose = NAMED_POSES.gate();
      waypoint = {
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        type: 'action',
        label: 'Release Gate'
      };
    }
    
    if (waypoint) {
      path.push(waypoint);
    }
    
    current = current.getNextBlock();
  }
  
  return path;
}

function updateWaypointsList() {
  const list = document.getElementById('waypoints-list');
  
  if (currentPath.length === 0) {
    list.innerHTML = '<div class="info-text">No waypoints. Add blocks to see path.</div>';
    return;
  }
  
  let html = '';
  let cumulativeTime = 0;
  let currentPose = { ...startPos };
  
  currentPath.forEach((wp, idx) => {
    let icon = '🚗';
    if (wp.type === 'deposit') icon = '📦';
    else if (wp.type === 'intake') icon = '⬇️';
    else if (wp.type === 'action') icon = '⚙️';
    
    const moveTime = calculateMoveTime(currentPose, wp);
    cumulativeTime += moveTime;
    
    let actionTime = 0;
    if (wp.type === 'intake') actionTime = PEDRO_CONSTANTS.intakeTime;
    else if (wp.type === 'deposit') actionTime = PEDRO_CONSTANTS.depositTime;
    else if (wp.type === 'action') actionTime = PEDRO_CONSTANTS.releaseGateTime;
    
    cumulativeTime += actionTime;
    
    const heading = Math.round(wp.heading * 180 / Math.PI);
    html += `<div class="waypoint-item">${idx + 1}. ${icon} ${wp.label} @ ${cumulativeTime.toFixed(1)}s</div>`;
    
    currentPose = { x: wp.x, y: wp.y, heading: wp.heading };
  });
  
  list.innerHTML = html;
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('timer-display');
  const remaining = 30 - totalPathTime;
  
  if (remaining < 0) {
    timerEl.textContent = `⏱️ ${totalPathTime.toFixed(1)}s (${Math.abs(remaining).toFixed(1)}s OVER)`;
    timerEl.style.color = '#f94144';
  } else {
    timerEl.textContent = `⏱️ ${totalPathTime.toFixed(1)}s / 30s (${remaining.toFixed(1)}s left)`;
    timerEl.style.color = remaining < 5 ? '#f9c74f' : '#43aa8b';
  }
}

function renderField() {
  ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);

  // Draw field background
  if (imageLoaded) {
    ctx.save();
    ctx.translate(FIELD_SIZE / 2, FIELD_SIZE / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-FIELD_SIZE / 2, -FIELD_SIZE / 2);
    ctx.drawImage(fieldImage, 0, 0, FIELD_SIZE, FIELD_SIZE);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(FIELD_SIZE / 2, FIELD_SIZE / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-FIELD_SIZE / 2, -FIELD_SIZE / 2);
    
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);
    
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    const gridSize = FIELD_SIZE / 6;
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * gridSize, 0);
      ctx.lineTo(i * gridSize, FIELD_SIZE);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * gridSize);
      ctx.lineTo(FIELD_SIZE, i * gridSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw path
  if (currentPath.length > 0 && startPos) {
    ctx.strokeStyle = 'rgba(249, 199, 79, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    
    const start = pedroToCanvas(startPos.x, startPos.y);
    ctx.moveTo(start.x, start.y);
    
    currentPath.forEach(wp => {
      const pos = pedroToCanvas(wp.x, wp.y);
      ctx.lineTo(pos.x, pos.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waypoints
    currentPath.forEach((wp, idx) => {
      const pos = pedroToCanvas(wp.x, wp.y);
      
      if (wp.type === 'deposit') {
        ctx.fillStyle = '#277da1';
      } else if (wp.type === 'intake') {
        ctx.fillStyle = '#f94144';
      } else if (wp.type === 'action') {
        ctx.fillStyle = '#b5179e';
      } else {
        ctx.fillStyle = '#43aa8b';
      }
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-wp.heading);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -15);
      ctx.stroke();
      ctx.restore();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(idx + 1, pos.x + 10, pos.y - 10);
    });
  }

  // Draw robot
  let robotPose = startPos;
  if (animationRunning && pathSegments.length > 0) {
    const elapsed = (Date.now() - animationStartTime) / 1000;
    robotPose = getRobotPoseAtTime(elapsed) || startPos;
    
    if (elapsed >= totalPathTime) {
      stopAnimation();
    }
  }
  
  if (robotPose) {
    const pos = pedroToCanvas(robotPose.x, robotPose.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(-robotPose.heading);
    
    // Robot size: 18" x 18" in field coordinates
    const robotSizeInches = 18;
    const robotSizePixels = robotSizeInches * (FIELD_SIZE / (FIELD_HALF * 2));
    
    if (robotImageLoaded) {
      ctx.drawImage(robotImage, -robotSizePixels/2, -robotSizePixels/2, robotSizePixels, robotSizePixels);
    } else {
      // Fallback robot (18" x 18")
      const halfSize = robotSizePixels / 2;
      ctx.fillStyle = 'rgba(67, 170, 139, 0.8)';
      ctx.fillRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
      
      // Direction indicator
      ctx.fillStyle = '#f9c74f';
      ctx.beginPath();
      ctx.moveTo(0, -halfSize);
      ctx.lineTo(-halfSize * 0.4, -halfSize * 1.3);
      ctx.lineTo(halfSize * 0.4, -halfSize * 1.3);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Animation controls
document.getElementById('playBtn').addEventListener('click', () => {
  if (pathSegments.length === 0) return;
  
  if (animationRunning) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  stopAnimation();
  renderField();
});

function startAnimation() {
  animationRunning = true;
  animationStartTime = Date.now();
  document.getElementById('playBtn').textContent = '⏸️ Pause';
  animate();
}

function stopAnimation() {
  animationRunning = false;
  document.getElementById('playBtn').textContent = '▶️ Play';
}

function animate() {
  if (!animationRunning) return;
  
  renderField();
  requestAnimationFrame(animate);
}

// Utility functions
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
      console.warn('Failed to load kjua from', src);
    }
  }
  throw new Error('kjua library could not be loaded from any CDN');
}

// Generate QR
document.getElementById('generateBtn').addEventListener('click', async () => {
  const plan = generatePlanJSON();
  if (!plan.length) {
    document.getElementById('info').textContent = 'Add blocks to generate QR';
    return;
  }

  const b64 = compressAndEncode(plan);
  document.getElementById('info').textContent = `Steps: ${plan.length} | Size: ${b64.length} chars`;

  const qrContainer = document.getElementById('qr');
  qrContainer.innerHTML = '';

  try {
    await ensureKjua();
    const qr = kjua({ render: 'svg', text: b64, size: 250, ecLevel: 'H' });
    qrContainer.appendChild(qr);
  } catch (e) {
    console.warn('kjua not available, trying image API', e);
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(b64);
    const img = document.createElement('img');
    img.alt = 'QR code';
    img.src = qrUrl;
    qrContainer.appendChild(img);
  }

  localStorage.setItem('last_qr_payload', b64);
});

// Bundle creation
document.getElementById('bundleBtn').addEventListener('click', async () => {
  const info = document.getElementById('info');
  info.textContent = 'Building bundle...';

  const resp = await fetch(location.pathname);
  let html = await resp.text();

  async function fetchScript(src) {
    try {
      const r = await fetch(src);
      if (!r.ok) throw new Error('bad');
      return await r.text();
    } catch (e) {
      try {
        const abs = new URL(src, location.href).href;
        const r2 = await fetch(abs);
        if (!r2.ok) throw new Error('bad2');
        return await r2.text();
      } catch (e2) { return null; }
    }
  }

  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    info.textContent = 'Inlining ' + src;
    let content = null;
    try { content = await fetchScript(src); } catch(e) { content = null; }
    if (!content) {
      if (src.includes('blockly')) content = await fetchScript('https://unpkg.com/blockly/blockly.min.js');
      if (src.includes('pako')) content = await fetchScript('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');
      if (src.includes('kjua')) content = await fetchScript('https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js');
    }
    if (content) {
      const inlineTag = `<script>\n/* inlined ${src} */\n${content}\n<\/script>`;
      html = html.replace(match[0], inlineTag);
    }
  }

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
    } catch (e) { }
  }

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bundle.html'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  info.textContent = 'Bundle downloaded!';
});

// Clear workspace
document.getElementById('clearBtn').addEventListener('click', () => {
  workspace.getAllBlocks(false).forEach(b => b.dispose(true));
  localStorage.removeItem('last_qr_payload');
  document.getElementById('qr').innerHTML = '';
  document.getElementById('info').textContent = '';
  stopAnimation();
  ensureStartBlock();
  updateVisualization();
});

// Generate plan JSON - returns array of objects
function generatePlanJSON() {
  const startBlock = workspace.getTopBlocks(true).find(b => b.type === 'start');
  if (!startBlock) return [];

  const plan = [];
  if (Blockly && Blockly.JavaScript && typeof Blockly.JavaScript.init === 'function') {
    try {
      Blockly.JavaScript.init(workspace);
    } catch (e) {
      console.warn('Blockly.JavaScript.init() failed:', e);
    }
  }

  let current = startBlock.getNextBlock();
  while (current) {
    const genFn = Blockly && Blockly.JavaScript && Blockly.JavaScript[current.type];
    if (typeof genFn === 'function') {
      try {
        let code = genFn(current);
        if (Array.isArray(code)) code = code[0];
        if (code && code !== 'undefined') {
          try {
            const obj = JSON.parse(code);
            plan.push(obj);
          } catch (parseErr) {
            console.warn('Failed to parse JSON for', current.type, ':', code);
            plan.push({cmd: current.type, error: 'parse_failed'});
          }
        }
      } catch (e) {
        console.warn('Generator error for', current.type, e);
      }
    }
    current = current.getNextBlock();
  }

  if (Blockly && Blockly.JavaScript && typeof Blockly.JavaScript.finish === 'function') {
    try { Blockly.JavaScript.finish(workspace); } catch (e) { }
  }

  return plan;
}

// Compress and encode
function compressAndEncode(plan) {
  const json = JSON.stringify(plan);
  const gzip = pako.gzip(json);
  let binary = '';
  for (let i = 0; i < gzip.length; i++) binary += String.fromCharCode(gzip[i]);
  return btoa(binary);
}

// Service worker
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  try { navigator.serviceWorker.register('sw.js'); } catch (e) { }
}

// Initial setup
ensureStartBlock();
updateVisualization();