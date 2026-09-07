#!/usr/bin/env node
// build/create-android-icons.js
// Génère les icônes de lanceur Android (mipmaps) pour ShuttleCup.
// Source : public/fonts/logo.png (1024×1024 recommandé)
// Dépendances : aucune — utilise sips (macOS built-in)
//
// Génère :
// - mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png        (carré plein)
// - mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_round.png  (rond)
// - mipmap-anydpi-v26/ic_launcher_foreground.png                   (foreground adaptatif)
//
// NOTE : les fichiers XML adaptatifs (mipmap-anydpi-v26/*.xml) générés par
// Capacitor sont conservés tels quels — ils référencent @mipmap/ic_launcher
// en fond + un foreground. On remplace simplement les PNG par la vraie icône.

'use strict';
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const SRC  = path.resolve(__dirname, '../assets/icon.iconset/icon_512x512@2x.png');
const RES  = path.resolve(__dirname, '../android/app/src/main/res');

if (!fs.existsSync(SRC)) {
  console.error('❌ assets/icon.iconset/icon_512x512@2x.png introuvable');
  process.exit(1);
}
if (!fs.existsSync(RES)) {
  console.error('❌ android/app/src/main/res/ introuvable — lancez `npx cap add android` d\'abord.');
  process.exit(1);
}

function sips(src, size, dest) {
  execSync(`sips -z ${size} ${size} "${src}" --out "${dest}"`, { stdio: 'pipe' });
}

const DENSITIES = [
  ['mdpi',    48],
  ['hdpi',    72],
  ['xhdpi',   96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

// Fond plein pour le lanceur (ic_launcher) + version ronde
for (const [density, size] of DENSITIES) {
  const dir = path.join(RES, `mipmap-${density}`);
  fs.mkdirSync(dir, { recursive: true });
  sips(SRC, size, path.join(dir, 'ic_launcher.png'));
  sips(SRC, size, path.join(dir, 'ic_launcher_round.png'));
  console.log(`✓ mipmap-${density} (${size}px)`);
}

// Foreground adaptatif : même image pleine (le design ShuttleCup est un carré
// plein, pas de zone de sécurité nécessaire — l'icône reste lisible rognée)
for (const [density, size] of DENSITIES) {
  const dir = path.join(RES, `mipmap-${density}`);
  sips(SRC, Math.round(size * (4 / 3)), path.join(dir, 'ic_launcher_foreground.png'));
}

console.log('✓ Icônes Android générées dans android/app/src/main/res/');