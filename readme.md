# FTC QR Builder

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
