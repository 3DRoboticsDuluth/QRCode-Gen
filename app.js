// ============================
// app.js
// FTC QR Code Generator Main Script
// ============================

// Load libraries (Blockly, QRCode, pako) from CDN via index.html
// Ensure this script runs after those imports.

let workspace;

window.addEventListener("load", () => {
  const toolbox = {
    kind: "flyoutToolbox",
    contents: [
      { kind: "block", type: "when_run" },
      { kind: "block", type: "intake_block" },
      { kind: "block", type: "deposit_block" },
      { kind: "block", type: "delay_block" },
      { kind: "block", type: "move_to_block" }
    ]
  };

  workspace = Blockly.inject("blocklyDiv", {
    toolbox: toolbox,
    scrollbars: true,
    trashcan: true
  });

  document.getElementById("generateBtn").addEventListener("click", generateQR);
  document.getElementById("saveBtn").addEventListener("click", savePayload);
  document.getElementById("loadBtn").addEventListener("click", loadPayload);
  document.getElementById("downloadBtn").addEventListener("click", downloadQR);
});

// ============================
// Core QR Generator
// ============================

function generateQR() {
  const topBlocks = workspace.getTopBlocks(true);
  const whenRunBlock = topBlocks.find(b => b.type === "when_run");

  if (!whenRunBlock) {
    alert("⚠️ You must start with a 'When Run ▶' block at the top.");
    return;
  }

  // Generate JS code for the root block
  const code = Blockly.JavaScript.blockToCode(whenRunBlock);
  let jsonArray;

  try {
    jsonArray = JSON.parse(code);
  } catch (e) {
    alert("Error: Could not parse program. Make sure blocks are connected.");
    console.error(e);
    return;
  }

  const jsonString = JSON.stringify(jsonArray);
  const compressed = pako.deflate(jsonString);
  const base64Data = btoa(String.fromCharCode(...compressed));

  // Display output
  document.getElementById("payload").value = base64Data;

  // Generate QR code
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: base64Data,
    width: 256,
    height: 256
  });
}

// ============================
// Local Caching
// ============================

function savePayload() {
  const payload = document.getElementById("payload").value;
  if (payload) {
    localStorage.setItem("ftc_qr_payload", payload);
    alert("✅ Payload saved locally!");
  } else {
    alert("Nothing to save.");
  }
}

function loadPayload() {
  const payload = localStorage.getItem("ftc_qr_payload");
  if (!payload) {
    alert("No saved payload found.");
    return;
  }

  document.getElementById("payload").value = payload;
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: payload,
    width: 256,
    height: 256
  });
  alert("✅ Loaded last payload!");
}

// ============================
// QR Download
// ============================

function downloadQR() {
  const qrCanvas = document.querySelector("#qrcode canvas");
  if (!qrCanvas) {
    alert("Generate a QR first!");
    return;
  }
  const link = document.createElement("a");
  link.download = "ftc_qr.png";
  link.href = qrCanvas.toDataURL();
  link.click();
}
