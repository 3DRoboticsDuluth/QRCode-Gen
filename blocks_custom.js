// START BLOCK
Blockly.Blocks['start'] = {
  init: function() {
    this.appendDummyInput().appendField("▶ Start");
    this.setNextStatement(true);
    this.setColour("#f9c74f");
    this.setDeletable(true);
  }
};

Blockly.JavaScript['start'] = function(block) {
  let next = block.getNextBlock();
  const plan = [];
  while(next){
    const code = Blockly.JavaScript.blockToCode(next);
    if(code && code !== 'undefined') plan.push(code);
    next = next.getNextBlock();
  }
  return `[${plan.join(',')}]`;
};

// DRIVE TO
Blockly.Blocks['drive_to'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Drive to x:")
      .appendField(new Blockly.FieldNumber(0), "x")
      .appendField("y:")
      .appendField(new Blockly.FieldNumber(0), "y")
      .appendField("heading:")
      .appendField(new Blockly.FieldNumber(0,0,360), "heading");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#43aa8b");
  }
};
Blockly.JavaScript['drive_to'] = function(block){
  const x = Number(block.getFieldValue('x'))||0;
  const y = Number(block.getFieldValue('y'))||0;
  const heading = Number(block.getFieldValue('heading'))||0;
  return JSON.stringify({cmd:'drive_to', x, y, heading});
};

// TURN TO HEADING
Blockly.Blocks['turn_to_heading'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Turn to heading")
      .appendField(new Blockly.FieldNumber(0,0,360),"heading");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#f8961e");
  }
};
Blockly.JavaScript['turn_to_heading'] = function(block){
  const heading = Number(block.getFieldValue('heading'))||0;
  return JSON.stringify({cmd:'turn_to_heading', heading});
};

// INTAKE ROW
Blockly.Blocks['intake_row'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("Intake row")
      .appendField(new Blockly.FieldNumber(1,1,5,1),"row");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#577590");
  }
};
Blockly.JavaScript['intake_row'] = function(block){
  const row = Number(block.getFieldValue('row'))||1;
  return JSON.stringify({cmd:'intake_row', row});
};

// DEPOSIT AT
Blockly.Blocks['deposit_at'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Deposit @ (")
      .appendField(new Blockly.FieldNumber(0),"x")
      .appendField(",")
      .appendField(new Blockly.FieldNumber(0),"y")
      .appendField(") heading:")
      .appendField(new Blockly.FieldNumber(0,0,360),"heading");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#277da1");
  }
};
Blockly.JavaScript['deposit_at'] = function(block){
  const x = Number(block.getFieldValue('x'))||0;
  const y = Number(block.getFieldValue('y'))||0;
  const heading = Number(block.getFieldValue('heading'))||0;
  return JSON.stringify({cmd:'deposit_at', x, y, heading});
};

// DELAY MS
Blockly.Blocks['delay_ms'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Delay for")
      .appendField(new Blockly.FieldNumber(1000,0),"ms")
      .appendField("ms");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#f94144");
  }
};
Blockly.JavaScript['delay_ms'] = function(block){
  const ms = Number(block.getFieldValue('ms'))||0;
  return JSON.stringify({cmd:'delay_ms', ms});
};

// TOGGLE INTAKE
Blockly.Blocks['toggle_intake'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Toggle Intake")
      .appendField(new Blockly.FieldDropdown([["On","true"],["Off","false"]]), "state");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#f3722c");
  }
};
Blockly.JavaScript['toggle_intake'] = function(block){
  const state = block.getFieldValue('state')==='true';
  return JSON.stringify({cmd:'toggle_intake', on: state});
};

// SET MOTOR POWER
Blockly.Blocks['set_motor_power'] = {
  init: function(){
    this.appendDummyInput()
      .appendField("Set Motor")
      .appendField(new Blockly.FieldTextInput("left"),"motor")
      .appendField("Power")
      .appendField(new Blockly.FieldNumber(0,-1,1,0.01),"power");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#90be6d");
  }
};
Blockly.JavaScript['set_motor_power'] = function(block){
  const motor = block.getFieldValue('motor')||"left";
  const power = parseFloat(block.getFieldValue('power'))||0;
  return JSON.stringify({cmd:'set_motor_power', motor, power});
};

// Debug: log which generators are present after definitions
if (typeof console !== 'undefined' && Blockly && Blockly.JavaScript) {
  try {
    const names = ['start','drive_to','turn_to_heading','intake_row','deposit_at','delay_ms','toggle_intake','set_motor_power'];
    names.forEach(n => console.info('blocks_custom: generator present ->', n, typeof Blockly.JavaScript[n] === 'function'));
  } catch (e) { /* ignore */ }
}
