Offline / Tournament build
=========================

Quick steps to produce a single-folder or single-file bundle suitable for tournament use (works offline on phones/desktops).

1. Download required libs into the project root (next to index.html):

```powershell
Invoke-WebRequest -Uri "https://unpkg.com/blockly/blockly.min.js" -OutFile ".\blockly.min.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js" -OutFile ".\pako.min.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js" -OutFile ".\kjua.min.js"
```

2. Serve the folder during development using a small server:

```powershell
# from the project folder
python -m http.server 5500
# open http://127.0.0.1:5500
```

3. (Optional) Build a single HTML file for portability: run the included `build_single_file.ps1` which inlines local scripts and styles into a single `bundle.html`.

See `build_single_file.ps1` for details.

Good luck at your tournament!# FTC QR Builder

Offline Progressive Web App to visually create autonomous command sequences for FTC robots.
It generates a compressed QR code that can be scanned by a Limelight camera and decoded by the robot.

### Features
- Google Blockly drag-and-drop editor
- Custom blocks: Start, DriveTo, IntakeRow, DepositAt, Delay
- JSON → gzip → base64 → QR
- Offline PWA with caching

### Usage
1. Open `index.html` in your browser (or host via VS Code Live Server).
2. Drag out a **Start** block.
3. Add blocks like **DriveTo**, **Deposit**, **Delay**, etc.
4. Click **Generate QR** to see the QR code.
5. The last QR is cached offline for reuse.

### Robot Side
Use `QRPlanDecoder.java` (provided in your FTC project) to decode QR → JSON → commands.
