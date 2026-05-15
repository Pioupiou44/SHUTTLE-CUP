#!/bin/bash
# =============================================================================
# build-and-notarize-mac.sh
# Lance le build macOS complet (arm64 + Intel) avec signature et notarisation.
#
# AVANT D'EXECUTER CE SCRIPT :
#   1. Assurez-vous que votre certificat "Developer ID Application" est installé
#      dans le Keychain macOS (via Xcode ou en double-cliquant sur le .p12)
#   2. Générez un mot de passe spécifique à l'application sur :
#      https://appleid.apple.com/account/manage → Sécurité → Mots de passe d'app
#
# REMPLISSEZ LES VARIABLES CI-DESSOUS :
# =============================================================================

export APPLE_ID="VOTRE_EMAIL@EXEMPLE.COM"
export APPLE_TEAM_ID="XXXXXXXXXX"         # 10 caractères — developer.apple.com/account → Membership
export APPLE_APP_SPECIFIC_PASSWORD=""     # À saisir dans le terminal (ne pas écrire ici)

# Si le certificat n'est PAS dans le Keychain, décommenter et remplir :
# export CSC_LINK=""         # base64 du fichier .p12 : base64 -i MonCert.p12
# export CSC_KEY_PASSWORD="" # mot de passe du .p12

# =============================================================================
# Vérification des variables requises
# =============================================================================
if [ -z "$APPLE_ID" ] || [ "$APPLE_ID" = "VOTRE_EMAIL@EXEMPLE.COM" ]; then
  echo "❌ Remplissez APPLE_ID dans ce script."
  exit 1
fi
if [ -z "$APPLE_TEAM_ID" ] || [ "$APPLE_TEAM_ID" = "XXXXXXXXXX" ]; then
  echo "❌ Remplissez APPLE_TEAM_ID dans ce script."
  exit 1
fi
if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
  echo "Entrez votre mot de passe d'application Apple (https://appleid.apple.com) :"
  read -s APPLE_APP_SPECIFIC_PASSWORD
  export APPLE_APP_SPECIFIC_PASSWORD
fi

# =============================================================================
# Build
# =============================================================================
set -e

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "/opt/homebrew/opt/nvm/nvm.sh"
nvm use 20

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ShuttleCup — Build macOS + Notarisation ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "→ Compilation TypeScript + Vite + Electron…"
npm run build

echo ""
echo "→ Packaging macOS — Apple Silicon (arm64)…"
npx electron-builder --mac --arm64

echo ""
echo "→ Packaging macOS — Intel (x64)…"
npx electron-builder --mac --x64

echo ""
echo "✅ Build terminé. Les DMG sont dans le dossier release/"
ls -lh release/*.dmg 2>/dev/null || true
