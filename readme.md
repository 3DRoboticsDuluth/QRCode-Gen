# FTC QR Generator (Blockly + PWA)

A small offline-capable web app to build FTC autonomous sequences with Blockly, compress them and export as QR codes that Limelight can scan.

## Features
- Drag & drop blocks for `INTAKE`, `DEPOSIT`, `DELAY`.
- Generate JSON -> zlib(deflate) -> base64 payload.
- Create a high-error-correction QR (Byte mode used if supported).
- Save payloads locally (IndexedDB via localForage).
- Simple PWA support (service worker + manifest).

## How to run (VS Code)
1. Copy this folder into a workspace and open with VS Code.
2. Use the *Live Server* extension OR open `index.html` via a local static server (recommended) OR open directly in Chrome (some features like service worker require a server).
   - Quick: `npx http-server -c-1` or `python -m http.server` in the folder.
3. Open the page in your phone or laptop browser.
4. Drag blocks, press **Generate QR**, and either scan the screen with a phone (to test) or use Limelight in barcode pipeline to detect and read the payload.

## Robot-side decoder (Java)
This app outputs `base64(zlib(deflate(JSON array)))`. On the robot, decode like:

```java
byte[] compressed = Base64.getDecoder().decode(payload);
InflaterInputStream inflater = new InflaterInputStream(new ByteArrayInputStream(compressed));
String json = new BufferedReader(new InputStreamReader(inflater))
                 .lines().collect(Collectors.joining("\n"));
JSONArray arr = new JSONArray(json);
