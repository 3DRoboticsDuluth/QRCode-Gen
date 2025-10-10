// ============================
// blocks_custom.js
// Custom Blockly blocks for FTC QR Generator
// ============================

Blockly.defineBlocksWithJsonArray([
  // --- When Run Block (Program start) ---
  {
    "type": "when_run",
    "message0": "When Run ▶",
    "nextStatement": null,
    "colour": 0,
    "tooltip": "This block marks the start of the program",
    "helpUrl": ""
  },

  // --- Intake Block ---
  {
    "type": "intake_block",
    "message0": "Intake row %1",
    "args0": [
      { "type": "field_number", "name": "ROW", "value": 1, "min": 1, "max": 3 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 160,
    "tooltip": "Run intake for a specific row",
    "helpUrl": ""
  },

  // --- Deposit Block ---
  {
    "type": "deposit_block",
    "message0": "Deposit at (x:%1 y:%2 heading:%3)",
    "args0": [
      { "type": "field_number", "name": "X", "value": 0 },
      { "type": "field_number", "name": "Y", "value": 0 },
      { "type": "field_angle", "name": "HEADING", "angle": 0 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 210,
    "tooltip": "Deposits at a coordinate",
    "helpUrl": ""
  },

  // --- Delay Block ---
  {
    "type": "delay_block",
    "message0": "Delay for %1 ms",
    "args0": [
      { "type": "field_number", "name": "TIME", "value": 1000, "min": 0 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 65,
    "tooltip": "Pause for a time in milliseconds",
    "helpUrl": ""
  },

  // --- Move To Block ---
  {
    "type": "move_to_block",
    "message0": "Move to (x:%1 y:%2 heading:%3) speed %4",
    "args0": [
      { "type": "field_number", "name": "X", "value": 0 },
      { "type": "field_number", "name": "Y", "value": 0 },
      { "type": "field_angle", "name": "HEADING", "angle": 0 },
      { "type": "field_number", "name": "SPEED", "value": 1, "min": 0, "max": 1, "precision": 0.1 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 300,
    "tooltip": "Move robot to a position",
    "helpUrl": ""
  }
]);

// ============================
// Code Generators
// ============================

// Root "When Run" block
Blockly.JavaScript['when_run'] = function(block) {
  // Get all nested statements under this one
  const nextCode = Blockly.JavaScript.statementToCode(block, 'DO') || '';
  // Remove trailing comma and wrap everything in array brackets
  const clean = nextCode.trim().replace(/,+$/, '');
  return `[${clean}]`;
};

// Intake
Blockly.JavaScript['intake_block'] = function(block) {
  const row = block.getFieldValue('ROW');
  return `{"cmd":"intake","row":${row}},`;
};

// Deposit
Blockly.JavaScript['deposit_block'] = function(block) {
  const x = block.getFieldValue('X');
  const y = block.getFieldValue('Y');
  const heading = block.getFieldValue('HEADING');
  return `{"cmd":"deposit","x":${x},"y":${y},"heading":${heading}},`;
};

// Delay
Blockly.JavaScript['delay_block'] = function(block) {
  const time = block.getFieldValue('TIME');
  return `{"cmd":"delay","time":${time}},`;
};

// Move To
Blockly.JavaScript['move_to_block'] = function(block) {
  const x = block.getFieldValue('X');
  const y = block.getFieldValue('Y');
  const heading = block.getFieldValue('HEADING');
  const speed = block.getFieldValue('SPEED');
  return `{"cmd":"move_to","x":${x},"y":${y},"heading":${heading},"speed":${speed}},`;
};
