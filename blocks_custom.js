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

// PARTNER START BLOCK
Blockly.Blocks['partner_start'] = {
  init: function() {
    this.appendDummyInput().appendField("▶ Partner Start");
    this.setNextStatement(true);
    this.setColour("#ff6b9d");
    this.setDeletable(true);
    this.setTooltip("Start block for your alliance partner's robot");
  }
};

// Debug: confirm partner_start block is defined
if (typeof console !== 'undefined') {
  console.info('Partner start block defined:', typeof Blockly.Blocks['partner_start']);
}

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

// DRIVE TO (tile-based only)
Blockly.Blocks['drive_to'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Drive to tile X:")
      .appendField(new Blockly.FieldNumber(0), "tx")
      .appendField("Y:")
      .appendField(new Blockly.FieldNumber(0), "ty")
      .appendField("heading:")
      .appendField(new Blockly.FieldNumber(0,0,360), "h")
      .appendField("Axial:")
      .appendField(new Blockly.FieldDropdown(
        [["Center","center"],["Front","front"], ["Back","back"]]
      ))
      .appendField("Lateral:")
      .appendField(new Blockly.FieldDropdown(
        [["Center","center"],["Left","left"], ["Right","right"]]
      ), "Lateral");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#43aa8b");
    this.setTooltip("Drive to a tile position with heading");
  }
};
Blockly.JavaScript['drive_to'] = function(block){
  const tx = Number(block.getFieldValue('tx'))||0;
  const ty = Number(block.getFieldValue('ty'))||0;
  const h = Number(block.getFieldValue('h'))||0;
  const axial = block.getFieldValue('Axial');
  const lateral = block.getFieldValue('Lateral');
  return JSON.stringify({cmd:'drive', tx, ty, h, axial, lateral});
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

// DEPOSIT (unified block with locale dropdown and optional offsets)
Blockly.Blocks['deposit'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Deposit at")
      .appendField(new Blockly.FieldDropdown([
        ["Near","near"],
        ["Far","far"]
      ]), "locale")
      .appendField("sorted?")
      .appendField(new Blockly.FieldDropdown([
        ["No","false"],
        ["Yes","true"]
      ]), "sorted");
    this.appendDummyInput()
      .appendField("Tile offset X:")
      .appendField(new Blockly.FieldNumber(0), "txo")
      .appendField("Y:")
      .appendField(new Blockly.FieldNumber(0), "tyo");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#277da1");
    this.setTooltip("Deposit at near/far location with optional tile offsets");
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

// Debug: log which generators are present after definitions
if (typeof console !== 'undefined' && Blockly && Blockly.JavaScript) {
  try {
    const names = ['start','drive_to','intake_row','intake_human','delay_s','deposit','release_gate'];
    names.forEach(n => console.info('blocks_custom: generator present ->', n, typeof Blockly.JavaScript[n] === 'function'));
  } catch (e) { /* ignore */ }
}