// blocks_custom.js
// Defines custom Blockly blocks and a JS generator that returns a JSON array representation.

// Toolbox XML (we'll insert this into the workspace on init)
const TOOLBOX_XML = `
<xml id="toolbox" style="display:none">
  <category name="Robot" colour="#5C81A6">
    <block type="intake_block"></block>
    <block type="deposit_block"></block>
    <block type="delay_block"></block>
  </category>
  <sep></sep>
  <category name="Control" colour="#5CA65C">
    <block type="controls_if"></block>
    <block type="controls_repeat_ext"></block>
  </category>
  <category name="Math" colour="#5C68A6">
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
  </category>
  <category name="Text" colour="#5CA6A6">
    <block type="text"></block>
  </category>
</xml>`;

// Define blocks
Blockly.defineBlocksWithJsonArray([
  {
    "type": "intake_block",
    "message0": "intake row %1",
    "args0": [{"type":"field_number","name":"ROW","value":1,"min":1,"precision":1}],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230,
    "tooltip": "Intake action for specified row",
    "helpUrl": ""
  },
  {
    "type": "deposit_block",
    "message0": "deposit at x %1 y %2 heading %3",
    "args0": [
      {"type":"field_number","name":"X","value":0,"precision":0.01},
      {"type":"field_number","name":"Y","value":0,"precision":0.01},
      {"type":"field_number","name":"HEADING","value":0,"precision":0.1}
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "Deposit at pose",
    "helpUrl": ""
  },
  {
    "type": "delay_block",
    "message0": "delay %1 ms",
    "args0": [{"type":"field_number","name":"MS","value":500,"min":0,"precision":1}],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 60,
    "tooltip": "Delay for ms",
    "helpUrl": ""
  }
]);

// JS code generator: produce a JSON array from top-level blocks in order.
function workspaceToJsonArray(workspace) {
  const top = workspace.getTopBlocks(true);
  const out = [];
  for (const b of top) {
    collectBlock(b, out);
  }
  return out;
}

function collectBlock(block, arr) {
  // Walk a chain of statement blocks (block, next)
  let current = block;
  while (current) {
    const obj = blockToObj(current);
    if (obj) arr.push(obj);
    current = current.getNextBlock ? current.getNextBlock() : null;
  }
}

function blockToObj(block) {
  if (!block) return null;
  const t = block.type;
  if (t === 'intake_block') {
    return { cmd: 'INTAKE', args: { row: parseInt(block.getFieldValue('ROW')) } };
  } else if (t === 'deposit_block') {
    return {
      cmd: 'DEPOSIT',
      args: {
        x: parseFloat(block.getFieldValue('X')),
        y: parseFloat(block.getFieldValue('Y')),
        heading: parseFloat(block.getFieldValue('HEADING'))
      }
    };
  } else if (t === 'delay_block') {
    return { cmd: 'DELAY', args: { ms: parseInt(block.getFieldValue('MS')) } };
  } else {
    // Unknown block - ignore but you may extend later
    return null;
  }
}

// Export toolbox xml and helper function for app.js
window.FTC_TOOLBOX_XML = TOOLBOX_XML;
window.FTC_workspaceToJsonArray = workspaceToJsonArray;
