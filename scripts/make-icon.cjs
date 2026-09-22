// Renders the app icon with Electron itself and writes build/icon.png + build/icon.ico.
// Run with: npm run icon
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3935"/>
      <stop offset="1" stop-color="#23221f"/>
    </linearGradient>
  </defs>
  <rect x="72" y="72" width="880" height="880" rx="210" fill="url(#bg)"/>
  <rect x="72.5" y="72.5" width="879" height="879" rx="209.5" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="3"/>
  <path d="M322 530 L452 660 L712 376" fill="none" stroke="#ffffff" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const html = `<!doctype html><html style="overflow:hidden"><body style="margin:0;overflow:hidden;background:transparent">
<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="display:block;width:100vw;height:100vh"/>
</body></html>`;

function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  let done = false;
  win.webContents.on('paint', (_e, _dirty, image) => {
    if (done || image.isEmpty()) return;
    const { width } = image.getSize();
    if (width < SIZE) return;
    done = true;
    const outDir = path.join(__dirname, '..', 'build');
    fs.mkdirSync(outDir, { recursive: true });
    const full = nativeImage.createFromBuffer(image.toPNG());
    fs.writeFileSync(path.join(outDir, 'icon.png'), full.resize({ width: 512, height: 512, quality: 'best' }).toPNG());
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const ico = toIco(sizes.map((size) => ({ size, png: full.resize({ width: size, height: size, quality: 'best' }).toPNG() })));
    fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
    console.log('Wrote build/icon.png and build/icon.ico');
    app.quit();
  });
  win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  setTimeout(() => {
    if (!done) {
      console.error('Timed out rendering icon');
      app.exit(1);
    }
  }, 10000);
});
