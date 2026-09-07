// Export de fichiers multi-plateforme.
// - Electron / navigateur : blob + <a download> (comportement historique)
// - Android (Capacitor)   : Filesystem.writeFile dans le dossier Documents
//   public de l'app (Scoped Storage, aucune permission requise sur Android 10+)

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Sauvegarde un fichier texte (CSV/JSON) sur l'appareil.
 * Retourne le chemin/URI du fichier créé (utile pour afficher un retour à l'utilisateur).
 */
export async function saveTextFile(
  fileName: string,
  content: string,
  mimeType: 'text/csv' | 'application/json'
): Promise<string> {
  if (isNative()) {
    // Android : Documents/ShuttleCup/<fileName> — visible sans permission
    const result = await Filesystem.writeFile({
      path: `ShuttleCup/${fileName}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    return result.uri
  }

  // Web / Electron : téléchargement classique via blob
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
  return fileName
}