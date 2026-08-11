#!/usr/bin/env node
// build/create-icons.js
// Génère les icônes pour macOS (.icns), Windows (.ico) et Linux (.png)
// Dépendances : aucune — utilise sips + iconutil (macOS built-in)

'use strict';
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const SRC    = path.resolve(__dirname, '../public/fonts/logo.png');
const ASSETS = path.resolve(__dirname, '../assets');
const TMP    = path.join(ASSETS, '_tmp');

if (!fs.existsSync(SRC)) {
  console.error('❌ logo.png introuvable dans public/fonts/');
  process.exit(1);
}

fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(TMP,    { recursive: true });

function sips(src, size, dest) {
  execSync(`sips -z ${size} ${size} "${src}" --out "${dest}"`, { stdio: 'pipe' });
}

// ─── macOS : iconset → .icns ─────────────────────────────────────────────────
const ICONSET = path.join(ASSETS, 'icon.iconset');
fs.mkdirSync(ICONSET, { recursive: true });

const MAC_SIZES = [
  [16,   'icon_16x16.png'],
  [32,   'icon_16x16@2x.png'],
  [32,   'icon_32x32.png'],
  [64,   'icon_32x32@2x.png'],
  [128,  'icon_128x128.png'],
  [256,  'icon_128x128@2x.png'],
  [256,  'icon_256x256.png'],
  [512,  'icon_256x256@2x.png'],
  [512,  'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

console.log('→ Génération iconset macOS…');
for (const [size, name] of MAC_SIZES) {
  sips(SRC, size, path.join(ICONSET, name));
  console.log(`  ✓ ${name}`);
}
execSync(`iconutil -c icns "${ICONSET}" -o "${path.join(ASSETS, 'icon.icns')}"`, { stdio: 'pipe' });
console.log('✓ icon.icns\n');

// ─── Windows : ICO multi-taille (16, 32, 48, 256) ────────────────────────────
console.log('→ Génération icon.ico Windows…');

const ICO_SIZES = [16, 32, 48, 256];
const icoImages = [];
for (const size of ICO_SIZES) {
  const tmp = path.join(TMP, `icon_${size}.png`);
  sips(SRC, size, tmp);
  icoImages.push({ size, data: fs.readFileSync(tmp) });
  console.log(`  ✓ ${size}×${size}`);
}

// Format ICO : ICONDIR (6o) + N×ICONDIRENTRY (16o) + images
const N          = icoImages.length;
const headerSize = 6 + N * 16;
const totalSize  = headerSize + icoImages.reduce((s, img) => s + img.data.length, 0);
const ico        = Buffer.alloc(totalSize);

ico.writeUInt16LE(0, 0); // Reserved
ico.writeUInt16LE(1, 2); // Type ICO
ico.writeUInt16LE(N, 4); // Count

let dataOffset = headerSize;
for (let i = 0; i < N; i++) {
  const img = icoImages[i];
  const o   = 6 + i * 16;
  ico[o]     = img.size >= 256 ? 0 : img.size; // 0 = 256
  ico[o + 1] = img.size >= 256 ? 0 : img.size;
  ico[o + 2] = 0; // color count
  ico[o + 3] = 0; // reserved
  ico.writeUInt16LE(1,               o + 4);  // planes
  ico.writeUInt16LE(32,              o + 6);  // bit count
  ico.writeUInt32LE(img.data.length, o + 8);  // taille données
  ico.writeUInt32LE(dataOffset,      o + 12); // offset données
  img.data.copy(ico, dataOffset);
  dataOffset += img.data.length;
}
fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
console.log('✓ icon.ico\n');

// ─── Linux : dossier icons/ + icon.png principal ─────────────────────────────
console.log('→ Génération icônes Linux…');
const linuxDir = path.join(ASSETS, 'icons');
fs.mkdirSync(linuxDir, { recursive: true });

for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  sips(SRC, size, path.join(linuxDir, `${size}x${size}.png`));
  console.log(`  ✓ ${size}×${size}`);
}
fs.copyFileSync(path.join(linuxDir, '512x512.png'), path.join(ASSETS, 'icon.png'));
console.log('✓ icon.png\n');

// ─── Nettoyage ────────────────────────────────────────────────────────────────
fs.rmSync(TMP, { recursive: true, force: true });

console.log('✅ Toutes les icônes générées dans assets/');
