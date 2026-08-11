// build/notarize.js
// Hook afterSign d'electron-builder — notarise l'app macOS via notarytool
// Variables d'environnement requises :
//   APPLE_ID                   — votre email Apple Developer (ex: you@icloud.com)
//   APPLE_APP_SPECIFIC_PASSWORD — mot de passe spécifique app (appleid.apple.com)
//   APPLE_TEAM_ID              — Team ID (10 caractères, ex: ABC1234567)
//
// Si ces variables sont absentes, la notarisation est silencieusement ignorée
// (utile pour les builds de développement locaux).

'use strict';

exports.default = async function notarize(context) {
  const { electronPlatformName, appOutDir } = context;

  // Notarisation uniquement sur macOS
  if (electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn(
      '\n⚠️  Notarisation ignorée — variables manquantes :\n' +
      '   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID\n'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`\n→ Notarisation de ${appName}.app…`);

  const { notarize } = await import('@electron/notarize');

  await notarize({
    tool:             'notarytool',
    appPath,
    appleId:          APPLE_ID,
    appleIdPassword:  APPLE_APP_SPECIFIC_PASSWORD,
    teamId:           APPLE_TEAM_ID,
  });

  console.log(`✓ Notarisation terminée : ${appName}.app\n`);
};
