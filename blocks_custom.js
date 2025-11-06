// START BLOCK
// NOTE: The generators in this file return JSON-encoded strings for each command.
// The decoding implementation (Android/FTC) expects an outer JSON array of these
// strings. Keep keys/names consistent with the decoder here:
// https://github.com/3DRoboticsDuluth/11206-2025-Decode.git  <-- review command schema there.
Blockly.Blocks['start'] = {
  init: function() {
    this.appendDummyInput().appendField("▶ Start");
    this.setNextStatement(true);
    this.setColour("#f9c74f");
    this.setDeletable(true);
  }
};

// Start generator: walk next blocks and call their registered generator functions directly.
Blockly.JavaScript['start'] = function(block) {
  let next = block.getNextBlock();
  const plan = [];
  while (next) {
    try {
      const gen = Blockly.JavaScript[next.type];
      if (typeof gen === 'function') {
        const code = gen(next);
        if (code && code !== 'undefined') {
          // Parse the JSON string to get the actual object
          try {
            const obj = JSON.parse(code);
            plan.push(obj);
          } catch (e) {
            console.warn('Failed to parse JSON for', next.type, ':', code);
            plan.push({cmd: next.type, error: 'parse_failed'});
          }
        }
      } else {
        // fallback minimal serialization
        plan.push({cmd: next.type});
      }
    } catch (e) {
      console.warn('Generator error for', next.type, e);
      plan.push({cmd: next.type, error: 'generator_failed'});
    }
    next = next.getNextBlock();
  }
  return JSON.stringify(plan);
};

// DRIVE TO (coordinates or tile-based)
Blockly.Blocks['drive_to'] = {
  init: function() {
    this.appendDummyInput('MODE')
      .appendField("Drive to")
      .appendField(new Blockly.FieldDropdown([["Coords","coords"],["Tiles","tiles"]]), "mode");
    // Coords input group
    this.appendDummyInput('COORDS')
      .appendField("x:")
      .appendField(new Blockly.FieldNumber(0), "x")
      .appendField("y:")
      .appendField(new Blockly.FieldNumber(0), "y")
      .appendField("heading:")
      .appendField(new Blockly.FieldNumber(0,0,360), "heading_coords");
    // Tiles input group (only visible when mode == tiles)
    this.appendDummyInput('TILES')
      .appendField("tile_x:")
      .appendField(new Blockly.FieldNumber(0), "tile_x")
      .appendField("tile_y:")
      .appendField(new Blockly.FieldNumber(0), "tile_y")
      .appendField("heading:")
      .appendField(new Blockly.FieldNumber(0,0,360), "heading_tiles");
    // default visibility: show COORDS, hide TILES
    this.getInput('COORDS').setVisible(true);
    this.getInput('TILES').setVisible(false);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#43aa8b");
  }
};
Blockly.JavaScript['drive_to'] = function(block){
  const mode = block.getFieldValue('mode');
  if (mode === 'tiles') {
    const tile_x = Number(block.getFieldValue('tile_x'))||0;
    const tile_y = Number(block.getFieldValue('tile_y'))||0;
    const heading = Number(block.getFieldValue('heading_tiles'))||0;
    return JSON.stringify({cmd:'drive_to', tile_x, tile_y, heading, use_tiles:true});
  } else {
    const x = Number(block.getFieldValue('x'))||0;
    const y = Number(block.getFieldValue('y'))||0;
    const heading = Number(block.getFieldValue('heading_coords'))||0;
    return JSON.stringify({cmd:'drive_to', x, y, heading});
  }
};

// Show/hide COORDS / TILES inputs based on mode selection
Blockly.Blocks['drive_to'].onchange = function(event) {
  try {
    const mode = this.getFieldValue('mode');
    const coordsInput = this.getInput('COORDS');
    const tilesInput = this.getInput('TILES');
    if (coordsInput) coordsInput.setVisible(mode === 'coords');
    if (tilesInput) tilesInput.setVisible(mode === 'tiles');
    // force a render when inputs change visibility
    if (this.workspace) this.workspace.render();
  } catch (e) { /* ignore when removed */ }
};

// INTAKE ROW (1-3)
Blockly.Blocks['intake_row'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Intake row")
      .appendField(new Blockly.FieldNumber(1,0,3,1),"row");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#577590");
  }
};
Blockly.JavaScript['intake_row'] = function(block){
  const row = Number(block.getFieldValue('row'))||1;
  return JSON.stringify({cmd:'intake_row', row});
};

// INTAKE HUMAN (shortcut for row 0)
Blockly.Blocks['intake_human'] = {
  init: function() {
    this.appendDummyInput().appendField("Intake Human");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#577590");
  }
};
Blockly.JavaScript['intake_human'] = function(block){
  return JSON.stringify({cmd:'intake_row', row:0});
};

// DEPOSIT (near/far) with sortedY boolean
Blockly.Blocks['deposit_near_far'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Deposit")
      .appendField(new Blockly.FieldDropdown([["Near","near"],["Far","far"]]), "where")
      .appendField(" sorted?")
      .appendField(new Blockly.FieldDropdown([["No","false"],["Yes","true"]]), "sorted");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#277da1");
  }
};
Blockly.JavaScript['deposit_near_far'] = function(block){
  const where = block.getFieldValue('where');
  const sorted = block.getFieldValue('sorted') === 'true';
  return JSON.stringify({cmd:'deposit', mode: where, sorted});
};

// DELAY (seconds) - generator emits ms to match decoder
Blockly.Blocks['delay_s'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Delay for")
      .appendField(new Blockly.FieldNumber(1,0),"s")
      .appendField("s");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#f94144");
  }
};
Blockly.JavaScript['delay_s'] = function(block){
  const s = Number(block.getFieldValue('s'))||0;
  const ms = Math.round(s * 1000);
  return JSON.stringify({cmd:'delay_ms', ms});
};

// RELEASE GATE
Blockly.Blocks['release_gate'] = {
  init: function(){
    this.appendDummyInput().appendField("Release Gate");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#b5179e");
  }
};
Blockly.JavaScript['release_gate'] = function(block){
  return JSON.stringify({cmd:'release_gate'});
};

// DEPOSIT AT TILE (tile coordinates + heading + sortedY)
Blockly.Blocks['deposit_tile'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Deposit at tile_x:")
      .appendField(new Blockly.FieldNumber(0),"tile_x")
      .appendField("tile_y:")
      .appendField(new Blockly.FieldNumber(0),"tile_y")
      .appendField("heading:")
      .appendField(new Blockly.FieldNumber(0,0,360),"heading");
    this.appendDummyInput()
      .appendField(" sorted?")
      .appendField(new Blockly.FieldDropdown([["No","false"],["Yes","true"]]), "sorted");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#277da1");
  }
};
Blockly.JavaScript['deposit_tile'] = function(block){
  const tile_x = Number(block.getFieldValue('tile_x'))||0;
  const tile_y = Number(block.getFieldValue('tile_y'))||0;
  const heading = Number(block.getFieldValue('heading'))||0;
  const sorted = block.getFieldValue('sorted') === 'true';
  return JSON.stringify({cmd:'deposit', tile_x, tile_y, heading, sorted});
};

// Debug: log which generators are present after definitions
if (typeof console !== 'undefined' && Blockly && Blockly.JavaScript) {
  try {
    const names = ['start','drive_to','intake_row','intake_human','delay_s','deposit_near_far','deposit_tile','release_gate'];
    names.forEach(n => console.info('blocks_custom: generator present ->', n, typeof Blockly.JavaScript[n] === 'function'));
  } catch (e) { /* ignore */ }
}