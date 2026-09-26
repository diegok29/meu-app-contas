const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const desktopDist = path.join(root, 'desktop', 'dist');

fs.rmSync(desktopDist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist'), desktopDist, { recursive: true });
