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

// ============================================================================
// MOBILE OPTIMIZATIONS
// ============================================================================

// Better localStorage error handling for mobile browsers
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('localStorage not available:', e);
    return false;
  }
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage not available:', e);
    return null;
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('localStorage not available:', e);
    return false;
  }
}

// Prevent pinch zoom on iOS
document.addEventListener('gesturestart', function(e) {
  e.preventDefault();
});

document.addEventListener('gesturechange', function(e) {
  e.preventDefault();
});

document.addEventListener('gestureend', function(e) {
  e.preventDefault();
});

// ============================================================================
// PEDRO PATHING CONSTANTS
// ============================================================================

const PEDRO_CONSTANTS = {
  xMovementVelocity: 30,
  yMovementVelocity: 30,
  turnVelocity: 90,
  intakeTime: 1.5,
  depositTime: 2.0,
  releaseGateTime: 1.0,
  robotLength: 14,
  robotWidth: 14
};

// ============================================================================
// AXIAL AND LATERAL OFFSET SUPPORT
// ============================================================================

const Axial = {
  FRONT: 1,
  CENTER: 0,
  BACK: -1
};

const Lateral = {
  LEFT: 1,
  CENTER: 0,
  RIGHT: -1
};

function normalizeHeading(heading) {
  while (heading > Math.PI) heading -= 2 * Math.PI;
  while (heading < -Math.PI) heading += 2 * Math.PI;
  return heading;
}

function applyOffsets(x, y, heading, axial = Axial.CENTER, lateral = Lateral.CENTER, axialOffset = 0, lateralOffset = 0) {
  let newX = x;
  let newY = y;
  
  // Apply axial offset (forward/backward relative to robot heading)
  const axialHeading = normalizeHeading(heading);
  const totalAxialOffset = axialOffset - (axial * PEDRO_CONSTANTS.robotLength / 2);
  newX += Math.cos(axialHeading) * totalAxialOffset;
  newY += Math.sin(axialHeading) * totalAxialOffset;
  
  // Apply lateral offset (left/right relative to robot heading)
  const lateralHeading = normalizeHeading(heading + Math.PI / 2);
  const totalLateralOffset = lateralOffset - (lateral * PEDRO_CONSTANTS.robotWidth / 2);
  newX += Math.cos(lateralHeading) * totalLateralOffset;
  newY += Math.sin(lateralHeading) * totalLateralOffset;
  
  return { x: newX, y: newY, heading };
}

// ============================================================================
// BLOCKLY WORKSPACE SETUP
// ============================================================================

const myTheme = Blockly.Theme.defineTheme('customTheme', {
  base: Blockly.Themes.Classic,
  blockStyles: {},
  categoryStyles: {
    start_category: {
      colour: '#f9c74f',
      labelColour: '#000000',
    },
    actions_category: {
      colour: '#5C68A6',
      labelColour: '#000000',
    }
  },
  componentStyles: {
    workspaceBackgroundColour: '#ffffff',
    toolboxBackgroundColour: '#f4f4f4',
    toolboxForegroundColour: '#000000',
  }
});

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: document.getElementById('toolbox'),
  theme: myTheme,
  trashcan: true,
  scrollbars: true,
  zoom: { controls: true, wheel: true, startScale: 0.9 }
});

function optimizeBlocklyForMobile() {
  if (workspace && workspace.options) {
    workspace.options.horizontalLayout = false;
    workspace.options.toolboxPosition = 'start';
    
    if (window.innerWidth <= 768) {
      workspace.setScale(0.8);
    }
  }
}

optimizeBlocklyForMobile();

// ============================================================================
// CANVAS SETUP
// ============================================================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let FIELD_SIZE = 600;
const TILE_WIDTH = 23.5;
const FIELD_HALF = 72;

let fieldImage = new Image();
let robotImage = new Image();
let imageLoaded = false;
let robotImageLoaded = false;
let partnerRobotImageLoaded = false;
let currentPath = [];
let partnerPath = [];
let startPos = null;
let partnerStartPos = null;
let currentAlliance = 'RED';
let currentSide = 'NORTH';
let partnerAlliance = 'RED';
let partnerSide = 'SOUTH';
let showPartner = true;

let animationRunning = false;
let animationProgress = 0;
let animationStartTime = 0;
let totalPathTime = 0;
let pathSegments = [];
let partnerPathSegments = [];
let partnerTotalPathTime = 0;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
}, { passive: false });

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  
  if (container && canvas) {
    const containerWidth = container.clientWidth - 20;
    const containerHeight = container.clientHeight - 20;
    const size = Math.min(containerWidth, containerHeight, 600);
    
    if (size > 0 && size !== FIELD_SIZE) {
      FIELD_SIZE = size;
      canvas.width = size;
      canvas.height = size;
      renderField();
    }
  }
}

setTimeout(resizeCanvas, 100);

fieldImage.onload = function() {
  imageLoaded = true;
  updateVisualization();
};
fieldImage.onerror = function() {
  imageLoaded = false;
  updateVisualization();
};
fieldImage.src = 'FTC Field.jpg';

robotImage.onload = function() {
  robotImageLoaded = true;
  updateVisualization();
};
robotImage.onerror = function() {
  robotImageLoaded = false;
  updateVisualization();
};
robotImage.src = 'robot.png';

// Don't try to load partner robot image - just use fallback box
partnerRobotImageLoaded = false;

// ============================================================================
// START POSITIONS AND NAMED POSES
// ============================================================================

function getStartPosition(alliance, side) {
  const allianceSign = alliance === 'RED' ? -1 : 1;
  
  if (side === 'NORTH') {
    // getStartNorthPose()
    return applyOffsets(
      3 * TILE_WIDTH,
      allianceSign * -0.5 * TILE_WIDTH,
      0, // heading: 0 degrees (facing +X)
      Axial.FRONT,
      Lateral.CENTER
    );
  } else {
    // getStartSouthPose()
    return applyOffsets(
      -3 * TILE_WIDTH,
      allianceSign * -1.5 * TILE_WIDTH,
      0, // heading: 0 degrees (facing +X)
      Axial.BACK,
      Lateral.CENTER
    );
  }
}

function getAllianceSign() {
  return currentAlliance === 'RED' ? -1 : 1;
}

const NAMED_POSES = {
  spike_near: () => {
    // getSpike1() - nearest spike mark
    const heading = getAllianceSign() * -90 * Math.PI / 180;
    return applyOffsets(
      1.5 * TILE_WIDTH,
      getAllianceSign() * -1.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  spike_middle: () => {
    // getSpike2() - middle spike mark
    const heading = getAllianceSign() * -90 * Math.PI / 180;
    return applyOffsets(
      0.5 * TILE_WIDTH,
      getAllianceSign() * -1.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  spike_far: () => {
    // getSpike3() - farthest spike mark
    const heading = getAllianceSign() * -90 * Math.PI / 180;
    return applyOffsets(
      -0.5 * TILE_WIDTH,
      getAllianceSign() * -1.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  loading_zone: () => {
    // getSpike0() - loading zone position
    const heading = getAllianceSign() * -90 * Math.PI / 180;
    return applyOffsets(
      2.5 * TILE_WIDTH,
      getAllianceSign() * -2.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  launch_near: () => {
    // getLaunchNearPose()
    const heading = getAllianceSign() * 45 * Math.PI / 180;
    return applyOffsets(
      -0.5 * TILE_WIDTH,
      getAllianceSign() * -0.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  launch_far: () => {
    // getLaunchFarPose()
    const heading = getAllianceSign() * 20 * Math.PI / 180;
    return applyOffsets(
      2.5 * TILE_WIDTH,
      getAllianceSign() * -0.5 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  gate: () => {
    // getGatePose()
    const heading = getAllianceSign() * -90 * Math.PI / 180;
    return applyOffsets(
      0 * TILE_WIDTH,
      getAllianceSign() * -2 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  },
  base: () => {
    // getBasePose()
    const heading = getAllianceSign() * 0 * Math.PI / 180;
    return applyOffsets(
      2 * TILE_WIDTH,
      getAllianceSign() * 1.4 * TILE_WIDTH,
      heading,
      Axial.CENTER,
      Lateral.CENTER
    );
  }
};

function pedroToCanvas(x, y) {
  return {
    x: (x + FIELD_HALF) * (FIELD_SIZE / (FIELD_HALF * 2)),
    y: (FIELD_HALF - y) * (FIELD_SIZE / (FIELD_HALF * 2))
  };
}

// ============================================================================
// PATH TIMING CALCULATIONS
// ============================================================================

function calculateMoveTime(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  let dHeading = to.heading - from.heading;
  while (dHeading > Math.PI) dHeading -= 2 * Math.PI;
  while (dHeading < -Math.PI) dHeading += 2 * Math.PI;
  const turnAmount = Math.abs(dHeading) * 180 / Math.PI;
  
  const linearTime = distance / Math.sqrt(
    PEDRO_CONSTANTS.xMovementVelocity ** 2 + 
    PEDRO_CONSTANTS.yMovementVelocity ** 2
  );
  
  const turnTime = turnAmount / PEDRO_CONSTANTS.turnVelocity;
  
  return Math.max(linearTime, turnTime);
}

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
    
    let actionTime = 0;
    if (wp.type === 'intake') {
      actionTime = PEDRO_CONSTANTS.intakeTime;
    } else if (wp.type === 'deposit') {
      actionTime = PEDRO_CONSTANTS.depositTime;
    } else if (wp.type === 'action') {
      actionTime = PEDRO_CONSTANTS.releaseGateTime;
    } else if (wp.type === 'delay') {
      actionTime = wp.delayTime || 0;
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

function calculatePartnerPathSegments() {
  if (!partnerStartPos || partnerPath.length === 0) {
    partnerPathSegments = [];
    partnerTotalPathTime = 0;
    return;
  }
  
  const segments = [];
  let currentPose = { ...partnerStartPos };
  let cumulativeTime = 0;
  
  partnerPath.forEach((wp, idx) => {
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
    
    let actionTime = 0;
    if (wp.type === 'intake') {
      actionTime = PEDRO_CONSTANTS.intakeTime;
    } else if (wp.type === 'deposit') {
      actionTime = PEDRO_CONSTANTS.depositTime;
    } else if (wp.type === 'action') {
      actionTime = PEDRO_CONSTANTS.releaseGateTime;
    } else if (wp.type === 'delay') {
      actionTime = wp.delayTime || 0;
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
  
  partnerPathSegments = segments;
  partnerTotalPathTime = cumulativeTime;
}

function getRobotPoseAtTime(time) {
  if (pathSegments.length === 0) return null;
  
  for (const seg of pathSegments) {
    if (time >= seg.startTime && time < seg.startTime + seg.duration) {
      const elapsed = time - seg.startTime;
      
      if (seg.type === 'action') {
        return { ...seg.startPose };
      }
      
      const distance = Math.sqrt(
        (seg.endPose.x - seg.startPose.x) ** 2 + 
        (seg.endPose.y - seg.startPose.y) ** 2
      );
      
      let t = elapsed / seg.duration;
      t = t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      const x = seg.startPose.x + (seg.endPose.x - seg.startPose.x) * t;
      const y = seg.startPose.y + (seg.endPose.y - seg.startPose.y) * t;
      
      let dh = seg.endPose.heading - seg.startPose.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      const heading = seg.startPose.heading + dh * t;
      
      return { x, y, heading };
    }
  }
  
  if (time >= totalPathTime && pathSegments.length > 0) {
    const lastSeg = pathSegments[pathSegments.length - 1];
    return { ...lastSeg.endPose };
  }
  
  return { ...startPos };
}

function getPartnerRobotPoseAtTime(time) {
  if (partnerPathSegments.length === 0) return null;
  
  for (const seg of partnerPathSegments) {
    if (time >= seg.startTime && time < seg.startTime + seg.duration) {
      const elapsed = time - seg.startTime;
      
      if (seg.type === 'action') {
        return { ...seg.startPose };
      }
      
      let t = elapsed / seg.duration;
      t = t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      const x = seg.startPose.x + (seg.endPose.x - seg.startPose.x) * t;
      const y = seg.startPose.y + (seg.endPose.y - seg.startPose.y) * t;
      
      let dh = seg.endPose.heading - seg.startPose.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      const heading = seg.startPose.heading + dh * t;
      
      return { x, y, heading };
    }
  }
  
  if (time >= partnerTotalPathTime && partnerPathSegments.length > 0) {
    const lastSeg = partnerPathSegments[partnerPathSegments.length - 1];
    return { ...lastSeg.endPose };
  }
  
  return { ...partnerStartPos };
}

// ============================================================================
// BLOCK MANAGEMENT
// ============================================================================

function ensureStartBlock() {
  if (!workspace.getAllBlocks(false).some(b => b.type === 'start')) {
    const startBlock = workspace.newBlock('start');
    workspace.addTopBlock(startBlock);
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(50, 50);
  }
  if (!workspace.getAllBlocks(false).some(b => b.type === 'partner_start')) {
    const partnerBlock = workspace.newBlock('partner_start');
    workspace.addTopBlock(partnerBlock);
    partnerBlock.initSvg();
    partnerBlock.render();
    partnerBlock.moveBy(250, 50);
  }
}

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

document.getElementById('partner-toggle').addEventListener('change', (e) => {
  showPartner = e.target.checked;
  updateVisualization();
});

document.getElementById('partner-alliance').addEventListener('change', (e) => {
  partnerAlliance = e.target.value;
  updateVisualization();
});

document.getElementById('partner-side').addEventListener('change', (e) => {
  partnerSide = e.target.value;
  updateVisualization();
});

function updateVisualization() {
  const alliance = document.getElementById('alliance').value;
  const side = document.getElementById('side').value;
  currentAlliance = alliance;
  currentSide = side;
  
  startPos = getStartPosition(alliance, side);

  currentPath = extractPathFromBlocks();
  calculatePathSegments();
  
  // Update partner toggle state
  const partnerToggle = document.getElementById('partner-toggle');
  if (partnerToggle) {
    showPartner = partnerToggle.checked;
  }
  
  // Update partner if enabled
  if (showPartner) {
    const pAlliance = document.getElementById('partner-alliance');
    const pSide = document.getElementById('partner-side');
    if (pAlliance && pSide) {
      partnerAlliance = pAlliance.value;
      partnerSide = pSide.value;
    }
    partnerStartPos = getStartPosition(partnerAlliance, partnerSide);
    partnerPath = extractPathFromBlocks('partner_start');
    calculatePartnerPathSegments();
  }
  
  updateWaypointsList();
  renderField();
}

function extractPathFromBlocks(startBlockType = 'start') {
  const path = [];
  const startBlock = workspace.getTopBlocks(true).find(b => b.type === startBlockType);
  if (!startBlock) return path;

  let current = startBlock.getNextBlock();
  while (current) {
    let waypoint = null;
    
    if (current.type === 'drive_to') {
      const tx = Number(current.getFieldValue('tx')) || 0;
      const ty = Number(current.getFieldValue('ty')) || 0;
      const h = (Number(current.getFieldValue('h')) || 0) * Math.PI / 180;
      const x = tx * TILE_WIDTH;
      const y = ty * TILE_WIDTH;
      
      waypoint = { x, y, heading: h, type: 'drive', label: 'Drive' };
    }
    
    else if (current.type === 'deposit') {
      const locale = current.getFieldValue('locale');
      const txo = Number(current.getFieldValue('txo')) || 0;
      const tyo = Number(current.getFieldValue('tyo')) || 0;
      
      // Get base pose from locale - need to use the correct alliance context
      const savedAlliance = currentAlliance;
      if (startBlockType === 'partner_start') {
        currentAlliance = partnerAlliance;
      }
      const pose = locale === 'near' ? NAMED_POSES.launch_near() : NAMED_POSES.launch_far();
      currentAlliance = savedAlliance;
      
      // Apply tile offsets
      const x = pose.x + (txo * TILE_WIDTH);
      const y = pose.y + (tyo * TILE_WIDTH);
      
      waypoint = {
        x: x,
        y: y,
        heading: pose.heading,
        type: 'deposit',
        label: `Deposit ${locale}${txo || tyo ? ` (${txo},${tyo})` : ''}`
      };
    }
    
    else if (current.type === 'intake_row') {
      const spike = Number(current.getFieldValue('spike')) || 0;
      let pose;
      
      // Save and restore alliance context for partner
      const savedAlliance = currentAlliance;
      if (startBlockType === 'partner_start') {
        currentAlliance = partnerAlliance;
      }
      
      if (spike === 0) {
        pose = NAMED_POSES.loading_zone();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Human Intake'
        };
      } else if (spike === 1) {
        pose = NAMED_POSES.spike_near();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Near'
        };
      } else if (spike === 2) {
        pose = NAMED_POSES.spike_middle();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Mid'
        };
      } else if (spike === 3) {
        pose = NAMED_POSES.spike_far();
        waypoint = {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          type: 'intake',
          label: 'Intake Far'
        };
      }
      
      currentAlliance = savedAlliance;
    }
    
    else if (current.type === 'intake_human') {
      const savedAlliance = currentAlliance;
      if (startBlockType === 'partner_start') {
        currentAlliance = partnerAlliance;
      }
      const pose = NAMED_POSES.loading_zone();
      currentAlliance = savedAlliance;
      
      waypoint = {
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        type: 'intake',
        label: 'Human Intake'
      };
    }
    
    else if (current.type === 'release_gate') {
      const savedAlliance = currentAlliance;
      if (startBlockType === 'partner_start') {
        currentAlliance = partnerAlliance;
      }
      const pose = NAMED_POSES.gate();
      currentAlliance = savedAlliance;
      
      waypoint = {
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        type: 'action',
        label: 'Release Gate'
      };
    }
    
    else if (current.type === 'delay_s') {
      const delayTime = Number(current.getFieldValue('s')) || 0;
      
      // Get the last waypoint's position, or start position if no waypoints yet
      let lastPose;
      if (path.length > 0) {
        const lastWp = path[path.length - 1];
        lastPose = { x: lastWp.x, y: lastWp.y, heading: lastWp.heading };
      } else {
        lastPose = startBlockType === 'partner_start' ? { ...partnerStartPos } : { ...startPos };
      }
      
      // Create a waypoint at the same position with delay type
      waypoint = {
        x: lastPose.x,
        y: lastPose.y,
        heading: lastPose.heading,
        type: 'delay',
        delayTime: delayTime,
        label: `Wait ${delayTime}s`
      };
    }
    
    if (waypoint) {
      path.push(waypoint);
    }
    
    current = current.getNextBlock();
  }
  
  return path;
}

// ============================================================================
// UI UPDATES
// ============================================================================

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
    let icon = '';
    if (wp.type === 'deposit') icon = '📤';
    else if (wp.type === 'intake') icon = '📥';
    else if (wp.type === 'action') icon = '⚡';
    
    const moveTime = calculateMoveTime(currentPose, wp);
    cumulativeTime += moveTime;
    
    let actionTime = 0;
    if (wp.type === 'intake') actionTime = PEDRO_CONSTANTS.intakeTime;
    else if (wp.type === 'deposit') actionTime = PEDRO_CONSTANTS.depositTime;
    else if (wp.type === 'action') actionTime = PEDRO_CONSTANTS.releaseGateTime;
    
    cumulativeTime += actionTime;
    
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

// ============================================================================
// FIELD RENDERING
// ============================================================================

function renderField() {
  ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);

  if (imageLoaded) {
    ctx.save();
    ctx.translate(FIELD_SIZE / 2, FIELD_SIZE / 2);
    ctx.rotate(0);
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

  // Draw partner path first (behind main robot)
  if (showPartner && partnerPath.length > 0 && partnerStartPos) {
    ctx.strokeStyle = 'rgba(255, 107, 157, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    
    const start = pedroToCanvas(partnerStartPos.x, partnerStartPos.y);
    ctx.moveTo(start.x, start.y);
    
    partnerPath.forEach(wp => {
      const pos = pedroToCanvas(wp.x, wp.y);
      ctx.lineTo(pos.x, pos.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    partnerPath.forEach((wp, idx) => {
      const pos = pedroToCanvas(wp.x, wp.y);
      
      if (wp.type === 'deposit') {
        ctx.fillStyle = '#ff6b9d';
      } else if (wp.type === 'intake') {
        ctx.fillStyle = '#ff85a8';
      } else if (wp.type === 'action') {
        ctx.fillStyle = '#ff9fb3';
      } else {
        ctx.fillStyle = '#ffb3c6';
      }
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-wp.heading + Math.PI / 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.restore();
    });
  }

  // Draw main robot path
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
      ctx.rotate(-wp.heading + Math.PI / 2);
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

  // Draw main robot
  if (startPos) {
    let robotPose = startPos;
    if (animationRunning && pathSegments.length > 0) {
      const elapsed = (Date.now() - animationStartTime) / 1000;
      robotPose = getRobotPoseAtTime(elapsed) || startPos;
      
      if (elapsed >= totalPathTime) {
        stopAnimation();
      }
    }
    
    const pos = pedroToCanvas(robotPose.x, robotPose.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(-robotPose.heading + Math.PI / 2);
    
    const robotSizeInches = 18;
    const robotSizePixels = robotSizeInches * (FIELD_SIZE / (FIELD_HALF * 2));
    const halfSize = robotSizePixels / 2;
    
    if (robotImageLoaded) {
      ctx.drawImage(robotImage, -halfSize, -halfSize, robotSizePixels, robotSizePixels);
    } else {
      ctx.fillStyle = 'rgba(67, 170, 139, 0.9)';
      ctx.fillRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
      
      ctx.fillStyle = '#f9c74f';
      ctx.beginPath();
      ctx.moveTo(0, -halfSize);
      ctx.lineTo(-halfSize * 0.4, -halfSize * 0.6);
      ctx.lineTo(halfSize * 0.4, -halfSize * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Draw partner robot on top
  if (showPartner && partnerStartPos) {
    let partnerPose = partnerStartPos;
    if (animationRunning && partnerPathSegments.length > 0) {
      const elapsed = (Date.now() - animationStartTime) / 1000;
      partnerPose = getPartnerRobotPoseAtTime(elapsed) || partnerStartPos;
    }
    
    const pos = pedroToCanvas(partnerPose.x, partnerPose.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(-partnerPose.heading + Math.PI / 2);
    
    const robotSizeInches = 18;
    const robotSizePixels = robotSizeInches * (FIELD_SIZE / (FIELD_HALF * 2));
    const halfSize = robotSizePixels / 2;
    
    // Always draw fallback rectangle for partner robot
    ctx.fillStyle = 'rgba(255, 107, 157, 0.9)';
    ctx.fillRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfSize, -halfSize, robotSizePixels, robotSizePixels);
    
    // Forward direction indicator
    ctx.fillStyle = '#ff85a8';
    ctx.beginPath();
    ctx.moveTo(0, -halfSize);
    ctx.lineTo(-halfSize * 0.4, -halfSize * 0.6);
    ctx.lineTo(halfSize * 0.4, -halfSize * 0.6);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

// ============================================================================
// ANIMATION CONTROLS
// ============================================================================

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// QR GENERATION
// ============================================================================

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

  // Hide both panels and show QR in full screen
  const rightPanel = document.getElementById('right-panel');
  const leftPanel = document.getElementById('left-panel');
  
  rightPanel.style.display = 'none';
  leftPanel.style.display = 'none';
  
  // Create full-screen QR view
  let qrView = document.getElementById('qr-fullscreen-view');
  if (!qrView) {
    qrView = document.createElement('div');
    qrView.id = 'qr-fullscreen-view';
    qrView.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #252526;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 0;
      box-sizing: border-box;
    `;
    document.body.appendChild(qrView);
  }
  
  qrView.innerHTML = '';
  qrView.style.display = 'flex';

  // Add info text at top
  const infoText = document.createElement('div');
  infoText.textContent = `Steps: ${plan.length} | Size: ${b64.length} chars`;
  infoText.style.cssText = `
    position: absolute;
    top: 5px;
    left: 0;
    right: 0;
    color: #888;
    font-size: 0.7rem;
    text-align: center;
    z-index: 10;
  `;
  qrView.appendChild(infoText);

  // Add QR container
  const qrWrapper = document.createElement('div');
  qrWrapper.style.cssText = `
    position: absolute;
    top: 25px;
    bottom: 50px;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  `;
  qrView.appendChild(qrWrapper);

  // Generate QR code
  try {
    await ensureKjua();
    const isMobile = window.innerWidth <= 768;
    const qrSize = 2000;
    
    console.log('QR Generation:', { qrSize, isMobile, viewport: `${window.innerWidth}x${window.innerHeight}` });
    const qr = kjua({ render: 'svg', text: b64, size: qrSize, ecLevel: 'H' });
    
    if (isMobile) {
      qr.style.cssText = `width: 100%; height: auto; display: block; max-width: none;`;
    } else {
      qr.style.cssText = `width: 600px; height: 600px; display: block;`;
    }
    qrWrapper.appendChild(qr);
  } catch (e) {
    console.warn('kjua not available, trying image API', e);
    const isMobile = window.innerWidth <= 768;
    const qrSize = 2000;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=` + encodeURIComponent(b64);
    const img = document.createElement('img');
    img.alt = 'QR code';
    img.src = qrUrl;
    
    if (isMobile) {
      img.style.cssText = `width: 100%; height: auto; display: block; max-width: none;`;
    } else {
      img.style.cssText = `width: 600px; height: 600px; display: block;`;
    }
    qrWrapper.appendChild(img);
  }

  // Add back button at bottom
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Back to Generator';
  const isMobileBtn = window.innerWidth <= 768;
  backBtn.style.cssText = `
    position: absolute;
    bottom: ${isMobileBtn ? '2px' : '5px'};
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    font-size: 13px;
    background: #43aa8b;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 600;
    min-height: 40px;
    z-index: 10;
  `;
  backBtn.onclick = () => {
    qrView.style.display = 'none';
    rightPanel.style.display = '';
    leftPanel.style.display = '';
  };
  qrView.appendChild(backBtn);

  safeLocalStorageSet('last_qr_payload', b64);
});

// ============================================================================
// BUNDLE CREATION
// ============================================================================

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

// ============================================================================
// CLEAR WORKSPACE
// ============================================================================

document.getElementById('clearBtn').addEventListener('click', () => {
  workspace.getAllBlocks(false).forEach(b => b.dispose(true));
  safeLocalStorageRemove('last_qr_payload');
  document.getElementById('qr').innerHTML = '';
  document.getElementById('info').textContent = '';
  stopAnimation();
  ensureStartBlock();
  updateVisualization();
});

// ============================================================================
// PLAN JSON GENERATION
// ============================================================================

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

function compressAndEncode(plan) {
  const json = JSON.stringify(plan);
  const gzip = pako.gzip(json);
  let binary = '';
  for (let i = 0; i < gzip.length; i++) binary += String.fromCharCode(gzip[i]);
  return btoa(binary);
}

// ============================================================================
// WINDOW RESIZE & ORIENTATION HANDLERS
// ============================================================================

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (workspace) {
      Blockly.svgResize(workspace);
      optimizeBlocklyForMobile();
      resizeCanvas();
    }
  }, 250);
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resizeCanvas();
    if (workspace) {
      Blockly.svgResize(workspace);
      optimizeBlocklyForMobile();
    }
  }, 100);
});

// ============================================================================
// TOUCH FEEDBACK FOR BUTTONS
// ============================================================================

function addTouchFeedback() {
  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('touchstart', function() {
      this.style.opacity = '0.7';
    }, { passive: true });
    
    btn.addEventListener('touchend', function() {
      this.style.opacity = '1';
    }, { passive: true });
  });
}

addTouchFeedback();

// ============================================================================
// SERVICE WORKER REGISTRATION
// ============================================================================

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  try { navigator.serviceWorker.register('sw.js'); } catch (e) { }
}

// ============================================================================
// INITIAL SETUP
// ============================================================================

ensureStartBlock();
updateVisualization();
setTimeout(() => {
  resizeCanvas();
  renderField();
}, 200);