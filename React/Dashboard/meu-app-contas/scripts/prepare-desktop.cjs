const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const desktopDir = path.join(root, 'desktop');
const desktopDist = path.join(desktopDir, 'dist');
const projectPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const desktopPackage = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.template.json'), 'utf8'));

desktopPackage.version = projectPackage.version;
fs.writeFileSync(path.join(desktopDir, 'package.json'), `${JSON.stringify(desktopPackage, null, 2)}\n`);

fs.rmSync(desktopDist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist'), desktopDist, { recursive: true });
