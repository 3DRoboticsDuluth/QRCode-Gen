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
      .appendField("tx:")
      .appendField(new Blockly.FieldNumber(0), "tile_x")
      .appendField("ty:")
      .appendField(new Blockly.FieldNumber(0), "tile_y")
      .appendField("h:")
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
    const tx = Number(block.getFieldValue('tile_x'))||0;
    const ty = Number(block.getFieldValue('tile_y'))||0;
    const h = Number(block.getFieldValue('heading_tiles'))||0;
    return JSON.stringify({cmd:'drive', tx, ty, h});
  } else {
    const x = Number(block.getFieldValue('x'))||0;
    const y = Number(block.getFieldValue('y'))||0;
    const h = Number(block.getFieldValue('heading_coords'))||0;
    return JSON.stringify({cmd:'drive', x, y, h});
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

// INTAKE ROW (0-3, where 0 = human)
Blockly.Blocks['intake_row'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Intake")
      .appendField(new Blockly.FieldDropdown([
        ["Human (0)","0"],
        ["Spike 1","1"],
        ["Spike 2","2"],
        ["Spike 3","3"]
      ]),"spike");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#577590");
  }
};
Blockly.JavaScript['intake_row'] = function(block){
  const spike = Number(block.getFieldValue('spike'))||0;
  return JSON.stringify({cmd:'intake', spike});
};

// INTAKE HUMAN (shortcut for spike 0)
Blockly.Blocks['intake_human'] = {
  init: function() {
    this.appendDummyInput().appendField("Intake Human");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#577590");
  }
};
Blockly.JavaScript['intake_human'] = function(block){
  return JSON.stringify({cmd:'intake', spike:0});
};

// DEPOSIT (unified block with locale and optional offsets)
Blockly.Blocks['deposit'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Deposit")
      .appendField(new Blockly.FieldDropdown([["Near","near"],["Far","far"]]), "locale")
      .appendField(" sorted?")
      .appendField(new Blockly.FieldDropdown([["No","false"],["Yes","true"]]), "sorted");
    this.appendDummyInput()
      .appendField("Offset txo:")
      .appendField(new Blockly.FieldNumber(0), "txo")
      .appendField("tyo:")
      .appendField(new Blockly.FieldNumber(0), "tyo");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#277da1");
  }
};
Blockly.JavaScript['deposit'] = function(block){
  const locale = block.getFieldValue('locale');
  const sorted = block.getFieldValue('sorted') === 'true';
  const txo = Number(block.getFieldValue('txo'))||0;
  const tyo = Number(block.getFieldValue('tyo'))||0;
  return JSON.stringify({cmd:'deposit', locale, sorted, txo, tyo});
};

// DELAY (milliseconds in output to match decoder expecting "seconds" field in ms)
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
  const seconds = Math.round(s);
  return JSON.stringify({cmd:'delay', seconds});
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
  return JSON.stringify({cmd:'release'});
};

// DEPOSIT AT TILE (removed - now unified into single deposit block)
// Keeping for backwards compatibility but this is deprecated
Blockly.Blocks['deposit_tile'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("⚠️ DEPRECATED - Use Deposit block")
      .appendField("tx:")
      .appendField(new Blockly.FieldNumber(0),"tile_x")
      .appendField("ty:")
      .appendField(new Blockly.FieldNumber(0),"tile_y");
    this.appendDummyInput()
      .appendField(" sorted?")
      .appendField(new Blockly.FieldDropdown([["No","false"],["Yes","true"]]), "sorted");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#888888");
  }
};
Blockly.JavaScript['deposit_tile'] = function(block){
  const txo = Number(block.getFieldValue('tile_x'))||0;
  const tyo = Number(block.getFieldValue('tile_y'))||0;
  const sorted = block.getFieldValue('sorted') === 'true';
  // Default to "near" locale since this was tile-based positioning
  return JSON.stringify({cmd:'deposit', locale:'near', sorted, txo, tyo});
};

// Also keep deposit_near_far for backwards compatibility
Blockly.Blocks['deposit_near_far'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("⚠️ DEPRECATED - Use Deposit block")
      .appendField(new Blockly.FieldDropdown([["Near","near"],["Far","far"]]), "where")
      .appendField(" sorted?")
      .appendField(new Blockly.FieldDropdown([["No","false"],["Yes","true"]]), "sorted");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#888888");
  }
};
Blockly.JavaScript['deposit_near_far'] = function(block){
  const locale = block.getFieldValue('where');
  const sorted = block.getFieldValue('sorted') === 'true';
  return JSON.stringify({cmd:'deposit', locale, sorted, txo:0, tyo:0});
};

// Debug: log which generators are present after definitions
if (typeof console !== 'undefined' && Blockly && Blockly.JavaScript) {
  try {
    const names = ['start','drive_to','intake_row','intake_human','delay_s','deposit','deposit_near_far','deposit_tile','release_gate'];
    names.forEach(n => console.info('blocks_custom: generator present ->', n, typeof Blockly.JavaScript[n] === 'function'));
  } catch (e) { /* ignore */ }
}